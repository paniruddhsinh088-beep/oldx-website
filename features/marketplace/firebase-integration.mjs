import {createAuthenticatedPhotoClient} from '../media/authenticated-photo-client.mjs';
import {createProviderFirebaseSessionPorts} from '../service-providers/firebase-session-ports.mjs';
import {createAuthenticatedMarketplaceCommands} from './authenticated-command-client.mjs';
import {createMarketplacePublicClient} from './public-read-client.mjs';

// Composition of existing ports only. No endpoint, SDK, Auth initialization or
// automatic mounting. Caller must explicitly bind an approved trusted transport.
export function createFirebaseMarketplaceIntegration({enabled=false,auth,sendCommand,sendRead,sendProviderCommand,sendProviderConversation,providerReadStateEnabled=false,providerReconciledHistoryEnabled=false,providerVisibilityEnabled=false,sendProductConversation,sendInboxPage,productMedia={},storeMedia={},readStateEnabled=false,onSession=()=>{},makeSessionId}={}) {
 const active=enabled===true&&auth?.app?.options?.projectId==='oldx-staging';
 let session=null,destroyed=false;const pending=new Set(),photoClients=[];
 const provider=createProviderFirebaseSessionPorts({enabled:active,auth,
  sendCommand:typeof sendProviderCommand==='function'?sendProviderCommand:async()=>({status:503,body:{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}}}),
  makeSessionId,onSession:value=>{for(const client of photoClients)client.setScope(null);for(const controller of pending)controller.abort();pending.clear();session=value?{uid:value.uid,sessionId:value.sessionId}:null;onSession(session&&{...session});}});
 const getToken=(scope,options)=>provider.getMediaToken(scope,options);
 function mediaPorts({sendUpload,sendCommand,readManifest,readBytes}){
  const enabled=active&&[sendUpload,sendCommand,readManifest,readBytes].every(port=>typeof port==='function');
  const mediaClient=createAuthenticatedPhotoClient({enabled,getToken,sendUpload,sendCommand});
  photoClients.push(mediaClient);
  return Object.freeze({enabled,mediaClient,readManifest,readBytes});
 }
 const productPhotos=mediaPorts(productMedia),storePhotos=mediaPorts(storeMedia);
  const publicClient=createMarketplacePublicClient({enabled:active,sendRead});
 const ports=kind=>Object.freeze({...Object.fromEntries(['save','owner','archive'].map(operation=>[operation,async(body,context={})=>{
  const scope=session&&{...session},user=auth?.currentUser,controller=new AbortController();
  const current=()=>!destroyed&&scope&&session?.uid===scope.uid&&session?.sessionId===scope.sessionId&&auth.currentUser===user;
  const abort=()=>controller.abort();context.signal?.addEventListener('abort',abort,{once:true});if(context.signal?.aborted)abort();pending.add(controller);
  try{return await createAuthenticatedMarketplaceCommands({enabled:active,kind,getToken,sendCommand:typeof sendCommand==='function'?async(...args)=>{if(!current()||controller.signal.aborted)throw Error('AUTH_REQUIRED');return sendCommand(...args);}:undefined})[operation](body,{...context,signal:controller.signal});}
  finally{pending.delete(controller);context.signal?.removeEventListener('abort',abort);}
 }])),...publicClient});
 const chatPorts=typeof sendProductConversation==='function'?Object.fromEntries(
  ['open','send','thread','read','inboxPage',...(readStateEnabled===true?['acknowledge']:[])].map(operation=>[operation,async(body,context={})=>{
   const mutation=['open','send','acknowledge'].includes(operation);
   const result=await provider.executeScoped(sendProductConversation,operation,body,context,mutation);
   if(result?.status===200&&result.body?.ok===true)return result.body;
   const code=result?.body?.error?.code;
   return {ok:false,code:result?.status===202?'OUTCOME_UNKNOWN':typeof code==='string'?code:mutation?'OUTCOME_UNKNOWN':'UNAVAILABLE'};
  }])):{};
 const inbox=Object.freeze({enabled:active&&typeof sendInboxPage==='function',
  loadPage:(body,context={})=>provider.executeScoped(sendInboxPage,'page',body,context,false)});
 const visibilityEnabled=active&&providerReadStateEnabled===true&&providerReconciledHistoryEnabled===true&&providerVisibilityEnabled===true;
 const providerMessaging=Object.freeze({
  enabled:active&&typeof sendProviderConversation==='function',
  readStateEnabled:providerReadStateEnabled===true,visibilityEnabled,
  reconciledHistoryEnabled:providerReadStateEnabled===true&&providerReconciledHistoryEnabled===true,
  execute(operation,body,context={}){
   if(!['read','send'].includes(operation)&&!(operation==='acknowledge'&&providerReadStateEnabled===true)&&!(operation==='changeVisibility'&&visibilityEnabled&&body?.action==='hide_for_self')){
    return Promise.resolve({status:400,body:{ok:false,error:{code:'INVALID_REQUEST'}}});
   }
   return provider.executeScoped(sendProviderConversation,operation,body,context,operation!=='read');
  }
 });
 return Object.freeze({inbox,providerMessaging,productMedia:productPhotos,storeMedia:storePhotos,product:Object.freeze({...ports('product'),...chatPorts}),store:ports('store'),provider,
  // For the existing Admin API client's getIdToken dependency. It grants no role;
  // revocation/active-role checks remain the server's responsibility.
  async getAdminIdToken(){const scope=session&&{...session};if(destroyed||!scope)throw Error('AUTH_REQUIRED');return (await getToken(scope)).token;},
  destroy(){destroyed=true;provider.destroy();session=null;}
 });
}
