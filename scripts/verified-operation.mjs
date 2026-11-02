// Server-only injected verification/deadline boundary. No identity provider or
// SDK. authenticate must verify credentials, revocation and required policy.
export async function runVerifiedOperation({authenticate,credential,signal,run,timeoutMs=5000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}){
 if(typeof authenticate!=='function'||typeof run!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)return {ok:false,code:'UNAVAILABLE'};
 if(signal?.aborted)return {ok:false,code:'CANCELLED'};
 const controller=new AbortController(),deadlineAt=now()+timeoutMs;let attempted=false,timer=null,reason=null,stop;
 const outcome=code=>attempted?{ok:false,code:'OUTCOME_UNKNOWN',retrySameRequest:true}:{ok:false,code};
 const checkpoint=()=>{if(controller.signal.aborted||now()>=deadlineAt)throw new Error('Operation stopped');};
 const stopped=new Promise((resolve,reject)=>{stop=why=>{reason=why;controller.abort();reject(new Error('Operation stopped'));};timer=schedule(()=>stop('DEADLINE_EXCEEDED'),timeoutMs);});
 const abort=()=>stop('CANCELLED');signal?.addEventListener('abort',abort,{once:true});
 let authenticated=false;
 try{
  const work=Promise.resolve().then(async()=>{
   checkpoint();const identity=await authenticate(credential,{signal:controller.signal,deadlineAt});checkpoint();
   const descriptor=identity&&typeof identity==='object'?Object.getOwnPropertyDescriptor(identity,'uid'):null;
   if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(descriptor.value))throw new Error('Unverified identity');
   authenticated=true;
   return run(Object.freeze({actorUid:descriptor.value,signal:controller.signal,deadlineAt,checkpoint,markMutationAttempted(){checkpoint();attempted=true;}}));
  });
  return await Promise.race([work,stopped]);
 }catch{
  return outcome(reason??(now()>=deadlineAt?'DEADLINE_EXCEEDED':authenticated?'UNAVAILABLE':'AUTH_REQUIRED'));
 }finally{if(timer!==null)cancel(timer);signal?.removeEventListener('abort',abort);}
}
