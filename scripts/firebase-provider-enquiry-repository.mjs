import {readProviderConversationAuthority} from './provider-conversation-repository.mjs';
import {validReadState} from './trusted-chat-read-state.mjs';
import {providerMessageFacts} from './provider-message-facts.mjs';
import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createHash} from 'node:crypto';
import {getIsolatedProviderSdkContext} from './firebase-provider-repository.mjs';
import {isolatedFirestoreContext,safeId,copyRecord,isolatedTransactionCheck} from './isolated-firestore-context.mjs';
import {projectPublicRow} from '../features/service-providers/provider-discovery.mjs';
const roles=['actors','blocks','enquiries','receipts','audits','history'];
export const ENQUIRY_TEST_SCHEMA=Object.freeze(Object.fromEntries(roles.map(k=>[k,'testOldxEnquiry'+k[0].toUpperCase()+k.slice(1)])));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const enquiryBlockKey=(blockerUid,blockedUid)=>hash([blockerUid,blockedUid]);
// Durable transaction mapping, isolated demo + loopback only. Production paths,
// Firebase initialization, authentication and browser execution are not supplied.
export function createIsolatedProviderEnquiryRepository({enabled=false,firestore,sdk,providerSchema,schema,conversationSchema,notificationOutbox=null,inboxIndex=null,catalog,now=Date.now}={}){
 if(enabled!==true)return Object.freeze({runTransaction:async()=>{throw new Error('Enquiry repository disabled');}});
 const {collections:p}=getIsolatedProviderSdkContext({firestore,sdk,schema:providerSchema});
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles});
 const chat=conversationSchema?isolatedFirestoreContext({firestore,sdk,schema:conversationSchema,roles:['threads','messages','receipts','audits']}).collections:null;
 if(chat&&Object.values(chat).some(path=>[...Object.values(p),...Object.values(c)].includes(path)))throw new Error('Overlapping conversation mapping');
 inboxIndex?.assertCompatible(db,[...Object.values(p),...Object.values(c),...Object.values(chat??{}),...Object.values(notificationOutbox?.collections??{})]);
 notificationOutbox?.assertCompatible(db,[...Object.values(p),...Object.values(c),...Object.values(chat??{}),...Object.values(inboxIndex?.collections??{})]);
 return enquiryRepository({sdk,catalog,now,notificationOutbox,inboxIndex},{db,p,c,chat});
}
function enquiryRepository({sdk,catalog,now=Date.now,notificationOutbox=null,inboxIndex=null},{db,p,c,chat,native}){
 const ref=(paths,role,id)=>{if(!safeId(id))throw new Error('Invalid canonical identity');return sdk.doc(db,paths[role],id);};
 const receipt=(uid,key,operation)=>ref(c,'receipts',hash([uid,operation,key]));
 const canonical=t=>({id:t.enquiryId,buyerUid:t.buyerUid,sellerUid:t.providerUid,revision:t.revision,readState:t.readState});
 const contexts=new WeakMap();
 function readContext(raw,check=()=>{}){if(contexts.has(raw))return contexts.get(raw);
   const cache=new Map();check();
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
    getEnquiryReceipt:(uid,key,operation='create-provider-private-enquiry')=>get(receipt(uid,key,operation)),getEnquiryAudit:id=>get(ref(c,'audits',id)),getEnquiry:id=>get(ref(c,'enquiries',id))
   };
   if(chat)Object.assign(tx,{getConversation:id=>get(ref(chat,'threads',id)),getReconciledConversation:async(id,uid,revision)=>{const row=inboxIndex?await inboxIndex.readyRow(raw,{actorUid:uid,kind:'provider',threadId:id,revision}):null;return row?.mode==='reconciled'?row:null;},getConversationMessage:(id,n)=>get(ref(chat,'messages',hash([id,n]))),authorizeIndexedConversation:(id,uid,revision)=>inboxIndex?inboxIndex.assertAccessible(raw,{actorUid:uid,kind:'provider',threadId:id,revision}):false});
   const value={tx,get};contexts.set(raw,value);return value;
 }
 const notificationReaders=chat?Object.freeze({
  async readThread(raw,event){if(event?.kind!=='provider'||!safeId(event.threadId)||!safeId(event.recipientUid))return null;const {tx}=readContext(raw),t=await tx.getConversation(event.threadId);if(!t)return null;const a=await readProviderConversationAuthority(tx,{actorUid:event.recipientUid},{providerId:t.providerId,enquiryId:t.enquiryId},{notification:true});if(!a)return null;return {kind:'provider',threadId:a.thread.enquiryId,participantUids:[a.thread.buyerUid,a.thread.providerUid],active:true,revision:a.thread.revision};},
  async readMessage(raw,event){if(event?.kind!=='provider'||!safeId(event.threadId)||!Number.isSafeInteger(event.sequence)||event.sequence<1||event.sequence>9999)return null;const {tx}=readContext(raw),t=await tx.getConversation(event.threadId),m=await tx.getConversationMessage(event.threadId,event.sequence);const canonical=t&&{id:t.enquiryId,buyerUid:t.buyerUid,sellerUid:t.providerUid,revision:t.revision,readState:t.readState};if(!canonical||!validReadState(canonical)||m?.providerId!==t.providerId||m.enquiryId!==t.enquiryId)return null;const prefix=copyRecord(m.readPrefix,['buyerReceived','sellerReceived']);if(!prefix||!['buyer','seller'].every(r=>Number.isSafeInteger(prefix[r+'Received'])&&prefix[r+'Received']>=0&&prefix[r+'Received']<=t.readState[r+'Received'])||prefix.buyerReceived+prefix.sellerReceived!==event.sequence)return null;return providerMessageFacts(m,t);},
  async readBlock(raw,from,to){if(!safeId(from)||!safeId(to)||from===to)return null;return readContext(raw).get(ref(c,'blocks',enquiryBlockKey(from,to)));}
 }):null;
 return Object.freeze({notificationReaders,async findEnquiryIds({providerId,actorUid,role,after,limit},context){
  if(!safeId(providerId)||!safeId(actorUid)||!['buyer','provider'].includes(role)||after!==null&&!safeId(after)||!Number.isInteger(limit)||limit<1||limit>21)throw new Error('Invalid bounded inbox');
  isolatedTransactionCheck(context.signal,context.deadlineAt,now);
  if(native){native.check();let query=db.collection(c.enquiries).where('providerId','==',providerId).where(role==='provider'?'providerUid':'buyerUid','==',actorUid).orderBy('id','asc').select('id');if(after!==null)query=query.startAfter(after);const result=await query.limit(limit).get();native.check();isolatedTransactionCheck(context.signal,context.deadlineAt,now);if(result.docs.length>limit||result.docs.some(doc=>!safeId(doc.id)||doc.data()?.id!==doc.id))throw Error('Invalid private query');return result.docs.map(doc=>doc.id);}
  const result=await sdk.getDocsFromServer(sdk.query(sdk.collection(db,c.enquiries),sdk.where('providerId','==',providerId),sdk.where(role==='provider'?'providerUid':'buyerUid','==',actorUid),sdk.orderBy('id','asc'),...(after?[sdk.startAfter(after)]:[]),sdk.limit(limit)));isolatedTransactionCheck(context.signal,context.deadlineAt,now);if(result.metadata?.fromCache!==false||result.metadata?.hasPendingWrites!==false||result.docs.length>limit)throw new Error('Untrusted inbox snapshot');return result.docs.map(doc=>doc.id);
 },async runTransaction(work,{signal,deadlineAt}={}){
  const check=()=>isolatedTransactionCheck(signal,deadlineAt,now);check();
  return sdk.runTransaction(db,async raw=>{
   let mutation=null,update=false,conversationMutation=null,conversationReadMutation=null,conversationPrivacyMutation=null;check();const {tx,get}=readContext(raw,check);Object.assign(tx,{
    stageEnquiry:value=>{if(mutation)throw new Error('Duplicate enquiry staging');mutation=value;},
    stageEnquiryUpdate:value=>{if(mutation)throw new Error('Duplicate enquiry staging');mutation=value;update=true;}
   });
   if(chat)Object.assign(tx,{getConversation:id=>get(ref(chat,'threads',id)),authorizeIndexedConversation:(id,uid,revision)=>inboxIndex?inboxIndex.assertAccessible(raw,{actorUid:uid,kind:'provider',threadId:id,revision}):false,getConversationMessage:(id,n)=>get(ref(chat,'messages',hash([id,n]))),getConversationReceipt:(uid,key)=>get(ref(chat,'receipts',hash([uid,key]))),getConversationAudit:(uid,key)=>get(ref(chat,'audits',hash([uid,key]))),getConversationPrivacyReceipt:(uid,key)=>get(ref(chat,'receipts',hash(['privacy',uid,key]))),getConversationPrivacyAudit:(uid,key)=>get(ref(chat,'audits',hash(['privacy',uid,key]))),stageConversationPrivacy:value=>{if(conversationMutation||conversationReadMutation||conversationPrivacyMutation)throw Error('Duplicate privacy mutation');conversationPrivacyMutation=value;},getConversationReadReceipt:(uid,key)=>get(ref(chat,'receipts',hash(['read-state',uid,key]))),getConversationReadAudit:(uid,key)=>get(ref(chat,'audits',hash(['read-state',uid,key]))),stageConversationRead:value=>{if(conversationMutation||conversationReadMutation||conversationPrivacyMutation)throw Error('Duplicate conversation mutation');conversationReadMutation=value;},stageConversation:value=>{if(conversationMutation||conversationReadMutation)throw new Error('Duplicate conversation mutation');conversationMutation=value;}});
   const result=await work(Object.freeze(tx));check();
   if(conversationPrivacyMutation){if(mutation||conversationMutation||conversationReadMutation||result?.ok!==true||!inboxIndex)throw Error('Invalid indexed privacy mutation');const value=conversationPrivacyMutation,t=value.thread,old=await get(ref(chat,'threads',t.enquiryId)),record=value.record,key=hash(['privacy',record.actorUid,record.requestId]),receiptRef=ref(chat,'receipts',key),auditRef=ref(chat,'audits',key);if(!old||old.revision!==value.expectedRevision||old.inboxIndexed!==true||['providerId','enquiryId','buyerUid','providerUid','service'].some(k=>old[k]!==t[k])||record.inventoryEpoch!==key||await get(receiptRef)||await get(auditRef))return {ok:false,code:'REVISION_CONFLICT'};
    let target,next;if(value.message){target=ref(chat,'messages',hash([t.enquiryId,record.sequence]));const current=await get(target);if(!current||current.providerId!==t.providerId||current.enquiryId!==t.enquiryId||current.sequence!==record.sequence||current.senderUid!==value.message.senderUid)throw Error('Invalid message privacy precondition');next=value.message;}else{target=ref(c,'blocks',enquiryBlockKey(value.edge.blockerUid,value.edge.blockedUid));const current=await get(target);if(!copyRecord(current,['blockerUid','blockedUid','blocked']))return {ok:false,code:'READ_STATE_UNAVAILABLE'};if(current?.blockerUid!==value.edge.blockerUid||current.blockedUid!==value.edge.blockedUid||current.blocked!==value.expectedBlocked)return {ok:false,code:'REVISION_CONFLICT'};next=value.edge;}
    const invalidate=await inboxIndex.stageInvalidation(raw,[t.buyerUid,t.providerUid].map(actorUid=>({actorUid,nextEpoch:key})));check();raw.set(target,{...next,committedAt:sdk.serverTimestamp()});raw.set(receiptRef,{...record,committedAt:sdk.serverTimestamp()});raw.set(auditRef,{...record,committedAt:sdk.serverTimestamp()});invalidate();check();return result;
   }
   if(conversationReadMutation){
    if(mutation||conversationMutation||conversationPrivacyMutation||result?.ok!==true)throw Error('Invalid read-state mutation');
    const m=conversationReadMutation,threadRef=ref(chat,'threads',m.thread.enquiryId),old=await get(threadRef),key=hash(['read-state',m.record.actorUid,m.record.requestId]),receiptRef=ref(chat,'receipts',key),auditRef=ref(chat,'audits',key);
    if(!old||old.revision!==m.expectedRevision||JSON.stringify(old.readState)!==JSON.stringify(m.expectedReadState)||['providerId','enquiryId','buyerUid','providerUid','service','revision'].some(k=>old[k]!==m.thread[k])||await get(receiptRef)||await get(auditRef))return {ok:false,code:'REVISION_CONFLICT'};
    if(old.inboxIndexed===true&&!inboxIndex)throw Error('Index required');const indexCommit=inboxIndex?(m.reconciled?await inboxIndex.stageReconciledRead(raw,{row:m.reconciled.row,throughSequence:m.record.readSequence,visibleIncoming:m.reconciled.visibleIncoming}):await inboxIndex.stageConversation(raw,{kind:'provider',before:old,after:m.thread,title:m.thread.service,providerId:m.thread.providerId})):null;check();for(const [r,v]of [[threadRef,m.thread],[receiptRef,m.record],[auditRef,{...m.record,operation:m.reconciled?'read.reconciled.acknowledge':'read.acknowledge'}]])raw.set(r,{...v,committedAt:sdk.serverTimestamp()});indexCommit?.();check();return result;
   }
   if(conversationMutation){if(mutation||result?.ok!==true)throw new Error('Invalid conversation mutation');const m=conversationMutation,id=m.thread.enquiryId,threadRef=ref(chat,'threads',id),old=await get(threadRef),messageRef=ref(chat,'messages',hash([id,m.thread.revision])),key=hash([m.receipt.actorUid,m.receipt.requestId]),receiptRef=ref(chat,'receipts',key),auditRef=ref(chat,'audits',key);if((old?.revision??0)!==m.expectedRevision||m.thread.revision!==m.expectedRevision+1||await get(messageRef)||await get(receiptRef)||await get(auditRef))return {ok:false,code:'REVISION_CONFLICT'};if(old?.inboxIndexed===true&&!inboxIndex)throw Error('Index required');if(inboxIndex)m.thread={...m.thread,inboxIndexed:true};const indexCommit=inboxIndex?(m.reconciled?await inboxIndex.stageReconciledSend(raw,{kind:'provider',providerId:m.thread.providerId,before:canonical(old),after:canonical(m.thread),title:m.thread.service}):await inboxIndex.stageConversation(raw,{kind:'provider',before:old,after:m.thread,title:m.thread.service,providerId:m.thread.providerId})):null;const enqueue=notificationOutbox?await notificationOutbox.stage(raw,{kind:'provider',threadId:id,sequence:m.thread.revision,senderUid:m.message.senderUid,recipientUid:m.message.senderUid===m.thread.buyerUid?m.thread.providerUid:m.thread.buyerUid}):null;check();for(const [r,v] of [[threadRef,m.thread],[messageRef,m.message],[receiptRef,m.receipt],[auditRef,m.audit]])raw.set(r,{...v,committedAt:sdk.serverTimestamp()});enqueue?.();indexCommit?.();check();return result;}
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
