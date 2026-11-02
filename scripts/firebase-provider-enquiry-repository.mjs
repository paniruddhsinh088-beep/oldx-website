import {createHash} from 'node:crypto';
import {getIsolatedProviderSdkContext} from './firebase-provider-repository.mjs';
import {DISCOVERY_FIELDS} from '../features/service-providers/provider-discovery.mjs';
import {projectProviderEnquiryRead} from './provider-enquiry-transaction.mjs';

const OP='create-provider-private-enquiry';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const epoch=v=>Number.isSafeInteger(v)&&v>=0;
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const blockKey=(from,to)=>digest(['participant-block',from,to]);
const extras=['buyerActors','participantBlocks','enquiries','enquiryReceipts','enquiryAudits'];
const unavailable=()=>{throw new Error('Isolated enquiry repository unavailable');};
const fields=(value,keys)=>value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).sort().join(',')===[...keys].sort().join(',');

// Candidate namespace ONLY; not referenced by deployed Rules or Firebase config.
export const PROVIDER_ENQUIRY_TEST_SCHEMA=Object.freeze(Object.fromEntries(extras.map(k=>[k,'testProviderEnquiry'+k[0].toUpperCase()+k.slice(1)])));

// This adapter cannot connect to a real Firebase project. All reads and writes are
// SDK transactions against the loopback/demo context, and are disabled by default.
export function createIsolatedFirebaseEnquiryRepository({enabled=false,firestore,sdk,schema,now=Date.now}={}){
 if(enabled!==true)return Object.freeze({runTransaction:unavailable,readPrivate:unavailable});
 const base=Object.fromEntries(Object.entries(schema??{}).filter(([key])=>!extras.includes(key)));
 const {db,collections}=getIsolatedProviderSdkContext({firestore,sdk,schema:base});
 if(!fields(schema,[...Object.keys(collections),...extras])||extras.some(k=>typeof schema[k]!=='string'||!/^testProvider[A-Za-z0-9]{1,48}$/.test(schema[k]))||new Set(Object.values(schema)).size!==Object.keys(schema).length)unavailable();
 if(!['doc','runTransaction','serverTimestamp'].every(k=>typeof sdk?.[k]==='function'))unavailable();
 const ref=(collection,key)=>{if(!id(key)&&!/^[a-f0-9]{64}$/.test(key))unavailable();return sdk.doc(db,schema[collection],key);};
 const receiptKey=(uid,key)=>digest([OP,uid,key]);
 const check=(signal,deadlineAt)=>{if(signal?.aborted||!Number.isSafeInteger(deadlineAt)||now()>=deadlineAt)throw new Error('Enquiry transaction stopped');};
 async function withTx(callback,{signal,deadlineAt}={}){
  check(signal,deadlineAt);
  return sdk.runTransaction(db,async raw=>{
   const cache=new Map();let staged=null;
   async function get(collection,key){check(signal,deadlineAt);const reference=ref(collection,key);if(!cache.has(reference.path)){const snap=await raw.get(reference);check(signal,deadlineAt);const data=snap.exists()?snap.data():null;if(data!==null&&(!data||Object.getPrototypeOf(data)!==Object.prototype))unavailable();if(data){const {committedAt,...rest}=data;cache.set(reference.path,rest);}else cache.set(reference.path,null);}return cache.get(reference.path);}
   async function canonical(providerId){
    const generation=await get('generations','current'),publication=await get('publications',providerId),view=await get('publicViews',providerId);
    if(!generation||!epoch(generation.value)||!publication||!view||!fields(view,DISCOVERY_FIELDS)||publication.providerId!==providerId||view.id!==providerId||view.published!==true||publication.published!==true||!epoch(publication.publicationEpoch)||publication.publicationEpoch<1||publication.publicationEpoch!==view.publicationEpoch||publication.publicationEpoch>generation.value||!id(publication.ownerUid)||JSON.stringify(publication.services)!==JSON.stringify(view.services))return null;
    const identity=await get('identities',providerId),owner=await get('owners',publication.ownerUid),actor=await get('actors',publication.ownerUid),permission=await get('permissions',publication.ownerUid);
    if(identity?.providerId!==providerId||identity.ownerUid!==publication.ownerUid||owner?.providerId!==providerId||owner.ownerUid!==publication.ownerUid||owner.status!=='published'||actor?.uid!==publication.ownerUid||permission?.uid!==publication.ownerUid)return null;
    return {providerId,ownerUid:publication.ownerUid,published:true,suspended:permission.suspended!==false,ownerActive:actor.canWrite===true&&actor.suspended===false,generation:generation.value,services:view.services};
   }
   async function blocks(buyer,owner){
    const b=await get('participantBlocks',blockKey(buyer,owner)),p=await get('participantBlocks',blockKey(owner,buyer));
    if(!fields(b,['fromUid','toUid','blocked'])||!fields(p,['fromUid','toUid','blocked'])||b.fromUid!==buyer||b.toUid!==owner||p.fromUid!==owner||p.toUid!==buyer||typeof b.blocked!=='boolean'||typeof p.blocked!=='boolean')return null;
    return {buyerBlocked:b.blocked,providerBlocked:p.blocked};
   }
   const tx=Object.freeze({
    getEnquiryActor:uid=>get('buyerActors',uid),
    getProviderActor:uid=>get('actors',uid),
    getPublishedProvider:canonical,
    getParticipantBlocks:blocks,
    getEnquiryReceipt:(uid,key)=>get('enquiryReceipts',receiptKey(uid,key)),
    getEnquiryAudit:key=>get('enquiryAudits',key),
    getEnquiry:key=>get('enquiries',key),
    stageEnquiry:value=>{if(staged!==null||!fields(value,['record','receipt','audit']))unavailable();staged=value;}
   });
   const result=await callback(tx);check(signal,deadlineAt);
   if(staged){
    if(result?.ok!==true||result.status!=='created')unavailable();
    const {record,receipt,audit}=staged;
    if(!fields(receipt,['operation','actorUid','requestId','providerId','enquiryId','fingerprint','auditId'])||!fields(audit,['id','operation','actorUid','providerId','enquiryId','requestId'])||!fields(record,['id','providerId','providerUid','buyerUid','service','note','timing','status','revision','reply','buyerConfirmed','publicationGeneration'])||receipt.operation!==OP||audit.operation!==OP||!id(receipt.actorUid)||!id(receipt.requestId)||!id(receipt.providerId)||!id(receipt.enquiryId)||!id(audit.id)||record.id!==receipt.enquiryId||record.providerId!==receipt.providerId||record.buyerUid!==receipt.actorUid||audit.id!==receipt.auditId||audit.enquiryId!==record.id||audit.actorUid!==receipt.actorUid||audit.requestId!==receipt.requestId||audit.providerId!==receipt.providerId||result.enquiryId!==record.id||record.status!=='new'||record.revision!==0||record.buyerConfirmed!==false||record.reply!==''||!epoch(record.publicationGeneration)||record.publicationGeneration<1||!(/^[a-f0-9]{64}$/).test(receipt.fingerprint))unavailable();
    const receiptRef=ref('enquiryReceipts',receiptKey(receipt.actorUid,receipt.requestId)),auditRef=ref('enquiryAudits',audit.id),enquiryRef=ref('enquiries',record.id);
    if(await get('enquiryReceipts',receiptKey(receipt.actorUid,receipt.requestId))!==null||await get('enquiryAudits',audit.id)!==null||await get('enquiries',record.id)!==null)unavailable();
    check(signal,deadlineAt);raw.set(enquiryRef,{...record,committedAt:sdk.serverTimestamp()});raw.set(receiptRef,{...receipt,committedAt:sdk.serverTimestamp()});raw.set(auditRef,{...audit,committedAt:sdk.serverTimestamp()});
   }
   check(signal,deadlineAt);return result;
  },{maxAttempts:3});
 }
 return Object.freeze({runTransaction:withTx,async readPrivate(request,actorUid,{signal,deadlineAt=now()+5000}={}){
  if(!id(actorUid)||!request||!id(request.providerId)||!id(request.enquiryId))return {ok:false,code:'UNAVAILABLE'};
  return withTx(async tx=>{
   const record=await tx.getEnquiry(request.enquiryId);
   if(!record||record.providerId!==request.providerId)return {ok:false,code:'UNAVAILABLE'};
   const canonical=await tx.getPublishedProvider(request.providerId);
   if(!canonical)return {ok:false,code:'UNAVAILABLE'};
   const actor=actorUid===canonical.ownerUid?await tx.getProviderActor(actorUid):await tx.getEnquiryActor(actorUid);
   if(!actor||actor.uid!==actorUid||actor.suspended!==false||(actorUid===canonical.ownerUid?actor.canWrite!==true:actor.canEnquire!==true))return {ok:false,code:'UNAVAILABLE'};
   const block=await tx.getParticipantBlocks(record.buyerUid,canonical.ownerUid);
   return projectProviderEnquiryRead(request,canonical,record,block,actorUid,{enabled:true});
  },{signal,deadlineAt});
 }});
}

export const enquiryBlockKeyForTests=blockKey;
