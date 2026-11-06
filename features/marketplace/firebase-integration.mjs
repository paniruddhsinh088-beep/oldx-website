import {createProviderFirebaseSessionPorts} from '../service-providers/firebase-session-ports.mjs';
import {createAuthenticatedMarketplaceCommands} from './authenticated-command-client.mjs';
import {createMarketplacePublicClient} from './public-read-client.mjs';

// Composition of existing ports only. No endpoint, SDK, Auth initialization or
// automatic mounting. Caller must explicitly bind an approved trusted transport.
export function createFirebaseMarketplaceIntegration({enabled=false,auth,sendCommand,sendRead,sendProviderCommand,onSession=()=>{},makeSessionId}={}) {
 const active=enabled===true&&auth?.app?.options?.projectId==='oldx-staging';
 let session=null,destroyed=false;const pending=new Set();
 const provider=createProviderFirebaseSessionPorts({enabled:active,auth,
  sendCommand:typeof sendProviderCommand==='function'?sendProviderCommand:async()=>({status:503,body:{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}}}),
  makeSessionId,onSession:value=>{for(const controller of pending)controller.abort();pending.clear();session=value?{uid:value.uid,sessionId:value.sessionId}:null;onSession(session&&{...session});}});
 const getToken=(scope,options)=>provider.getMediaToken(scope,options);
 const publicClient=createMarketplacePublicClient({enabled:active,sendRead});
 const ports=kind=>Object.freeze({...Object.fromEntries(['save','owner','archive'].map(operation=>[operation,async(body,context={})=>{
  const scope=session&&{...session},user=auth?.currentUser,controller=new AbortController();
  const current=()=>!destroyed&&scope&&session?.uid===scope.uid&&session?.sessionId===scope.sessionId&&auth.currentUser===user;
  const abort=()=>controller.abort();context.signal?.addEventListener('abort',abort,{once:true});if(context.signal?.aborted)abort();pending.add(controller);
  try{return await createAuthenticatedMarketplaceCommands({enabled:active,kind,getToken,sendCommand:typeof sendCommand==='function'?async(...args)=>{if(!current()||controller.signal.aborted)throw Error('AUTH_REQUIRED');return sendCommand(...args);}:undefined})[operation](body,{...context,signal:controller.signal});}
  finally{pending.delete(controller);context.signal?.removeEventListener('abort',abort);}
 }])),...publicClient});
 return Object.freeze({product:ports('product'),store:ports('store'),provider,
  // For the existing Admin API client's getIdToken dependency. It grants no role;
  // revocation/active-role checks remain the server's responsibility.
  async getAdminIdToken(){const scope=session&&{...session};if(destroyed||!scope)throw Error('AUTH_REQUIRED');return (await getToken(scope)).token;},
  destroy(){destroyed=true;provider.destroy();session=null;}
 });
}
