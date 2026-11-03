// Deterministic overlap: both first callbacks stage their writes before either
// SDK commit may start. Retry callbacks pass through; no sleeps or retry masking.
export function overlapFirstWrites(sdk,{matches=r=>r?.status==='created',participants=2}={}){
 let count=0,release;const ready=new Promise(resolve=>release=resolve);
 return {...sdk,runTransaction:(db,callback,options)=>sdk.runTransaction(db,async raw=>{
  const result=await callback(raw);if(count<participants&&matches(result)){count++;if(count===participants)release();await ready;}return result;
 },options)};
}
