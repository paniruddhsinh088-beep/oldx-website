import {isIsolatedNotificationOutbox} from './chat-notification-outbox.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
const transports=new WeakSet();
// Recording-only delivery capability: no fetch/SDK, tokens, URLs or network ports.
export function createRecordingNotificationTransport(){const accepted=new Map();let lose=false;const api=Object.freeze({send(envelope){const v=copyRecord(envelope,['idempotencyKey','recipientUid','type']);if(!v||!safeId(v.idempotencyKey)||!safeId(v.recipientUid)||v.type!=='chat.message')throw Error('Invalid private notification envelope');if(!accepted.has(v.idempotencyKey))accepted.set(v.idempotencyKey,structuredClone(v));if(lose){lose=false;throw Error('Simulated lost provider acknowledgement');}return {accepted:true,idempotencyKey:v.idempotencyKey};},loseNextAcknowledgement(){lose=true;},snapshot:()=>structuredClone([...accepted.values()])});transports.add(api);return api;}
export function createIsolatedNotificationWorker({enabled=false,outbox,transport}={}){
 if(enabled!==true)return Object.freeze({run:async()=>({ok:false,code:'UNAVAILABLE'}),cleanup:async()=>({ok:false,code:'UNAVAILABLE'})});
 if(!isIsolatedNotificationOutbox(outbox)||!transports.has(transport))throw Error('Only isolated outbox and recording transport permitted');let pending=null;
 async function process(id,options){const claim=await outbox.claim({id},options);if(!claim.ok||claim.status!=='leased')return claim;const lease={id,attempt:claim.attempt},prepared=await outbox.inspectLease(lease,options);if(!prepared.ok){if(prepared.code==='DENIED')return outbox.settle({...lease,outcome:'suppressed'},options);return prepared;}if(options?.signal?.aborted)return {ok:false,code:'CANCELLED'};
  try{const receipt=transport.send({idempotencyKey:claim.idempotencyKey,recipientUid:prepared.event.recipientUid,type:'chat.message'});if(receipt?.accepted!==true||receipt.idempotencyKey!==id)return {ok:false,code:'OUTCOME_UNKNOWN'};}catch{return {ok:false,code:'OUTCOME_UNKNOWN'};}
  return outbox.settle({...lease,outcome:'sent'},options);
 }
 return Object.freeze({async run(options){if(pending)return pending;pending=(async()=>{const candidates=await outbox.discover({purpose:'delivery',limit:20},options);if(!candidates.ok)return candidates;const results=[];for(const id of candidates.ids){if(options?.signal?.aborted)break;results.push({id,result:await process(id,options)});}return {ok:true,results};})();try{return await pending;}finally{pending=null;}},
  async cleanup({dryRun=true}={},options){const candidates=await outbox.discover({purpose:'retention',limit:20},options);if(!candidates.ok||dryRun)return candidates;const results=[];for(const id of candidates.ids){if(options?.signal?.aborted)break;results.push({id,result:await outbox.retire({id},options)});}return {ok:true,results};}
 });
}
