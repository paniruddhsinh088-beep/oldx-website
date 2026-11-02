// Transport-independent single-flight lifecycle. No cache, credentials, SDK or
// authorization. Each domain must validate scope and project its own safe DTO.
// Flat primitive request DTOs only; never pass private records as scope.
export function createBoundedRead({read,project,onChange,timeoutMs=5000,schedule=setTimeout,cancel=clearTimeout}) {
 if(typeof read!=='function'||typeof project!=='function'||typeof onChange!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw new TypeError('Invalid bounded read configuration');
 let revision=0,pending=null,timer=null;
 const emit=state=>onChange(Object.freeze(state));
 function stop(){if(timer!==null)cancel(timer);timer=null;}
 function invalidate(){revision++;stop();pending?.abort();pending=null;}
 return Object.freeze({
  async load(scope){
   invalidate();const version=revision,controller=new AbortController();pending=controller;
   emit({status:'loading'});let timedOut=false,abortRead;
   try{
    if(!scope||Object.getPrototypeOf(scope)!==Object.prototype||Object.values(scope).some(v=>v!==null&&!['string','number','boolean'].includes(typeof v)))throw new TypeError('Invalid read scope');
    const request=Object.freeze({...scope});
    const deadline=new Promise((resolve,reject)=>{timer=schedule(()=>{timedOut=true;controller.abort();reject(new Error('Deadline'));},timeoutMs);});
    const cancellation=new Promise((resolve,reject)=>{abortRead=()=>reject(new Error('Cancelled'));if(controller.signal.aborted)abortRead();else controller.signal.addEventListener('abort',abortRead,{once:true});});
    const response=await Promise.race([Promise.resolve().then(()=>controller.signal.aborted?undefined:read(request,{signal:controller.signal})),deadline,cancellation]);
    if(version!==revision)return;
    const snapshot=project(response,request);
    emit(snapshot?{status:'ready',snapshot}:{status:'unavailable'});
   }catch{if(version===revision)emit({status:'error',code:timedOut?'READ_TIMEOUT':'READ_FAILED'});}
   finally{if(abortRead)controller.signal.removeEventListener('abort',abortRead);if(version===revision){stop();pending=null;}}
  },
  clear(){invalidate();emit({status:'idle'});},
  revoke(){invalidate();emit({status:'unavailable'});}
 });
}
