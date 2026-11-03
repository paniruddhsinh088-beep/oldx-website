// Shared existing-UI Auth lifecycle fanout. No Firebase listener, token storage,
// role resolution, endpoint or automatic activation. Hosts supply verified scope.
export function createMarketplaceSessionIntegration({enabled=false,bindings=[]}={}){
 let epoch=0,current=null;
 const clear=()=>{epoch++;current=null;const tasks=bindings.map(binding=>{try{if(typeof binding.setSession!=='function')throw new Error('Missing lifecycle port');return Promise.resolve(binding.setSession(null));}catch{return Promise.reject(new Error('Lifecycle unavailable'));}});return Promise.allSettled(tasks).then(results=>results.every(r=>r.status==='fulfilled'));};
 return Object.freeze({async setSession(value){
  if(!enabled)return false;if(!value||typeof value.uid!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value.uid)||typeof value.sessionId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value.sessionId)){await clear();return false;}
  const version=++epoch;current={uid:value.uid,sessionId:value.sessionId};
  try{await Promise.all(bindings.map(binding=>{if(typeof binding.setSession!=='function')throw new Error('Missing lifecycle port');return binding.setSession({...current});}));return version===epoch;}
  catch{if(version===epoch)await clear();return false;}
 },logout:clear,changeScope(){for(const binding of bindings)binding.changeScope?.();},snapshot:()=>current&&{...current}});
}

// Existing Provider UI requires its initial revision/generation scope. Zero is a
// bootstrap starting point, not a grant or fabricated persisted revision.
export function providerSessionBinding(journey){return Object.freeze({setSession:value=>journey.setSession(value?{...value,revision:0,generation:0}:null),changeScope:()=>journey.changeScope()});}
