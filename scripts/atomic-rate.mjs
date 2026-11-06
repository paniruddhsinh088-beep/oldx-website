// Server-only transaction core. Rejected actors never read the global hot document.
// Successful requests still atomically consume BOTH limits; no local leases/cache.
export async function consumeAtomicRate({sdk,db,actorRef,globalRef,actorLimit,globalLimit,expiresAtMs,context,now=Date.now}){
 const check=()=>{if(context?.signal?.aborted||!Number.isSafeInteger(context?.deadlineAt)||now()>=context.deadlineAt)throw Error('Rate stopped');};
 if(![actorLimit,globalLimit,expiresAtMs].every(n=>Number.isSafeInteger(n)&&n>0)||actorLimit>globalLimit||actorRef.path===globalRef.path)throw Error('Invalid rate bounds');
 check();return sdk.runTransaction(db,async tx=>{
  check();const actor=await tx.get(actorRef);check();const count=s=>s.exists()?s.data().count:0;
  const a=count(actor);if(!Number.isSafeInteger(a)||a<0||a>=actorLimit)return {allowed:false};
  const global=await tx.get(globalRef);check();const g=count(global);if(!Number.isSafeInteger(g)||g<0||g>=globalLimit)return {allowed:false};
  tx.set(actorRef,{count:a+1,expiresAtMs});tx.set(globalRef,{count:g+1,expiresAtMs});check();return {allowed:true};
 },{maxAttempts:3});
}
