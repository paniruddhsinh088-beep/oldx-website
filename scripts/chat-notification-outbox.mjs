import {createHash} from 'node:crypto';
import {isolatedFirestoreContext,copyRecord,safeId} from './isolated-firestore-context.mjs';
import {runVerifiedOperation} from './verified-operation.mjs';
export const NOTIFICATION_TEST_SCHEMA=Object.freeze({events:'testOldxChatNotificationEvents',audits:'testOldxChatNotificationAttempts'});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function eventRecord(v){const e=copyRecord(v,['kind','threadId','sequence','senderUid','recipientUid']);return e&&['product','provider'].includes(e.kind)&&[e.threadId,e.senderUid,e.recipientUid].every(safeId)&&e.senderUid!==e.recipientUid&&Number.isSafeInteger(e.sequence)&&e.sequence>0&&e.sequence<10000?e:null;}
// No transport or real delivery. Isolated server-only port; default off.
// stage() executes inside the message transaction BEFORE its first write.
export function createIsolatedChatNotificationOutbox({enabled=false,firestore,sdk,schema=NOTIFICATION_TEST_SCHEMA,authenticateWorker,authorizeDelivery,now=Date.now}={}){
 if(enabled!==true)return null;
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles:['events','audits']});
 const ref=(role,id)=>sdk.doc(db,c[role],id);
 const validate=r=>copyRecord(r,['id','event','state','attempt','leaseUntil','workerUid'])&&eventRecord(r.event)&&r.id===hash(['chat-notification-v1',eventRecord(r.event)])&&['pending','leased','sent','suppressed'].includes(r.state)&&Number.isSafeInteger(r.attempt)&&r.attempt>=0&&r.attempt<=20&&Number.isSafeInteger(r.leaseUntil)&&r.leaseUntil>=0&&(r.workerUid===null||safeId(r.workerUid))&&(r.state==='leased'?r.leaseUntil>0&&safeId(r.workerUid):r.leaseUntil===0);
 async function stage(tx,value){const event=eventRecord(value);if(!event)throw Error('Invalid trusted notification');const id=hash(['chat-notification-v1',event]),r=ref('events',id),old=await tx.get(r);if(old.exists())throw Error('Orphan/repeated notification stage');return ()=>tx.set(r,{id,event,state:'pending',attempt:0,leaseUntil:0,workerUid:null});}
 const run=(options,work)=>runVerifiedOperation({authenticate:authenticateWorker,credential:options?.credential,signal:options?.signal,now,run:ctx=>sdk.runTransaction(db,tx=>work(tx,ctx),{maxAttempts:3})});
 return Object.freeze({stage,assertCompatible(database,protectedCollections){if(database!==db||Object.values(c).some(v=>protectedCollections.includes(v)))throw Error('Outbox namespace/database conflict');},
  claim(request,options){const input=copyRecord(request,['id']);if(!input||!safeId(input.id))return Promise.resolve({ok:false,code:'INVALID_REQUEST'});return run(options,async(tx,ctx)=>{const r=ref('events',input.id),s=await tx.get(r),row=s.exists()?s.data():null;if(!validate(row))return {ok:false,code:'UNAVAILABLE'};
   // Trusted worker authorizer MUST check worker role, participants, current blocks,
   // hidden/deleted state and recipient preferences within THIS transaction.
   if(typeof authorizeDelivery!=='function')return {ok:false,code:'UNAVAILABLE'};const decision=await authorizeDelivery(tx,structuredClone(row.event),ctx);ctx.checkpoint();if(decision!==true&&decision!==false)return {ok:false,code:'UNAVAILABLE'};
   if(['sent','suppressed'].includes(row.state))return {ok:true,status:row.state};
   if(row.state==='leased'&&row.leaseUntil>now())return {ok:true,status:'busy'};
   const attempt=row.attempt+1;if(!Number.isSafeInteger(attempt)||attempt>20)return {ok:false,code:'RETRY_LIMIT'};
   const auditRef=ref('audits',hash([row.id,attempt,'claim']));if((await tx.get(auditRef)).exists())return {ok:false,code:'UNAVAILABLE'};ctx.checkpoint();const next={...row,state:decision?'leased':'suppressed',attempt,leaseUntil:decision?now()+30000:0,workerUid:ctx.actorUid};ctx.markMutationAttempted();tx.set(r,next);tx.set(auditRef,{eventId:row.id,attempt,workerUid:ctx.actorUid,operation:decision?'claim':'suppress'});ctx.checkpoint();return {ok:true,status:decision?'leased':'suppressed',...(decision?{id:row.id,attempt,idempotencyKey:row.id}: {})};});},
  settle(request,options){const input=copyRecord(request,['id','attempt','outcome']);if(!input||!safeId(input.id)||!Number.isSafeInteger(input.attempt)||input.attempt<1||!['sent','retry'].includes(input.outcome))return Promise.resolve({ok:false,code:'INVALID_REQUEST'});return run(options,async(tx,ctx)=>{const r=ref('events',input.id),s=await tx.get(r),row=s.exists()?s.data():null;if(!validate(row)||row.workerUid!==ctx.actorUid||row.attempt!==input.attempt)return {ok:false,code:'DENIED'};if(typeof authorizeDelivery!=='function'||await authorizeDelivery(tx,structuredClone(row.event),ctx)!==true)return {ok:false,code:'DENIED'};ctx.checkpoint();if(row.state==='sent'&&input.outcome==='sent')return {ok:true,status:'sent'};if(row.state!=='leased'||row.leaseUntil<=now())return {ok:false,code:'STALE_LEASE'};const auditRef=ref('audits',hash([row.id,row.attempt,'settle']));if((await tx.get(auditRef)).exists())return {ok:false,code:'UNAVAILABLE'};ctx.checkpoint();ctx.markMutationAttempted();tx.set(r,{...row,state:input.outcome==='sent'?'sent':'pending',leaseUntil:0});tx.set(auditRef,{eventId:row.id,attempt:row.attempt,workerUid:ctx.actorUid,operation:input.outcome});ctx.checkpoint();return {ok:true,status:input.outcome==='sent'?'sent':'pending'};});}
 });
}
