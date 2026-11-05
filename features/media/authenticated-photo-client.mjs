import {isManagedPhoto} from './mandatory-photos.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const failed=code=>({ok:false,code});
const scopeOf=v=>v&&id(v.uid)&&id(v.sessionId)&&id(v.parentId)&&Number.isSafeInteger(v.revision)&&v.revision>0?{uid:v.uid,sessionId:v.sessionId,parentId:v.parentId,revision:v.revision}:null;
// Browser/Capacitor-neutral injected transport. No fetch, SDK, token persistence,
// provider signatures or production routes. Server remains the authorization boundary.
function photoClient({enabled=false,getToken,sendUpload,sendCommand}={},provider=false){
 let scope=null,epoch=0;const pending=new Set(),requests=new Set();
 const same=(r,s)=>s&&(provider?r?.kind==='provider'&&(r.service===null||typeof r.service==='string'&&r.service.length>0&&r.service.length<=80):['product','store'].includes(r?.kind))&&id(r.requestId)&&r.parentId===s.parentId&&r.expectedParentRevision===s.revision;
 async function run(input,context,work){
  if(enabled!==true||!same(input,scope)||typeof getToken!=='function'||context?.signal?.aborted)return failed('UNAVAILABLE');
  const version=epoch,parent={...scope},controller=new AbortController(),abort=()=>controller.abort();requests.add(controller);context?.signal?.addEventListener('abort',abort,{once:true});
  try{
   const identity=await getToken(parent,{signal:controller.signal}),token=identity?.token;if(identity?.uid!==parent.uid||identity?.sessionId!==parent.sessionId||typeof token!=='string'||token.length<1||token.length>8192||version!==epoch||controller.signal.aborted)return failed('AUTH_REQUIRED');
   const current=()=>version===epoch&&!controller.signal.aborted;
   const result=await work({credential:token,signal:controller.signal},current);return current()?result:failed('CANCELLED');
  }catch{return failed('OUTCOME_UNKNOWN');}finally{requests.delete(controller);context?.signal?.removeEventListener('abort',abort);}
 }
 async function status(r,auth,current){
  if(typeof sendCommand!=='function')return failed('UNAVAILABLE');
  const result=await sendCommand('status',{requestId:r.requestId,kind:r.kind,parentId:r.parentId,...(provider?{service:r.service}:{})},auth);if(!current())return failed('CANCELLED');
  const v=result?.body;
  if(result?.status===200&&v?.ok===true&&v.parentRevision===r.expectedParentRevision&&v.state==='quarantined'&&/^[A-Za-z0-9_-]{20,80}$/.test(v.imageId))return {ok:true,state:'quarantined',imageId:v.imageId};
  if(result?.status===200&&v?.ok===true&&v.state==='reserved'&&v.parentRevision===r.expectedParentRevision)return failed('RESERVED');
  if(result?.status===200&&v?.ok===true&&v.state==='uploading'&&v.parentRevision===r.expectedParentRevision)return failed('PENDING');
  return failed(result?.status===401||result?.status===403?'DENIED':'OUTCOME_UNKNOWN');
 }
 async function recoverStatus(r,auth,current){
  const value=await status(r,auth,current);if(value.code!=='PENDING')return value;
  const result=await sendCommand('recover',{requestId:r.requestId,kind:r.kind,parentId:r.parentId,...(provider?{service:r.service}:{})},auth);if(!current())return failed('CANCELLED');
  const v=result?.body;return result?.status===200&&v?.ok===true&&v.state==='quarantined'&&v.parentRevision===r.expectedParentRevision&&/^[A-Za-z0-9_-]{20,80}$/.test(v.imageId)?{ok:true,state:'quarantined',imageId:v.imageId}:failed('OUTCOME_UNKNOWN');
 }
 return Object.freeze({
  setScope(value){const next=scopeOf(value);if(JSON.stringify(next)!==JSON.stringify(scope)){epoch++;for(const controller of requests)controller.abort();requests.clear();pending.clear();scope=next;}},
  ownerReferences(r,context={}){return run({...r,requestId:'owner-photos'},context,async(auth,current)=>{
   if(typeof sendCommand!=='function')return failed('UNAVAILABLE');const response=await sendCommand('ownerPhotos',{kind:r.kind,parentId:r.parentId,expectedParentRevision:r.expectedParentRevision,...(provider?{service:r.service}:{})},auth);if(!current())return failed('CANCELLED');const v=response?.body;
   return response?.status===200&&v?.ok===true&&v.parentId===r.parentId&&v.parentRevision===r.expectedParentRevision&&Number.isSafeInteger(v.photoRevision)&&v.photoRevision>=0&&Array.isArray(v.photos)&&v.photos.length<=(r.kind==='store'||provider&&r.service===null?1:6)&&v.photos.every(isManagedPhoto)?{ok:true,photos:v.photos.map(p=>({...p})),photoRevision:v.photoRevision}:failed('UNAVAILABLE');
  });},
  references(r,context={}){return run(r,context,async(auth,current)=>{
   if(!provider||typeof sendCommand!=='function'||!Number.isSafeInteger(r.expectedPhotoRevision)||r.expectedPhotoRevision<0||!Array.isArray(r.imageIds)||r.imageIds.length>(r.service===null?1:6)||new Set(r.imageIds).size!==r.imageIds.length||r.imageIds.some(v=>!isManagedPhoto({kind:'managed',imageId:v})))return failed('INVALID_REQUEST');
   const body={requestId:r.requestId,kind:r.kind,parentId:r.parentId,service:r.service,expectedParentRevision:r.expectedParentRevision,expectedPhotoRevision:r.expectedPhotoRevision,imageIds:[...r.imageIds]},response=await sendCommand('references',body,auth);if(!current())return failed('CANCELLED');const v=response?.body;return response?.status===200&&v?.ok===true&&['saved','replayed'].includes(v.status)&&Number.isSafeInteger(v.photoRevision)&&v.photoRevision>0?{ok:true,photoRevision:v.photoRevision}:failed(response?.status===409?'CONFLICT':response?.status===401||response?.status===403?'DENIED':'OUTCOME_UNKNOWN');
  });},
  recover:(r,context={})=>run(r,context,(auth,current)=>recoverStatus(r,auth,current)),
  upload(r,context={}){return run(r,context,async(auth,current)=>{
   if(typeof sendUpload!=='function'||!(r.bytes instanceof Uint8Array)||r.bytes.length<1||r.bytes.length>(provider?2:3)*1024*1024)return failed('INVALID_IMAGE');
   if(pending.has(r.requestId)){const restored=await recoverStatus(r,auth,current);if(restored.ok||restored.code!=='RESERVED'){if(restored.ok)pending.delete(r.requestId);return restored;}}
   if(!current()||pending.size>=6&&!pending.has(r.requestId))return failed('UNAVAILABLE');pending.add(r.requestId);
   context.onProgress?.(0);
   const intent={requestId:r.requestId,kind:r.kind,parentId:r.parentId,expectedParentRevision:r.expectedParentRevision,contentType:r.contentType,byteSize:r.bytes.length,count:1,...(provider?{service:r.service}:{})};
   const response=await sendUpload(intent,new Uint8Array(r.bytes),auth);if(!current())return failed('CANCELLED');
   const value=response?.body;
   if(response?.status===200&&value?.ok===true&&value.state==='quarantined'&&value.parentRevision===r.expectedParentRevision&&/^[A-Za-z0-9_-]{20,80}$/.test(value.imageId)){pending.delete(r.requestId);context.onProgress?.(100);return {ok:true,state:'quarantined',imageId:value.imageId};}
   return failed(response?.status===401||response?.status===403?'DENIED':'OUTCOME_UNKNOWN');
  });}
 });
}

export const createAuthenticatedPhotoClient=options=>photoClient(options);
export const createAuthenticatedProviderPhotoClient=options=>photoClient(options,true);
