import {createHash,randomUUID} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {isolatedFirestoreContext,safeId,copyRecord,isolatedTransactionCheck} from './isolated-firestore-context.mjs';
import {preparePhotoReferences} from './photo-reference-contract.mjs';
import {STORE_CATEGORY_IDS} from '../features/stores/store-catalogue.mjs';
const roles=['actors','privateRecords','publicViews','owners','generations','receipts','audits'];
export const MARKETPLACE_TEST_SCHEMA=Object.freeze(Object.fromEntries(roles.map(k=>[k,'testOldxMarket'+k[0].toUpperCase()+k.slice(1)])));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),integer=v=>Number.isSafeInteger(v)&&v>=0,fail=code=>({ok:false,code});
const text=(v,max,multiline=false)=>typeof v==='string'&&v.length<=max&&v.trim().length>0&&!(multiline?/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u:/[<>\u0000-\u001f\u007f]/u).test(v);
function inspectProfile(kind,input){
 const keys=kind==='product'?['title','description','category','locationLabel','basePrice','isSold','storeId','photos']:['name','description','category','locationLabel','photos',...(Object.hasOwn(input??{},'categories')?['categories']:[])];const p=copyRecord(input,keys);
 if(p&&kind==='store'&&Object.hasOwn(p,'categories')&&(!Array.isArray(p.categories)||p.categories.length<1||p.categories.length>12||new Set(p.categories).size!==p.categories.length||p.categories[0]!==p.category||p.categories.some(v=>!STORE_CATEGORY_IDS.includes(v))))return null;
 if(!p||!text(p[kind==='product'?'title':'name'],120)||!text(p.description,5000,true)||!text(p.locationLabel,160)||!STORE_CATEGORY_IDS.includes(p.category)||!preparePhotoReferences(kind,p.photos).ok||kind==='product'&&(!Number.isFinite(p.basePrice)||p.basePrice<0||p.basePrice>1e9||typeof p.isSold!=='boolean'||p.storeId!==null&&!safeId(p.storeId))||Buffer.byteLength(JSON.stringify(p))>700000)return null;
 return structuredClone(p);
}
function publicProfile(kind,id,profile,revision){const {photos,...fields}=profile;return {id,kind,revision,...fields};}
// Actual SDK transaction/query mapping, demo/loopback only. No legacy collection
// access, browser import, app creation, credential or production-enable mode.
export function createIsolatedMarketplaceRepository({enabled=false,firestore,sdk,schema,authenticate,allocateId=randomUUID,readCursor,issueCursor,timeoutMs=5000,now=Date.now}={}){
 if(enabled!==true)return Object.freeze({save:async()=>fail('UNAVAILABLE'),list:async()=>fail('UNAVAILABLE'),detail:async()=>fail('UNAVAILABLE'),archive:async()=>fail('UNAVAILABLE'),owner:async()=>fail('UNAVAILABLE')});
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles});
 const ref=(role,key)=>{if(!safeId(key))throw new Error('Invalid record identity');return sdk.doc(db,c[role],key);},recordKey=(kind,id)=>kind+'_'+id;
 const check=context=>isolatedTransactionCheck(context.signal,context.deadlineAt,now);
 async function read(raw,reference){const snap=await raw.get(reference);if(!snap.exists())return null;const {committedAt,...data}=snap.data();return data;}
 async function currentPublic(raw,row){
  if(!row||!['product','store'].includes(row.kind)||!safeId(row.id)||!integer(row.revision)||!inspectProfile(row.kind,{...Object.fromEntries(Object.entries(row).filter(([k])=>!['id','kind','revision'].includes(k))),photos:[]}))throw new Error('Invalid public projection');
  const stored=await read(raw,ref('privateRecords',recordKey(row.kind,row.id)));if(!stored||stored.id!==row.id||stored.kind!==row.kind||stored.published!==true||stored.publicationRevision!==row.revision||JSON.stringify(stored.publicProfile)!==JSON.stringify(row)||!safeId(stored.ownerUid))throw new Error('Withdrawn public record');
  const actor=await read(raw,ref('actors',stored.ownerUid));if(actor?.uid!==stored.ownerUid||actor.suspended!==false||actor.canWrite!==true)throw new Error('Inactive seller');
  if(row.kind==='product'&&row.storeId!==null){const shop=await read(raw,ref('privateRecords',recordKey('store',row.storeId)));if(!shop||shop.ownerUid!==stored.ownerUid||shop.published!==true)throw new Error('Withdrawn or foreign Store');}
  return stored;
 }
 async function bounded(work,options={}){return runVerifiedOperation({authenticate:()=>({uid:'public-read'}),credential:null,signal:options.signal,timeoutMs,now,run:work});}
 return Object.freeze({
  async owner(request,{credential,signal}={}){
   const input=copyRecord(request,['kind','id','requestId']);if(!input||!['product','store'].includes(input.kind)||input.id!==null&&!safeId(input.id)||input.requestId!==null&&!safeId(input.requestId)||input.kind==='product'&&input.id===null&&input.requestId===null)return fail('INVALID_REQUEST');
   return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,run:context=>sdk.runTransaction(db,async raw=>{
    check(context);const actor=await read(raw,ref('actors',context.actorUid));if(actor?.uid!==context.actorUid||actor.canWrite!==true||actor.suspended!==false)return fail('DENIED');
    let id=input.id,receipt=null;if(input.requestId!==null){const key=hash([context.actorUid,input.kind,input.requestId]),r=await read(raw,ref('receipts',key)),a=await read(raw,ref('audits',key));if(!r)return fail('RECEIPT_UNKNOWN');if(r.actorUid!==context.actorUid||!safeId(r.id)||id!==null&&r.id!==id||a?.requestKey!==key||a.actorUid!==context.actorUid||a.id!==r.id||a.kind!==input.kind||a.toRevision!==r.revision)return fail('DENIED');id=r.id;receipt={requestId:input.requestId,revision:r.revision,status:'committed'};}
    if(input.kind==='store'){const binding=await read(raw,ref('owners',hash(['store',context.actorUid])));if(binding?.ownerUid!==context.actorUid||!safeId(binding.id)||id!==null&&id!==binding.id)return fail('DENIED');id=binding.id;}
    if(!safeId(id))return fail('DENIED');const stored=await read(raw,ref('privateRecords',recordKey(input.kind,id))),profile=inspectProfile(input.kind,stored?.profile);
    if(!stored||stored.ownerUid!==context.actorUid||stored.id!==id||stored.kind!==input.kind||stored.archived===true||!integer(stored.revision)||stored.revision<1||!profile||typeof stored.published!=='boolean'||!integer(stored.publicationRevision)||stored.publicationRevision>stored.revision||receipt&&(!integer(receipt.revision)||receipt.revision<1||receipt.revision>stored.revision))return fail('DENIED');check(context);
    return {ok:true,id,revision:stored.revision,profile,published:stored.published,publicationRevision:stored.publicationRevision,receipt};
   },{maxAttempts:3})});
  },
  async save(kind,request,{credential,signal}={}){
   const input=copyRecord(request,['requestId','id','expectedRevision','publication','profile']),profile=inspectProfile(kind,input?.profile);
   if(!['product','store'].includes(kind)||!input||!profile||!safeId(input.requestId)||input.id!==null&&!safeId(input.id)||!integer(input.expectedRevision)||input.expectedRevision===Number.MAX_SAFE_INTEGER||!['draft','publish','withdraw'].includes(input.publication))return fail('INVALID_REQUEST');
   input.profile=profile;
   return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,run:async context=>{
    const fingerprint=hash([kind,input]),key=hash([context.actorUid,kind,input.requestId]);let expected;context.markMutationAttempted();
    const result=await sdk.runTransaction(db,async raw=>{
     check(context);const actor=await read(raw,ref('actors',context.actorUid));if(actor?.uid!==context.actorUid||actor.canWrite!==true||actor.suspended!==false||input.publication!=='draft'&&actor.canPublish!==true)return expected=fail('DENIED');
     const receipt=await read(raw,ref('receipts',key));if(receipt){const audit=await read(raw,ref('audits',key)),current=await read(raw,ref('privateRecords',recordKey(kind,receipt.id)));if(receipt.actorUid!==context.actorUid||receipt.fingerprint!==fingerprint||audit?.requestKey!==key||audit.actorUid!==context.actorUid||audit.id!==receipt.id||audit.toRevision!==receipt.revision||current?.ownerUid!==context.actorUid||current.revision<receipt.revision)return expected=fail('IDEMPOTENCY_CONFLICT');return expected={ok:true,status:'replayed',id:receipt.id,revision:receipt.revision,generation:receipt.generation};}
     const ownerKey=hash(['store',context.actorUid]),owner=kind==='store'?await read(raw,ref('owners',ownerKey)):null,id=input.id??allocateId();if(!safeId(id))return expected=fail('INVALID_REQUEST');
     const target=ref('privateRecords',recordKey(kind,id)),previous=await read(raw,target),generation=await read(raw,ref('generations','current'));
     if(!generation||!integer(generation.value)||generation.value===Number.MAX_SAFE_INTEGER)return expected=fail('CONFLICT');
     if(previous?previous.archived===true||previous.ownerUid!==context.actorUid||previous.kind!==kind||previous.id!==id:input.id!==null)return expected=fail('DENIED');
     if((previous?.revision??0)!==input.expectedRevision||!previous&&input.expectedRevision!==0||kind==='store'&&(owner?owner.ownerUid!==context.actorUid||owner.id!==id:previous!==null))return expected=fail('REVISION_CONFLICT');
     if(kind==='product'&&profile.storeId!==null){const shop=await read(raw,ref('privateRecords',recordKey('store',profile.storeId)));if(shop?.ownerUid!==context.actorUid||input.publication==='publish'&&shop.published!==true)return expected=fail('DENIED');}
     const revision=input.expectedRevision+1,published=input.publication==='publish'||input.publication==='draft'&&previous?.published===true,view=input.publication==='draft'?previous?.publicProfile??null:published?publicProfile(kind,id,profile,revision):null,nextGeneration=generation.value+(input.publication==='draft'?0:1);
     const stored={id,kind,ownerUid:context.actorUid,revision,profile,published,publicationRevision:view?.revision??0,publicProfile:view};check(context);
     raw.set(target,{...stored,committedAt:sdk.serverTimestamp()});if(kind==='store'&&!owner)raw.set(ref('owners',ownerKey),{ownerUid:context.actorUid,id});
     if(input.publication!=='draft'){if(view)raw.set(ref('publicViews',recordKey(kind,id)),view);else raw.delete(ref('publicViews',recordKey(kind,id)));raw.set(ref('generations','current'),{value:nextGeneration});}
     raw.set(ref('receipts',key),{actorUid:context.actorUid,fingerprint,id,revision,generation:nextGeneration});raw.set(ref('audits',key),{requestKey:key,actorUid:context.actorUid,id,kind,fromRevision:input.expectedRevision,toRevision:revision,publication:input.publication});check(context);return expected={ok:true,status:'saved',id,revision,generation:nextGeneration};
    },{maxAttempts:3});if(JSON.stringify(expected)!==JSON.stringify(result))throw new Error('Invalid marketplace acknowledgement');return result;
   }});
  },
  async archive(kind,request,{credential,signal}={}){
   const input=copyRecord(request,['requestId','id','expectedRevision']);if(!['product','store'].includes(kind)||!input||!safeId(input.requestId)||!safeId(input.id)||!integer(input.expectedRevision)||input.expectedRevision===Number.MAX_SAFE_INTEGER)return fail('INVALID_REQUEST');
   return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,run:async context=>{const key=hash([context.actorUid,kind,'archive',input.requestId]),fingerprint=hash(input);context.markMutationAttempted();return sdk.runTransaction(db,async raw=>{
    check(context);const actor=await read(raw,ref('actors',context.actorUid)),target=ref('privateRecords',recordKey(kind,input.id)),stored=await read(raw,target),receipt=await read(raw,ref('receipts',key)),audit=await read(raw,ref('audits',key)),generation=await read(raw,ref('generations','current'));
    if(actor?.uid!==context.actorUid||actor.canWrite!==true||actor.canPublish!==true||actor.suspended!==false||stored?.ownerUid!==context.actorUid||stored.id!==input.id||stored.kind!==kind)return fail('DENIED');
    if(receipt){if(receipt.actorUid!==context.actorUid||receipt.fingerprint!==fingerprint||receipt.id!==input.id||receipt.revision!==input.expectedRevision+1||audit?.requestKey!==key||audit.actorUid!==context.actorUid||audit.toRevision!==receipt.revision||stored.archived!==true||stored.revision<receipt.revision)return fail('IDEMPOTENCY_CONFLICT');return {ok:true,status:'replayed',id:input.id,revision:receipt.revision,generation:receipt.generation};}
    if(audit||stored.archived===true||stored.revision!==input.expectedRevision||!generation||!integer(generation.value)||generation.value===Number.MAX_SAFE_INTEGER)return fail('REVISION_CONFLICT');const revision=stored.revision+1,next=generation.value+1;check(context);
    raw.set(target,{...stored,revision,published:false,publicProfile:null,publicationRevision:0,archived:true,committedAt:sdk.serverTimestamp()});raw.delete(ref('publicViews',recordKey(kind,input.id)));raw.set(ref('generations','current'),{value:next});raw.set(ref('receipts',key),{actorUid:context.actorUid,fingerprint,id:input.id,revision,generation:next});raw.set(ref('audits',key),{requestKey:key,actorUid:context.actorUid,id:input.id,kind,fromRevision:stored.revision,toRevision:revision,operation:'archive'});check(context);return {ok:true,status:'archived',id:input.id,revision,generation:next};
   },{maxAttempts:3});}});
  },
  async detail(request,{signal}={}){const input=copyRecord(request,['kind','id']);if(!input)return fail('INVALID_REQUEST');const {kind,id}=input;if(!['product','store'].includes(kind)||!safeId(id))return fail('INVALID_REQUEST');return bounded(async context=>sdk.runTransaction(db,async raw=>{const row=await read(raw,ref('publicViews',recordKey(kind,id)));check(context);if(!row)return fail('UNAVAILABLE');if(row.kind!==kind||row.id!==id||!inspectProfile(kind,{...Object.fromEntries(Object.entries(row).filter(([k])=>!['id','kind','revision'].includes(k))),photos:[]}))return fail('UNAVAILABLE');await currentPublic(raw,row);check(context);return {ok:true,profile:row};},{maxAttempts:3}),{signal});},
  async list(request,{signal}={}){
   const input=copyRecord(request,['kind','limit','category','storeId','cursor']);if(!input||!['product','store'].includes(input.kind)||!Number.isInteger(input.limit)||input.limit<1||input.limit>24||input.category!==''&&!STORE_CATEGORY_IDS.includes(input.category)||input.storeId!==null&&(!safeId(input.storeId)||input.kind!=='product')||input.cursor!==null&&(typeof input.cursor!=='string'||input.cursor.length>1024)||![readCursor,issueCursor].every(f=>typeof f==='function'))return fail('INVALID_REQUEST');
   return bounded(async context=>{
    const initial=await sdk.getDocFromServer(ref('generations','current'));check(context);if(!initial.exists()||!integer(initial.data().value))return fail('UNAVAILABLE');const generation=initial.data().value,scope=JSON.stringify(['market-v1',input.kind,input.limit,input.category,input.storeId]);let after=null;
    if(input.cursor!==null){const cursor=copyRecord(await readCursor(input.cursor),['scope','publicationEpoch','after']);if(!cursor||cursor.scope!==scope||cursor.publicationEpoch!==generation||!safeId(cursor.after))return fail('CURSOR_INVALID');after=cursor.after;}
    const constraints=[sdk.where('kind','==',input.kind),...(input.category?[input.kind==='store'?sdk.or(sdk.where('category','==',input.category),sdk.where('categories','array-contains',input.category)):sdk.where('category','==',input.category)]:[]),...(input.storeId?[sdk.where('storeId','==',input.storeId)]:[]),sdk.orderBy('id','asc'),...(after?[sdk.startAfter(after)]:[]),sdk.limit(input.limit+1)];const snapshot=await sdk.getDocsFromServer(sdk.query(sdk.collection(db,c.publicViews),...constraints));check(context);
    if(snapshot.metadata?.fromCache!==false||snapshot.metadata?.hasPendingWrites!==false||snapshot.docs.length>input.limit+1)return fail('UNAVAILABLE');const rows=snapshot.docs.map(d=>{const row=d.data();if(d.id!==recordKey(row.kind,row.id))throw new Error('Forged public identity');return row;});
    await sdk.runTransaction(db,async raw=>{const g=await read(raw,ref('generations','current'));if(g?.value!==generation)throw new Error('Stale marketplace page');let previous=after;for(const row of rows){if(row.kind!==input.kind||!safeId(row.id)||!integer(row.revision)||previous!==null&&row.id<=previous||input.category&&!(row.kind==='store'?(row.categories??[row.category]).includes(input.category):row.category===input.category)||input.storeId&&row.storeId!==input.storeId)throw new Error('Invalid public page');previous=row.id;await currentPublic(raw,row);}check(context);},{maxAttempts:3});
    const items=rows.slice(0,input.limit),nextCursor=rows.length>input.limit?await issueCursor({scope,publicationEpoch:generation,after:items.at(-1).id}):null;check(context);if(nextCursor!==null&&(typeof nextCursor!=='string'||nextCursor.length<1||nextCursor.length>1024))return fail('UNAVAILABLE');const final=await sdk.getDocFromServer(ref('generations','current'));check(context);if(final.data()?.value!==generation)return fail('UNAVAILABLE');return {ok:true,items,nextCursor,publicationEpoch:generation};
   },{signal});
  }
 });
}
