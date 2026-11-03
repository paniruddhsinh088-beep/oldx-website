import {runVerifiedOperation} from './verified-operation.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
const limits={product:3*1024*1024,store:3*1024*1024,provider:2*1024*1024};
// Inactive bridge to the existing quota/lease/quarantine lifecycle. No provider,
// SDK, credentials, URL upload, moderation claim or endpoint is constructed.
export function createMandatoryPhotoUpload({enabled=false,authenticate,readOwnedParent,createLifecycle,timeoutMs=10000}={}){
 return Object.freeze({async upload(request,{credential,signal}={}){
  if(!enabled)return {ok:false,code:'UNAVAILABLE'};
  const r=copyRecord(request,['requestId','kind','parentId','expectedParentRevision','contentType','bytes']);
  if(!r||!Object.hasOwn(limits,r.kind)||!safeId(r.requestId)||!safeId(r.parentId)||!Number.isSafeInteger(r.expectedParentRevision)||r.expectedParentRevision<1||!['image/jpeg','image/png','image/webp'].includes(r.contentType)||!(r.bytes instanceof Uint8Array)||r.bytes.length<1||r.bytes.length>limits[r.kind])return {ok:false,code:'INVALID_IMAGE'};
  if(typeof readOwnedParent!=='function'||typeof createLifecycle!=='function')return {ok:false,code:'UNAVAILABLE'};
  const input={...r,bytes:new Uint8Array(r.bytes)};
  return runVerifiedOperation({authenticate,credential,signal,timeoutMs,run:async context=>{
   async function current(){const p=copyRecord(await readOwnedParent({kind:input.kind,parentId:input.parentId,actorUid:context.actorUid},context),['kind','id','ownerUid','revision','suspended']);context.checkpoint();return p?.kind===input.kind&&p.id===input.parentId&&p.ownerUid===context.actorUid&&p.revision===input.expectedParentRevision&&p.suspended===false;}
   if(!await current())return {ok:false,code:'DENIED'};
   const lifecycle=createLifecycle({authenticate:()=>({uid:context.actorUid})});if(typeof lifecycle?.upload!=='function')return {ok:false,code:'UNAVAILABLE'};
   context.markMutationAttempted();const result=await lifecycle.upload({requestId:input.requestId,surface:input.kind==='provider'?'profile':input.kind,parentId:input.parentId},input.bytes,{signal:context.signal});context.checkpoint();
   if(!await current())return {ok:false,code:'REVISION_CONFLICT'};
   const value=copyRecord(result,['ok','state','imageId']);if(value?.ok!==true||value.state!=='quarantined'||typeof value.imageId!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(value.imageId))return {ok:false,code:result?.code==='OUTCOME_UNKNOWN'?'OUTCOME_UNKNOWN':'UPLOAD_UNAVAILABLE'};
   return value;
  }});
 }});
}
