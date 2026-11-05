import {createStagingProviderMediaModeration} from './provider-media-moderation.mjs';
import {parseBoundedJson} from './bounded-json.mjs';
import {createHash} from 'node:crypto';
import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createPrivateConversationHttp} from './product-conversation-http.mjs';
import {createStagingProviderMediaRuntime} from './staging-media-provider-runtime.mjs';
import {createStagingProviderPhotoReferenceRepository,createStagingProviderOwnerPhotoRead} from './firebase-photo-reference-repository.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {imageContentType} from '../features/media/mandatory-photos.mjs';
const fail=()=>({status:503,headers:{'Cache-Control':'private, no-store'},body:{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}}}),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const service=v=>v===null||typeof v==='string'&&v.length>0&&v.length<=80;
const keys={moderate:['requestId','imageId','expectedAssetRevision','expectedReviewRevision','decision'],upload:['requestId','kind','parentId','service','expectedParentRevision','byteSize','contentType','count'],references:['requestId','kind','parentId','service','expectedParentRevision','expectedPhotoRevision','imageIds'],ownerPhotos:['kind','parentId','service','expectedParentRevision'],status:['requestId','kind','parentId','service'],recover:['requestId','kind','parentId','service'],remove:['requestId','imageId','expectedRevision'],reconcileUpload:['requestId','imageId','expectedRevision','assetId','version'],reconcileDelete:['requestId','imageId','expectedRevision']};
function project(op,v){
 if(op==='moderate'){const r=copyRecord(v,['ok','status','reviewRevision']);return r?.ok===true&&['reviewed','replayed'].includes(r.status)&&Number.isSafeInteger(r.reviewRevision)&&r.reviewRevision>0?r:null;}
 if(op==='references'){const r=copyRecord(v,['ok','status','photoRevision']);return r?.ok===true&&['saved','replayed'].includes(r.status)&&Number.isSafeInteger(r.photoRevision)&&r.photoRevision>0?r:null;}
 if(op==='ownerPhotos'){const r=copyRecord(v,['ok','parentId','parentRevision','photoRevision','photos']);return r?.ok===true&&safeId(r.parentId)&&Number.isSafeInteger(r.parentRevision)&&r.parentRevision>0&&Number.isSafeInteger(r.photoRevision)&&r.photoRevision>=0&&Array.isArray(r.photos)&&r.photos.length<=6&&r.photos.every(p=>copyRecord(p,['kind','imageId'])&&p.kind==='managed'&&/^[A-Za-z0-9_-]{20,80}$/.test(p.imageId))?r:null;}
 const r=copyRecord(v,['ok','imageId','state','revision','parentRevision',...(Object.hasOwn(v??{},'replayed')?['replayed']:[])]);return r?.ok===true&&/^[A-Za-z0-9_-]{20,80}$/.test(r.imageId)&&Number.isSafeInteger(r.revision)&&r.revision>=0&&Number.isSafeInteger(r.parentRevision)&&r.parentRevision>0&&(op==='status'?['reserved','uploading','quarantined','attached','deleting','deleted','cancelled']:['quarantined','attached','deleted']).includes(r.state)&&(r.replayed===undefined||r.replayed===true)?r:null;
}
// Operational host SOURCE only. No route installation, app initialization or
// default provider. providerPorts MUST be reviewed signed/independently inspected
// SERVER bindings; request JSON cannot choose them or receive a signature/secret.
export function createStagingProviderMediaHttp({enabled=false,binding,verifyFirebaseToken,consumeRateLimit,providerPorts={},publicMedia,timeoutMs=5000,now=Date.now,emulatorTokenSyntax=false}={}){
 if(enabled!==true)return Object.freeze({upload:async()=>fail(),command:async()=>fail()});const b=requireStagingMarketplaceBinding(binding),{sdk,db}=b,c=b.providerCollections,j=b.journalCollections;
 const options={enabled:true,verifyFirebaseToken,consumeRateLimit,timeoutMs,now,emulatorTokenSyntax};
 function handler(operation,source){return createPrivateConversationHttp({...options,contract:{prefix:'provider.media.',keys,mutations:Object.keys(keys).filter(op=>!['status','ownerPhotos'].includes(op)),projection:project},createRepository:scope=>{
  const runtime=createStagingProviderMediaRuntime({...providerPorts,enabled:true,binding:b,authenticate:scope.authenticate,timeoutMs:scope.timeoutMs,now}),references=createStagingProviderPhotoReferenceRepository({enabled:true,binding:b,authenticate:scope.authenticate,now});
  const status=async(input,{signal}={})=>{if(input.kind!=='provider'||!safeId(input.parentId)||!safeId(input.requestId)||!service(input.service))return {ok:false,code:'INVALID_REQUEST'};const {uid}=await scope.authenticate();return sdk.runTransaction(db,async tx=>{
   const get=async(collection,id)=>{if(signal?.aborted)throw Error('Cancelled');const s=await tx.get(sdk.doc(db,collection,id));return s.exists()?s.data():null;},key=hash([uid,'reserve',input.requestId]),r=await get(j.operations,key),audit=await get(j.audits,key);
   if(!r||r.actorUid!==uid||r.operation!=='reserve'||!safeId(r.imageId)||audit?.requestKey!==key||audit.actorUid!==uid||audit.imageId!==r.imageId)return {ok:false,code:'DENIED'};
   const a=await get(j.assets,r.imageId),actor=await get(c.actors,uid),p=await get(c.drafts,input.parentId),identity=await get(c.identities,input.parentId),owner=await get(c.owners,uid);
   if(a?.ownerUid!==uid||a.kind!=='provider'||a.parentId!==input.parentId||a.service!==input.service||p?.ownerUid!==uid||p.providerId!==input.parentId||actor?.uid!==uid||actor.canWrite!==true||actor.suspended!==false||identity?.providerId!==input.parentId||identity.ownerUid!==uid||owner?.providerId!==input.parentId||owner.ownerUid!==uid||owner.revision!==p.revision||!['draft','published'].includes(owner.status))return {ok:false,code:'DENIED'};
   return {ok:true,imageId:a.imageId,state:a.state,revision:a.revision,parentRevision:a.parentRevision};
  },{maxAttempts:3});};
  return {moderate:(r,ctx)=>createStagingProviderMediaModeration({enabled:true,binding:b,authenticate:scope.authenticate}).decide(r,ctx),references:(r,ctx)=>references.apply(r,ctx),ownerPhotos:createStagingProviderOwnerPhotoRead({enabled:true,binding:b,authenticate:scope.authenticate,now}),status,
   async upload(r,ctx){if(r.kind!=='provider'||!service(r.service)||!safeId(r.requestId)||!safeId(r.parentId)||!Number.isSafeInteger(r.expectedParentRevision)||r.expectedParentRevision<1||!(source instanceof Uint8Array)||source.length<1||source.length>2*1024*1024||r.byteSize!==source.length||r.count!==1||imageContentType(source)!==r.contentType)return {ok:false,code:'INVALID_REQUEST'};
    if(typeof providerPorts.processor?.decodeAndReencode!=='function'||typeof providerPorts.createUploadProvider!=='function')return {ok:false,code:'ENFORCEMENT_UNAVAILABLE'};
    const reserved=await runtime.journal.reserve({requestId:r.requestId,kind:'provider',parentId:r.parentId,service:r.service,expectedParentRevision:r.expectedParentRevision,sourceDigest:createHash('sha256').update(source).digest('hex'),reservedBytes:2*1024*1024},ctx);if(!reserved.ok)return reserved;
    const attempted=await runtime.journal.transition('attempt',{requestId:r.requestId,imageId:reserved.imageId,expectedRevision:reserved.revision,proof:null},ctx);return attempted.ok?runtime.upload({requestId:r.requestId,imageId:reserved.imageId,expectedRevision:attempted.revision},source,ctx):attempted;
   },async recover(r,ctx){const current=await status(r,ctx);if(!current.ok||['quarantined','attached'].includes(current.state))return current;if(current.state!=='uploading')return {ok:false,code:'OUTCOME_UNKNOWN'};return runtime.reconcileUpload({requestId:r.requestId,imageId:current.imageId,expectedRevision:current.revision},null,ctx);},
   async remove(r,ctx){const lease=await runtime.journal.transition('lease-delete',{...r,proof:null},ctx);return lease.ok?runtime.remove({...r,expectedRevision:lease.revision},ctx):lease;},reconcileUpload:({assetId,version,...r},ctx)=>runtime.reconcileUpload(r,{assetId,version},ctx),reconcileDelete:(r,ctx)=>runtime.reconcileDelete(r,ctx)};
 }});}
 return Object.freeze({upload(request,bytes,context){const source=bytes instanceof Uint8Array&&bytes.length<=2*1024*1024?new Uint8Array(bytes):null;return handler('upload',source).handle('upload',request,context);},async command(operation,request,context){
 if(['photos','photo'].includes(operation)){if(!publicMedia||request?.method!=='POST'||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request?.headers?.['content-type']??''))return fail();const parsed=parseBoundedJson(request.body,{maxBytes:2048});if(!parsed.ok)return fail();const result=await publicMedia[operation==='photos'?'manifest':'bytes'](parsed.value,context);return result?.ok===true?operation==='photo'?{status:200,headers:result.headers,bytes:result.bytes}:{status:200,headers:{'Cache-Control':'no-store'},body:result}:fail();}
 return handler(operation).handle(operation,request,context);
},publicMedia});
}
