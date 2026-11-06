import {projectServiceIntegrationResponse} from './service-integration-adapter.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {inspectSampleEnquiry} from '../features/service-providers/preview-enquiry.mjs';
const OP='create-provider-private-enquiry';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=code=>({ok:false,code});
function copy(value,keys){try{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).some(k=>typeof k!=='string')||Reflect.ownKeys(value).sort().join(',')!==[...keys].sort().join(','))return null;const out={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;}catch{return null;}}
export function inspectProviderEnquiryRequest(request){
 const input=copy(request,['requestId','providerId','expectedPublicationGeneration','service','description','timing']);
 if(!input||!id(input.requestId)||!id(input.providerId)||!Number.isSafeInteger(input.expectedPublicationGeneration)||input.expectedPublicationGeneration<1||typeof input.service!=='string'||input.service.length<1||input.service.length>80)return null;
 const checked=inspectSampleEnquiry({id:input.providerId,services:[input.service]},{service:input.service,description:input.description,timing:input.timing});
 return checked.ok?Object.freeze({...input,description:checked.value.description}):null;
}
// Inactive server command. Transaction repository must validate a fresh consistent
// provider/identity/publication/service graph, participant eligibility and blocks;
// commit private enquiry + unique receipt + minimal audit together. No HTTP/SDK.
export function createProviderEnquiryTransaction({enabled=false,authenticate,repository,allocateId=randomUUID,timeoutMs=5000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 return Object.freeze({async create(request,{credential,signal}={}){
  if(enabled!==true)return fail('UNAVAILABLE');
  const input=inspectProviderEnquiryRequest(request);if(!input)return fail('INVALID_REQUEST');
  if(typeof repository?.runTransaction!=='function')return fail('UNAVAILABLE');
  const normalized=inspectSampleEnquiry({id:input.providerId,services:[input.service]},{service:input.service,description:input.description,timing:input.timing}).value;
  return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,schedule,cancel,run:async context=>{
   const actorUid=context.actorUid,fingerprint=hash([OP,actorUid,input.providerId,input.expectedPublicationGeneration,normalized]),auditId=hash([OP,actorUid,input.requestId]);let expected;
   context.markMutationAttempted();
   const result=await repository.runTransaction(async tx=>{
    context.checkpoint();const actor=copy(await tx.getEnquiryActor(actorUid),['uid','canEnquire','suspended']);context.checkpoint();if(!actor||actor.uid!==actorUid||actor.canEnquire!==true||actor.suspended!==false)return expected=fail('DENIED');
    const canonical=copy(await tx.getPublishedProvider(input.providerId),['providerId','ownerUid','published','suspended','ownerActive','generation','services']);context.checkpoint();
    if(!canonical||canonical.providerId!==input.providerId||!id(canonical.ownerUid)||canonical.ownerUid===actorUid||canonical.published!==true||canonical.suspended!==false||canonical.ownerActive!==true||!Number.isSafeInteger(canonical.generation)||canonical.generation<1||!Array.isArray(canonical.services)||canonical.services.length<1||canonical.services.length>12||!canonical.services.every(v=>typeof v==='string'&&v.length>0&&v.length<=80)||new Set(canonical.services).size!==canonical.services.length||!canonical.services.includes(input.service))return expected=fail('UNAVAILABLE');
    const blocks=copy(await tx.getParticipantBlocks(actorUid,canonical.ownerUid),['buyerBlocked','providerBlocked']);context.checkpoint();if(!blocks||blocks.buyerBlocked!==false||blocks.providerBlocked!==false)return expected=fail('DENIED');
    const existing=await tx.getEnquiryReceipt(actorUid,input.requestId);context.checkpoint();
    if(existing!==null){const receipt=copy(existing,['operation','actorUid','requestId','providerId','enquiryId','fingerprint','auditId']);if(!receipt||receipt.operation!==OP||receipt.actorUid!==actorUid||receipt.requestId!==input.requestId||receipt.providerId!==input.providerId||!id(receipt.enquiryId)||receipt.fingerprint!==fingerprint||receipt.auditId!==auditId)return expected=fail('IDEMPOTENCY_CONFLICT');
     const audit=copy(await tx.getEnquiryAudit(auditId),['id','operation','actorUid','providerId','enquiryId','requestId']);const row=await tx.getEnquiry(receipt.enquiryId);context.checkpoint();
     if(!audit||audit.id!==auditId||audit.operation!==OP||audit.actorUid!==actorUid||audit.providerId!==input.providerId||audit.enquiryId!==receipt.enquiryId||audit.requestId!==input.requestId||row?.buyerUid!==actorUid||row?.providerUid!==canonical.ownerUid||row?.providerId!==input.providerId||row?.id!==receipt.enquiryId)return expected=fail('CONFLICT');return expected={ok:true,status:'replayed',enquiryId:receipt.enquiryId};}
    if(canonical.generation!==input.expectedPublicationGeneration)return expected=fail('PUBLICATION_CONFLICT');
    const enquiryId=allocateId();if(!id(enquiryId)||await tx.getEnquiry(enquiryId)!==null)return expected=fail('CONFLICT');context.checkpoint();
    await tx.stageEnquiry({record:{id:enquiryId,providerId:canonical.providerId,providerUid:canonical.ownerUid,buyerUid:actorUid,service:normalized.service,note:normalized.description,timing:normalized.timing,status:'new',revision:0,reply:'',buyerConfirmed:false,publicationGeneration:canonical.generation},receipt:{operation:OP,actorUid,requestId:input.requestId,providerId:canonical.providerId,enquiryId,fingerprint,auditId},audit:{id:auditId,operation:OP,actorUid,providerId:canonical.providerId,enquiryId,requestId:input.requestId}});context.checkpoint();return expected={ok:true,status:'created',enquiryId};
   },{signal:context.signal,deadlineAt:context.deadlineAt});
   const safe=expected&&copy(result,Object.keys(expected));if(!safe||Object.keys(expected).some(key=>safe[key]!==expected[key]))throw new Error('Invalid enquiry acknowledgement');return safe;
  }});
 }});
}

// Private read mapping into the existing enquiry DTO/model; actor role is derived
// from verified UID, never a request role. Server-only business projection; public reads
// must use the block-gated wrapper below. Notification policy checks both real edges.
export function projectProviderEnquiryParticipant(request,canonical,record,actorUid,{enabled=false}={}){
 if(enabled!==true||!id(actorUid))return fail('UNAVAILABLE');
 const c=copy(canonical,['providerId','ownerUid','published','suspended','ownerActive','generation','services']);
 const r=copy(record,['id','providerId','providerUid','buyerUid','service','note','timing','status','revision','reply','buyerConfirmed','publicationGeneration']);
 if(!c||!r||!id(c.ownerUid)||!id(r.buyerUid)||r.buyerUid===c.ownerUid||r.providerUid!==c.ownerUid||r.providerId!==c.providerId||c.published!==true||c.suspended!==false||c.ownerActive!==true||!Number.isSafeInteger(c.generation)||c.generation<r.publicationGeneration||!Number.isSafeInteger(r.publicationGeneration)||r.publicationGeneration<1||!['flexible','this-week'].includes(r.timing))return fail('UNAVAILABLE');
 const actor=actorUid===r.buyerUid?{role:'buyer',id:actorUid}:actorUid===c.ownerUid?{role:'provider',id:c.providerId}:null;if(!actor)return fail('DENIED');
 const context={provider:{id:c.providerId,published:true,services:c.services},records:[{id:r.id,providerId:r.providerId,buyerId:r.buyerUid,service:r.service,note:r.note,status:r.status,revision:r.revision,reply:r.reply,buyerConfirmed:r.buyerConfirmed}]};
 return projectServiceIntegrationResponse(request,{providerId:c.providerId,revision:r.revision,published:true,context},actor,{enabled:true});
}

// All existing public read callers retain the original two-edge deny-by-default gate.
export function projectProviderEnquiryRead(request,canonical,record,blocks,actorUid,options={}){const b=copy(blocks,['buyerBlocked','providerBlocked']);if(!b||b.buyerBlocked!==false||b.providerBlocked!==false)return fail('UNAVAILABLE');return projectProviderEnquiryParticipant(request,canonical,record,actorUid,options);}
