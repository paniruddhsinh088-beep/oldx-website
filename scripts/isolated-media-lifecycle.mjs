import {createHash} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {getSurfacePolicy,validateProcessedImage} from './image-upload-contract-policy.mjs';
const MAX_PROXY_BYTES=3*1024*1024;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const imageId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{20,80}$/.test(v);
const fail=code=>({ok:false,code});
function exact(value,keys){try{if(!value||Object.getPrototypeOf(value)!==Object.prototype)return false;const own=Reflect.ownKeys(value);return own.every(key=>typeof key==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))&&own.sort().join(',')===[...keys].sort().join(',');}catch{return false;}}
// Test-only injected lifecycle, no Cloudinary/Firebase client, URL, secret or
// network implementation. Existing image data and browser uploads are untouched.
export function createIsolatedMediaLifecycle({enabled=false,mode,authenticate,authorize,journal,processor,provider,timeoutMs=5000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 const active=enabled===true&&mode==='isolated-test';
 const run=(credential,signal,work)=>runVerifiedOperation({authenticate,credential,signal,run:work,timeoutMs,now,schedule,cancel});
 return Object.freeze({
  async upload(request,bytes,{credential,signal}={}){
   if(!active)return fail('UNAVAILABLE');
   if(!exact(request,['requestId','surface','parentId'])||!id(request.requestId)||!id(request.parentId)||!getSurfacePolicy(request.surface)||!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>Math.min(MAX_PROXY_BYTES,getSurfacePolicy(request.surface).maxBytes))return fail('INVALID_IMAGE_REQUEST');
   if(typeof authorize!=='function'||!['reserveUpload','rejectLease','markUploadAttempt','attachQuarantined'].every(key=>typeof journal?.[key]==='function')||typeof processor?.decodeAndReencode!=='function'||typeof provider?.uploadProcessed!=='function'||typeof provider?.verifyUploadResult!=='function')return fail('UNAVAILABLE');
   const input={...request},source=new Uint8Array(bytes),digest=createHash('sha256').update(source).digest('hex'),reservedBytes=Math.min(MAX_PROXY_BYTES,getSurfacePolicy(input.surface).maxBytes);
   return run(credential,signal,async context=>{
    const scope={actorUid:context.actorUid,surface:input.surface,parentId:input.parentId};
    if(await authorize({...scope,action:'upload'},context)!==true)return fail('DENIED');context.checkpoint();context.markMutationAttempted();
    const lease=await journal.reserveUpload({...scope,requestId:input.requestId,digest,reservedBytes},context);context.checkpoint();
    if(!lease||lease.actorUid!==scope.actorUid||lease.surface!==scope.surface||lease.parentId!==scope.parentId||lease.digest!==digest||!id(lease.leaseId)||!imageId(lease.imageId)||lease.publicId!=='oldx/quarantine/'+lease.imageId||lease.quotaReserved!==true||lease.budgetKnown!==true)return fail('UPLOAD_NOT_AUTHORIZED');
    if(['quarantined','attached'].includes(lease.state))return {ok:true,state:'quarantined',imageId:lease.imageId};
    if(lease.state!=='reserved')return {ok:false,code:'OUTCOME_UNKNOWN',retrySameRequest:true};
    let processed;
    try{processed=await processor.decodeAndReencode(source,{surface:input.surface,maxBytes:reservedBytes,maxPixels:getSurfacePolicy(input.surface).maxPixels,signal:context.signal});}catch{await journal.rejectLease(lease.leaseId,scope.actorUid,context);return fail('IMAGE_REJECTED');}
    context.checkpoint();
    if(!(processed?.bytes instanceof Uint8Array)||processed.bytes.byteLength>reservedBytes||processed.metadataStripped!==true||processed.contentScanned!==true||!validateProcessedImage({surface:input.surface,contentType:processed.contentType,byteSize:processed.bytes.byteLength,width:processed.width,height:processed.height,fileCount:1}).ok){await journal.rejectLease(lease.leaseId,scope.actorUid,context);return fail('IMAGE_REJECTED');}
    if(await authorize({...scope,action:'upload'},context)!==true){await journal.rejectLease(lease.leaseId,scope.actorUid,context);return fail('DENIED');}context.checkpoint();
    if(await journal.markUploadAttempt(lease.leaseId,scope.actorUid,context)!==true)return fail('CONFLICT');context.checkpoint();
    const response=await provider.uploadProcessed({bytes:new Uint8Array(processed.bytes),publicId:lease.publicId,resourceType:'image',deliveryType:'authenticated',overwrite:false},context);context.checkpoint();
    if(await provider.verifyUploadResult(response,{publicId:lease.publicId,deliveryType:'authenticated',byteSize:processed.bytes.byteLength},context)!==true||!id(response?.assetId))throw new Error('Unconfirmed provider upload');
    if(await journal.attachQuarantined({leaseId:lease.leaseId,actorUid:scope.actorUid,imageId:lease.imageId,assetId:response.assetId,publicId:lease.publicId,byteSize:processed.bytes.byteLength,digest},context)!==true)throw new Error('Unconfirmed quarantine attachment');context.checkpoint();
    return {ok:true,state:'quarantined',imageId:lease.imageId};
   });
  },
  async remove(request,{credential,signal}={}){
   if(!active)return fail('UNAVAILABLE');
   if(!exact(request,['requestId','imageId'])||!id(request.requestId)||!imageId(request.imageId))return fail('INVALID_IMAGE_REQUEST');
   if(typeof authorize!=='function'||!['reserveDelete','confirmDeleteLease','completeDelete'].every(key=>typeof journal?.[key]==='function')||typeof provider?.destroy!=='function')return fail('UNAVAILABLE');
   const input={...request};return run(credential,signal,async context=>{
    context.markMutationAttempted();const lease=await journal.reserveDelete({actorUid:context.actorUid,...input},context);context.checkpoint();
    if(!lease||lease.actorUid!==context.actorUid||lease.imageId!==input.imageId||!id(lease.leaseId)||!id(lease.assetId)||!id(lease.parentId)||!getSurfacePolicy(lease.surface)||lease.publicId!=='oldx/quarantine/'+input.imageId||lease.managed!==true||lease.references!==0||lease.published!==false)return fail('DENIED');
    if(lease.state==='deleted')return {ok:true,state:'deleted',imageId:input.imageId};
    if(lease.state!=='deleting'||await authorize({actorUid:context.actorUid,surface:lease.surface,parentId:lease.parentId,action:'delete'},context)!==true||await journal.confirmDeleteLease(lease.leaseId,context.actorUid,context)!==true)return fail('DENIED');context.checkpoint();
    const response=await provider.destroy({assetId:lease.assetId,publicId:lease.publicId,resourceType:'image',deliveryType:'authenticated',invalidate:true},context);context.checkpoint();
    if(!['ok','not found'].includes(response?.result)||await journal.completeDelete(lease.leaseId,context.actorUid,context)!==true)throw new Error('Unconfirmed provider deletion');
    return {ok:true,state:'deleted',imageId:input.imageId};
   });
  }
 });
}
