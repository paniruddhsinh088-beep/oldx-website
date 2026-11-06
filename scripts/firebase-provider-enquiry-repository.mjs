import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createHash} from 'node:crypto';
import {getIsolatedProviderSdkContext} from './firebase-provider-repository.mjs';
import {isolatedFirestoreContext,safeId,isolatedTransactionCheck} from './isolated-firestore-context.mjs';
import {projectPublicRow} from '../features/service-providers/provider-discovery.mjs';
const roles=['actors','blocks','enquiries','receipts','audits','history'];
export const ENQUIRY_TEST_SCHEMA=Object.freeze(Object.fromEntries(roles.map(k=>[k,'testOldxEnquiry'+k[0].toUpperCase()+k.slice(1)])));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const enquiryBlockKey=(blockerUid,blockedUid)=>hash([blockerUid,blockedUid]);
// Durable transaction mapping, isolated demo + loopback only. Production paths,
// Firebase initialization, authentication and browser execution are not supplied.
export function createIsolatedProviderEnquiryRepository({enabled=false,firestore,sdk,providerSchema,schema,conversationSchema,catalog,now=Date.now}={}){
 if(enabled!==true)return Object.freeze({runTransaction:async()=>{throw new Error('Enquiry repository disabled');}});
 const {collections:p}=getIsolatedProviderSdkContext({firestore,sdk,schema:providerSchema});
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles});
 const chat=conversationSchema?isolatedFirestoreContext({firestore,sdk,schema:conversationSchema,roles:['threads','messages','receipts','audits']}).collections:null;
 if(chat&&Object.values(chat).some(path=>[...Object.values(p),...Object.values(c)].includes(path)))throw new Error('Overlapping conversation mapping');
 return enquiryRepository({sdk,catalog,now},{db,p,c,chat});
}
function enquiryRepository({sdk,catalog,now=Date.now},{db,p,c,chat,native}){
 const ref=(paths,role,id)=>{if(!safeId(id))throw new Error('Invalid canonical identity');return sdk.doc(db,paths[role],id);};
 const receipt=(uid,key,operation)=>ref(c,'receipts',hash([uid,operation,key]));
 return Object.freeze({async findEnquiryIds({providerId,actorUid,role,after,limit},context){
  if(!safeId(providerId)||!safeId(actorUid)||!['buyer','provider'].includes(role)||after!==null&&!safeId(after)||!Number.isInteger(limit)||limit<1||limit>21)throw new Error('Invalid bounded inbox');
  isolatedTransactionCheck(context.signal,context.deadlineAt,now);
  if(native){native.check();let query=db.collection(c.enquiries).where('providerId','==',providerId).where(role==='provider'?'providerUid':'buyerUid','==',actorUid).orderBy('id','asc').select('id');if(after!==null)query=query.startAfter(after);const result=await query.limit(limit).get();native.check();isolatedTransactionCheck(context.signal,context.deadlineAt,now);if(result.docs.length>limit||result.docs.some(doc=>!safeId(doc.id)||doc.data()?.id!==doc.id))throw Error('Invalid private query');return result.docs.map(doc=>doc.id);}
  const result=await sdk.getDocsFromServer(sdk.query(sdk.collection(db,c.enquiries),sdk.where('providerId','==',providerId),sdk.where(role==='provider'?'providerUid':'buyerUid','==',actorUid),sdk.orderBy('id','asc'),...(after?[sdk.startAfter(after)]:[]),sdk.limit(limit)));isolatedTransactionCheck(context.signal,context.deadlineAt,now);if(result.metadata?.fromCache!==false||result.metadata?.hasPendingWrites!==false||result.docs.length>limit)throw new Error('Untrusted inbox snapshot');return result.docs.map(doc=>doc.id);
 },async runTransaction(work,{signal,deadlineAt}={}){
  const check=()=>isolatedTransactionCheck(signal,deadlineAt,now);check();
  return sdk.runTransaction(db,async raw=>{
   const cache=new Map();let mutation=null,update=false,conversationMutation=null,conversationReadMutation=null;check();
   async function get(reference){check();if(!cache.has(reference.path)){const snap=await raw.get(reference);check();const value=snap.exists()?snap.data():null;if(value){const {committedAt,...facts}=value;cache.set(reference.path,facts);}else cache.set(reference.path,null);}return cache.get(reference.path);}
   const actor=async uid=>{const value=await get(ref(c,'actors',uid));return native&&value?{uid:value.uid,canEnquire:value.canEnquire,suspended:value.suspended}:value;};
   async function provider(providerId){
    const publication=await get(ref(p,'publications',providerId)),identity=await get(ref(p,'identities',providerId)),view=await get(ref(p,'publicViews',providerId)),generation=await get(ref(p,'generations','current'));
    if(!publication||!identity||!view||!generation||!safeId(publication.ownerUid))return null;
    const owner=await get(ref(p,'owners',publication.ownerUid)),eligibility=await get(ref(p,'actors',publication.ownerUid));
    if(publication.providerId!==providerId||publication.published!==true||identity.providerId!==providerId||identity.ownerUid!==publication.ownerUid||owner?.providerId!==providerId||owner.ownerUid!==identity.ownerUid||owner.status!=='published'||eligibility?.uid!==identity.ownerUid||eligibility.canWrite!==true||eligibility.suspended!==false||!Number.isSafeInteger(generation.value)||generation.value<1||!Number.isSafeInteger(publication.publicationEpoch)||publication.publicationEpoch<1||publication.publicationEpoch>generation.value||view.id!==providerId||view.publicationEpoch!==publication.publicationEpoch||JSON.stringify(view.services)!==JSON.stringify(publication.services)||!projectPublicRow(view,catalog,view.publicationEpoch))return null;
    return {providerId,ownerUid:identity.ownerUid,published:true,suspended:false,ownerActive:true,generation:generation.value,services:[...publication.services]};
   }
   const tx={getEnquiryActor:actor,getPublishedProvider:provider,
    async getParticipantBlocks(buyerUid,providerUid){const a=await get(ref(c,'blocks',enquiryBlockKey(buyerUid,providerUid))),b=await get(ref(c,'blocks',enquiryBlockKey(providerUid,buyerUid)));return a?.blockerUid===buyerUid&&a.blockedUid===providerUid&&typeof a.blocked==='boolean'&&b?.blockerUid===providerUid&&b.blockedUid===buyerUid&&typeof b.blocked==='boolean'?{buyerBlocked:a.blocked,providerBlocked:b.blocked}:null;},
    async getEnquiryHistory(id,after,limit){const events=[];for(let revision=after+1;revision<=after+limit;revision++){const event=await get(ref(c,'history',hash([id,revision])));if(!event)break;events.push(event);}return events;},
    getEnquiryReceipt:(uid,key,operation='create-provider-private-enquiry')=>get(receipt(uid,key,operation)),getEnquiryAudit:id=>get(ref(c,'audits',id)),getEnquiry:id=>get(ref(c,'enquiries',id)),
    stageEnquiry:value=>{if(mutation)throw new Error('Duplicate enquiry staging');mutation=value;},
    stageEnquiryUpdate:value=>{if(mutation)throw new Error('Duplicate enquiry staging');mutation=value;update=true;}
   };
   if(chat)Object.assign(tx,{getConversation:id=>get(ref(chat,'threads',id)),getConversationMessage:(id,n)=>get(ref(chat,'messages',hash([id,n]))),getConversationReceipt:(uid,key)=>get(ref(chat,'receipts',hash([uid,key]))),getConversationAudit:(uid,key)=>get(ref(chat,'audits',hash([uid,key]))),getConversationReadReceipt:(uid,key)=>get(ref(chat,'receipts',hash(['read-state',uid,key]))),getConversationReadAudit:(uid,key)=>get(ref(chat,'audits',hash(['read-state',uid,key]))),stageConversationRead:value=>{if(conversationMutation||conversationReadMutation)throw Error('Duplicate conversation mutation');conversationReadMutation=value;},stageConversation:value=>{if(conversationMutation||conversationReadMutation)throw new Error('Duplicate conversation mutation');conversationMutation=value;}});
   const result=await work(Object.freeze(tx));check();
   if(conversationReadMutation){
    if(mutation||conversationMutation||result?.ok!==true)throw Error('Invalid read-state mutation');
    const m=conversationReadMutation,threadRef=ref(chat,'threads',m.thread.enquiryId),old=await get(threadRef),key=hash(['read-state',m.record.actorUid,m.record.requestId]),receiptRef=ref(chat,'receipts',key),auditRef=ref(chat,'audits',key);
    if(!old||old.revision!==m.expectedRevision||JSON.stringify(old.readState)!==JSON.stringify(m.expectedReadState)||['providerId','enquiryId','buyerUid','providerUid','service','revision'].some(k=>old[k]!==m.thread[k])||await get(receiptRef)||await get(auditRef))return {ok:false,code:'REVISION_CONFLICT'};
    check();for(const [r,v]of [[threadRef,m.thread],[receiptRef,m.record],[auditRef,{...m.record,operation:'read.acknowledge'}]])raw.set(r,{...v,committedAt:sdk.serverTimestamp()});check();return result;
   }
   if(conversationMutation){if(mutation||result?.ok!==true)throw new Error('Invalid conversation mutation');const m=conversationMutation,id=m.thread.enquiryId,threadRef=ref(chat,'threads',id),old=await get(threadRef),messageRef=ref(chat,'messages',hash([id,m.thread.revision])),key=hash([m.receipt.actorUid,m.receipt.requestId]),receiptRef=ref(chat,'receipts',key),auditRef=ref(chat,'audits',key);if((old?.revision??0)!==m.expectedRevision||m.thread.revision!==m.expectedRevision+1||await get(messageRef)||await get(receiptRef)||await get(auditRef))return {ok:false,code:'REVISION_CONFLICT'};check();for(const [r,v] of [[threadRef,m.thread],[messageRef,m.message],[receiptRef,m.receipt],[auditRef,m.audit]])raw.set(r,{...v,committedAt:sdk.serverTimestamp()});check();return result;}
   if(!mutation)return result;if(result?.ok!==true)throw new Error('Denied enquiry cannot write');
   const m=mutation,rowRef=ref(c,'enquiries',m.record.id),old=await get(rowRef),receiptRef=receipt(m.receipt.actorUid,m.receipt.requestId,m.receipt.operation),auditRef=ref(c,'audits',m.audit.id);
   if(await get(receiptRef)!==null||await get(auditRef)!==null||m.record.id!==m.receipt.enquiryId||m.record.id!==m.audit.enquiryId||m.record.providerId!==m.receipt.providerId||m.record.providerId!==m.audit.providerId||(update?(!old||old.revision!==m.record.revision-1||old.buyerUid!==m.record.buyerUid||old.providerUid!==m.record.providerUid||old.providerId!==m.record.providerId||old.service!==m.record.service):old!==null))throw new Error('Enquiry precondition conflict');
   const historyRef=ref(c,'history',hash([m.record.id,m.record.revision]));if(await get(historyRef)!==null)throw new Error('History conflict');
   check();raw.set(historyRef,{enquiryId:m.record.id,providerId:m.record.providerId,buyerUid:m.record.buyerUid,providerUid:m.record.providerUid,revision:m.record.revision,actorUid:m.audit.actorUid,status:m.record.status,text:update?(m.audit.action==='reply'?m.record.reply:null):m.record.note});raw.set(rowRef,{...m.record,committedAt:sdk.serverTimestamp()});raw.set(receiptRef,{...m.receipt,committedAt:sdk.serverTimestamp()});raw.set(auditRef,{...m.audit,committedAt:sdk.serverTimestamp()});check();return result;
  },{maxAttempts:3});
 }});
}

// Fixed staging-only namespaces; no initialization, credentials or live enablement.
export function createStagingProviderEnquiryRepository({enabled=false,binding,catalog,now=Date.now}={}){
 if(enabled!==true)return Object.freeze({runTransaction:async()=>{throw Error('Enquiry repository disabled');}});
 const b=requireStagingMarketplaceBinding(binding);
 return enquiryRepository({sdk:b.sdk,catalog,now},{db:b.db,p:b.providerCollections,c:b.enquiryCollections,chat:b.conversationCollections,native:b});
}
