import {createHash} from 'node:crypto';
import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createCloudinaryUploadHttp} from './cloudinary-upload-http.mjs';
import {createPrivateConversationHttp} from './product-conversation-http.mjs';
import {createStagingMediaProviderRuntime} from './staging-media-provider-runtime.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
const failure=(status,code)=>({status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},body:{ok:false,error:{code}}});
function project(value){
 const v=copyRecord(value,['ok','imageId','state','revision','parentRevision',...(value&&Object.hasOwn(value,'replayed')?['replayed']:[])]);
 return v?.ok===true&&typeof v.imageId==='string'&&/^[A-Za-z0-9_-]{20,80}$/.test(v.imageId)&&['quarantined','deleted'].includes(v.state)&&Number.isSafeInteger(v.revision)&&v.revision>=1&&Number.isSafeInteger(v.parentRevision)&&v.parentRevision>=1&&(v.replayed===undefined||v.replayed===true)?v:null;
}
// No HTTP endpoint, SDK startup or provider defaults. Identity/rates MUST be the
// existing verified enforcement ports; providerPorts are trusted SERVER bindings.
// Product/Store only. Provider v1 canonical identity uses its separate adapter.
export function createStagingAuthenticatedMedia({enabled=false,binding,verifyFirebaseToken,consumeRateLimit,providerPorts={},timeoutMs=5000,now=Date.now,emulatorTokenSyntax=false}={}){
 if(enabled!==true)return Object.freeze({upload:async()=>failure(503,'ENFORCEMENT_UNAVAILABLE'),command:async()=>failure(503,'ENFORCEMENT_UNAVAILABLE')});
 const b=requireStagingMarketplaceBinding(binding);
 const options={enabled:true,verifyFirebaseToken,consumeRateLimit,timeoutMs,now,emulatorTokenSyntax};
 const coordinator=({authenticate,timeoutMs})=>createStagingMediaProviderRuntime({...providerPorts,enabled:true,binding:b,authenticate,timeoutMs,now});
 const readOwnedParent=async({kind,parentId,actorUid},{signal})=>{
  if(!['product','store'].includes(kind)||!safeId(parentId)||!safeId(actorUid)||signal?.aborted)return null;
  return b.sdk.runTransaction(b.db,async tx=>{
   const [parent,actor]=await Promise.all([tx.get(b.sdk.doc(b.db,b.collections.privateRecords,kind+'_'+parentId)),tx.get(b.sdk.doc(b.db,b.collections.actors,actorUid))]);
   if(signal?.aborted||!parent.exists()||!actor.exists())return null;const p=parent.data(),a=actor.data();
   if(a.uid!==actorUid||a.canWrite!==true||a.suspended!==false)return null;
   return {kind:p.kind,id:p.id,ownerUid:p.ownerUid,revision:p.revision,suspended:false};
  },{maxAttempts:3});
 };
 return Object.freeze({
  async upload(request,bytes,context={}){
   // Snapshot before any authentication/provider await; body is bounded raw JSON.
   if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>3*1024*1024)return failure(400,'INVALID_REQUEST');
   const source=new Uint8Array(bytes),sourceDigest=createHash('sha256').update(source).digest('hex');let outcome;
   const preflight=createCloudinaryUploadHttp({...options,readOwnedParent,performAuthorizedUpload:async(input,{signal,timeoutMs})=>{
    if(!['product','store'].includes(input.kind)||input.byteSize!==source.length||input.count!==1)return {ok:false,code:'INVALID_REQUEST'};
    const runtime=coordinator({authenticate:async()=>({uid:input.actorUid}),timeoutMs}),operationOptions={signal};
    const reserved=await runtime.journal.reserve({requestId:input.requestId,kind:input.kind,parentId:input.parentId,service:null,expectedParentRevision:input.expectedParentRevision,sourceDigest,reservedBytes:3*1024*1024},operationOptions);
    if(reserved?.ok!==true)return reserved;
    const attempt=await runtime.journal.transition('attempt',{requestId:input.requestId,imageId:reserved.imageId,expectedRevision:reserved.revision,proof:null},operationOptions);
    if(attempt?.ok!==true)return attempt;
    outcome=await runtime.upload({requestId:input.requestId,imageId:reserved.imageId,expectedRevision:attempt.revision},source,operationOptions);return outcome;
   }});
   const response=await preflight.handle('authorize',request,context);
   if(response.status!==200)return response;const dto=project(outcome);return dto?{...response,body:dto}:failure(503,'UNAVAILABLE');
  },
  command(operation,request,context={}){
   const keys={remove:['requestId','imageId','expectedRevision'],reconcileUpload:['requestId','imageId','expectedRevision','assetId','version'],reconcileDelete:['requestId','imageId','expectedRevision']};
   const http=createPrivateConversationHttp({...options,contract:{prefix:'media.command.',keys,mutations:Object.keys(keys),projection:(_op,v)=>project(v)},createRepository:scope=>{
    const runtime=coordinator(scope);
    return {async remove(input,opts){const lease=await runtime.journal.transition('lease-delete',{...input,proof:null},opts);if(lease?.ok!==true)return lease;return runtime.remove({...input,expectedRevision:lease.revision},opts);},reconcileUpload:({assetId,version,...input},opts)=>runtime.reconcileUpload(input,{assetId,version},opts),reconcileDelete:(input,opts)=>runtime.reconcileDelete(input,opts)};
   }});
   return http.handle(operation,request,context);
  }
 });
}
