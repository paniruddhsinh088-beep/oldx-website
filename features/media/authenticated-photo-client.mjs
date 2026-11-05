const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const failed=code=>({ok:false,code});
const scopeOf=v=>v&&id(v.uid)&&id(v.sessionId)&&id(v.parentId)&&Number.isSafeInteger(v.revision)&&v.revision>0?{uid:v.uid,sessionId:v.sessionId,parentId:v.parentId,revision:v.revision}:null;
// Browser/Capacitor-neutral injected transport. No fetch, SDK, token persistence,
// provider signatures or production routes. Server remains the authorization boundary.
export function createAuthenticatedPhotoClient({enabled=false,getToken,sendUpload,sendCommand}={}){
 let scope=null,epoch=0;const pending=new Set(),requests=new Set();
 const same=(r,s)=>s&&['product','store'].includes(r?.kind)&&id(r.requestId)&&r.parentId===s.parentId&&r.expectedParentRevision===s.revision;
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
  const result=await sendCommand('status',{requestId:r.requestId,kind:r.kind,parentId:r.parentId},auth);if(!current())return failed('CANCELLED');
  const v=result?.body;
  if(result?.status===200&&v?.ok===true&&v.parentRevision===r.expectedParentRevision&&v.state==='quarantined'&&/^[A-Za-z0-9_-]{20,80}$/.test(v.imageId))return {ok:true,state:'quarantined',imageId:v.imageId};
  if(result?.status===200&&v?.ok===true&&v.state==='reserved'&&v.parentRevision===r.expectedParentRevision)return failed('RESERVED');
  return failed(result?.status===401||result?.status===403?'DENIED':'OUTCOME_UNKNOWN');
 }
 return Object.freeze({
  setScope(value){const next=scopeOf(value);if(JSON.stringify(next)!==JSON.stringify(scope)){epoch++;for(const controller of requests)controller.abort();requests.clear();pending.clear();scope=next;}},
  recover:(r,context={})=>run(r,context,(auth,current)=>status(r,auth,current)),
  upload(r,context={}){return run(r,context,async(auth,current)=>{
   if(typeof sendUpload!=='function'||!(r.bytes instanceof Uint8Array)||r.bytes.length<1||r.bytes.length>3*1024*1024)return failed('INVALID_IMAGE');
   if(pending.has(r.requestId)){const restored=await status(r,auth,current);if(restored.ok||restored.code!=='RESERVED'){if(restored.ok)pending.delete(r.requestId);return restored;}}
   if(!current()||pending.size>=6&&!pending.has(r.requestId))return failed('UNAVAILABLE');pending.add(r.requestId);
   context.onProgress?.(0);
   const intent={requestId:r.requestId,kind:r.kind,parentId:r.parentId,expectedParentRevision:r.expectedParentRevision,contentType:r.contentType,byteSize:r.bytes.length,count:1};
   const response=await sendUpload(intent,new Uint8Array(r.bytes),auth);if(!current())return failed('CANCELLED');
   const value=response?.body;
   if(response?.status===200&&value?.ok===true&&value.state==='quarantined'&&value.parentRevision===r.expectedParentRevision&&/^[A-Za-z0-9_-]{20,80}$/.test(value.imageId)){pending.delete(r.requestId);context.onProgress?.(100);return {ok:true,state:'quarantined',imageId:value.imageId};}
   return failed(response?.status===401||response?.status===403?'DENIED':'OUTCOME_UNKNOWN');
  });}
 });
}
