import {createHash} from 'node:crypto';
import {getIsolatedProviderSdkContext} from './firebase-provider-repository.mjs';
import {isolatedFirestoreContext,safeId,isolatedTransactionCheck} from './isolated-firestore-context.mjs';
import {projectPublicRow} from '../features/service-providers/provider-discovery.mjs';
const roles=['actors','blocks','enquiries','receipts','audits'];
export const ENQUIRY_TEST_SCHEMA=Object.freeze(Object.fromEntries(roles.map(k=>[k,'testOldxEnquiry'+k[0].toUpperCase()+k.slice(1)])));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const enquiryBlockKey=(blockerUid,blockedUid)=>hash([blockerUid,blockedUid]);
// Durable transaction mapping, isolated demo + loopback only. Production paths,
// Firebase initialization, authentication and browser execution are not supplied.
export function createIsolatedProviderEnquiryRepository({enabled=false,firestore,sdk,providerSchema,schema,catalog,now=Date.now}={}){
 if(enabled!==true)return Object.freeze({runTransaction:async()=>{throw new Error('Enquiry repository disabled');}});
 const {collections:p}=getIsolatedProviderSdkContext({firestore,sdk,schema:providerSchema});
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles});
 const ref=(paths,role,id)=>{if(!safeId(id))throw new Error('Invalid canonical identity');return sdk.doc(db,paths[role],id);};
 const receipt=(uid,key,operation)=>ref(c,'receipts',hash([uid,operation,key]));
 return Object.freeze({async runTransaction(work,{signal,deadlineAt}={}){
  const check=()=>isolatedTransactionCheck(signal,deadlineAt,now);check();
  return sdk.runTransaction(db,async raw=>{
   const cache=new Map();let mutation=null,update=false;check();
   async function get(reference){check();if(!cache.has(reference.path)){const snap=await raw.get(reference);check();const value=snap.exists()?snap.data():null;if(value){const {committedAt,...facts}=value;cache.set(reference.path,facts);}else cache.set(reference.path,null);}return cache.get(reference.path);}
   const actor=uid=>get(ref(c,'actors',uid));
   async function provider(providerId){
    const publication=await get(ref(p,'publications',providerId)),identity=await get(ref(p,'identities',providerId)),view=await get(ref(p,'publicViews',providerId)),generation=await get(ref(p,'generations','current'));
    if(!publication||!identity||!view||!generation||!safeId(publication.ownerUid))return null;
    const owner=await get(ref(p,'owners',publication.ownerUid)),eligibility=await get(ref(p,'actors',publication.ownerUid));
    if(publication.providerId!==providerId||publication.published!==true||identity.providerId!==providerId||identity.ownerUid!==publication.ownerUid||owner?.providerId!==providerId||owner.ownerUid!==identity.ownerUid||owner.status!=='published'||eligibility?.uid!==identity.ownerUid||eligibility.canWrite!==true||eligibility.suspended!==false||!Number.isSafeInteger(generation.value)||generation.value<1||!Number.isSafeInteger(publication.publicationEpoch)||publication.publicationEpoch<1||publication.publicationEpoch>generation.value||view.id!==providerId||view.publicationEpoch!==publication.publicationEpoch||JSON.stringify(view.services)!==JSON.stringify(publication.services)||!projectPublicRow(view,catalog,view.publicationEpoch))return null;
    return {providerId,ownerUid:identity.ownerUid,published:true,suspended:false,ownerActive:true,generation:generation.value,services:[...publication.services]};
   }
   const tx={getEnquiryActor:actor,getPublishedProvider:provider,
    async getParticipantBlocks(buyerUid,providerUid){const a=await get(ref(c,'blocks',enquiryBlockKey(buyerUid,providerUid))),b=await get(ref(c,'blocks',enquiryBlockKey(providerUid,buyerUid)));return a?.blockerUid===buyerUid&&a.blockedUid===providerUid&&typeof a.blocked==='boolean'&&b?.blockerUid===providerUid&&b.blockedUid===buyerUid&&typeof b.blocked==='boolean'?{buyerBlocked:a.blocked,providerBlocked:b.blocked}:null;},
    getEnquiryReceipt:(uid,key,operation='create-provider-private-enquiry')=>get(receipt(uid,key,operation)),getEnquiryAudit:id=>get(ref(c,'audits',id)),getEnquiry:id=>get(ref(c,'enquiries',id)),
    stageEnquiry:value=>{if(mutation)throw new Error('Duplicate enquiry staging');mutation=value;},
    stageEnquiryUpdate:value=>{if(mutation)throw new Error('Duplicate enquiry staging');mutation=value;update=true;}
   };
   const result=await work(Object.freeze(tx));check();if(!mutation)return result;if(result?.ok!==true)throw new Error('Denied enquiry cannot write');
   const m=mutation,rowRef=ref(c,'enquiries',m.record.id),old=await get(rowRef),receiptRef=receipt(m.receipt.actorUid,m.receipt.requestId,m.receipt.operation),auditRef=ref(c,'audits',m.audit.id);
   if(await get(receiptRef)!==null||await get(auditRef)!==null||m.record.id!==m.receipt.enquiryId||m.record.id!==m.audit.enquiryId||m.record.providerId!==m.receipt.providerId||m.record.providerId!==m.audit.providerId||(update?(!old||old.revision!==m.record.revision-1||old.buyerUid!==m.record.buyerUid||old.providerUid!==m.record.providerUid||old.providerId!==m.record.providerId):old!==null))throw new Error('Enquiry precondition conflict');
   check();raw.set(rowRef,{...m.record,committedAt:sdk.serverTimestamp()});raw.set(receiptRef,{...m.receipt,committedAt:sdk.serverTimestamp()});raw.set(auditRef,{...m.audit,committedAt:sdk.serverTimestamp()});check();return result;
  },{maxAttempts:3});
 }});
}
