import {runVerifiedOperation} from './verified-operation.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
const unavailable=()=>({ok:false,code:'MEDIA_UNAVAILABLE'});
const positive=v=>Number.isSafeInteger(v)&&v>0;
const imageId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{20,80}$/.test(v);
function format(bytes,type){
 if(type==='image/webp')return bytes.length>=12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP';
 if(type==='image/jpeg')return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==='image/png')return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 return false;
}
// Product/Store only; Provider must use its separate canonical v1 sidecar.
// Server-only, no URL/signature/fetch. Trusted reader must fetch the EXACT approved
// derivative/version with authenticated transport and enforce maxBytes while reading.
// Rate port must enforce global/edge quotas using server-derived scope, not client identity.
// Magic checks are defense in depth, not a substitute for trusted decoding/review.
export function createApprovedMediaByteDelivery({enabled=false,contract,readApprovedDerivative,consumeRateLimit,timeoutMs=5000}={}){
 return Object.freeze({async read(request,{signal}={}){
  if(enabled!==true||typeof readApprovedDerivative!=='function'||typeof consumeRateLimit!=='function')return unavailable();
  const r=copyRecord(request,['kind','parentId','expectedParentRevision','expectedPhotoRevision','imageId']);
  if(!r||!['product','store'].includes(r.kind)||!safeId(r.parentId)||!positive(r.expectedParentRevision)||!positive(r.expectedPhotoRevision)||!imageId(r.imageId))return unavailable();
  const {imageId:requested,...scope}=r,operation='publicPhotos';
  if(typeof contract?.[operation]!=='function')return unavailable();
  const result=await runVerifiedOperation({authenticate:()=>({uid:'public-image'}),signal,timeoutMs,run:async context=>{
   async function current(){
    const v=copyRecord(await contract[operation](scope,{signal:context.signal}),['ok','parentId','parentRevision','photoRevision','photos']);context.checkpoint();
    if(!v||v.ok!==true||v.parentId!==r.parentId||v.parentRevision!==r.expectedParentRevision||v.photoRevision!==r.expectedPhotoRevision||!Array.isArray(v.photos)||v.photos.length<1||v.photos.length>(r.kind==='product'?6:1))return null;
    const rows=v.photos.map(p=>copyRecord(p,['imageId','derivativeId','version']));
    if(rows.some(p=>!p||!imageId(p.imageId)||!safeId(p.derivativeId)||!positive(p.version))||new Set(rows.map(p=>p.imageId)).size!==rows.length)return null;
    return rows.find(p=>p.imageId===requested)??null;
   }
   const rate=copyRecord(await consumeRateLimit({operation:'media.public.read'},{signal:context.signal,deadlineAt:context.deadlineAt}),['allowed']);context.checkpoint();
   if(rate?.allowed!==true)return unavailable();
   const approved=await current();if(!approved)return unavailable();
   const maxBytes=3*1024*1024;
   const response=copyRecord(await readApprovedDerivative({derivativeId:approved.derivativeId,version:approved.version,maxBytes},{signal:context.signal,deadlineAt:context.deadlineAt}),['derivativeId','version','contentType','bytes']);context.checkpoint();
   if(!response||response.derivativeId!==approved.derivativeId||response.version!==approved.version||!(response.bytes instanceof Uint8Array)||response.bytes.length<1||response.bytes.length>maxBytes||!format(response.bytes,response.contentType))return unavailable();
   const bytes=new Uint8Array(response.bytes),fresh=await current();
   if(!fresh||fresh.derivativeId!==approved.derivativeId||fresh.version!==approved.version)return unavailable();
   return {ok:true,bytes,headers:{'Content-Type':response.contentType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}};
  }});
  return result?.ok===true?result:unavailable();
 }});
}

// Separate private port: no public-media fallback and no signed provider URLs.
// Authentication and participant-bound redemption are independently revalidated.
export function createPrivateMediaByteDelivery({enabled=false,authenticate,contract,readPrivateDerivative,consumeRateLimit,timeoutMs=5000}={}){
 return Object.freeze({async read(request,{credential,signal}={}){
  const r=copyRecord(request,['token']);
  if(enabled!==true||typeof authenticate!=='function'||typeof contract?.authorizeRedemption!=='function'||typeof readPrivateDerivative!=='function'||typeof consumeRateLimit!=='function'||!r||typeof r.token!=='string'||!/^[A-Za-z0-9_.-]{20,2048}$/.test(r.token))return unavailable();
  const result=await runVerifiedOperation({authenticate,credential,signal,timeoutMs,run:async context=>{
   async function current(){
    const scope=copyRecord(await contract.authorizeRedemption(r.token,{credential,signal:context.signal}),['ok','imageId','scopeId','revision','cacheControl']);context.checkpoint();
    return scope?.ok===true&&safeId(scope.imageId)&&safeId(scope.scopeId)&&Number.isSafeInteger(scope.revision)&&scope.revision>=0&&scope.cacheControl==='private, no-store'?scope:null;
   }
   const rate=copyRecord(await consumeRateLimit({operation:'media.private.read',actorUid:context.actorUid},{signal:context.signal,deadlineAt:context.deadlineAt}),['allowed']);context.checkpoint();if(rate?.allowed!==true)return unavailable();
   const before=await current();if(!before)return unavailable();
   const response=copyRecord(await readPrivateDerivative({imageId:before.imageId,scopeId:before.scopeId,revision:before.revision,maxBytes:3*1024*1024},context),['imageId','scopeId','revision','contentType','bytes']);context.checkpoint();
   if(!response||response.imageId!==before.imageId||response.scopeId!==before.scopeId||response.revision!==before.revision||!(response.bytes instanceof Uint8Array)||response.bytes.length<1||response.bytes.length>3*1024*1024||!format(response.bytes,response.contentType))return unavailable();
   const bytes=new Uint8Array(response.bytes),after=await current();
   if(!after||after.imageId!==before.imageId||after.scopeId!==before.scopeId||after.revision!==before.revision)return unavailable();
   return {ok:true,bytes,headers:{'Content-Type':response.contentType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}};
  }});
  return result?.ok===true?result:unavailable();
 }});
}
