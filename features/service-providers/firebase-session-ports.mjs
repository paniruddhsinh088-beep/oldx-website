const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const unavailable=()=>({status:503,body:{ok:false,error:{code:'ENFORCEMENT_UNAVAILABLE'}}});
// Reuses an existing Firebase Auth instance; no app/config initialization,
// browser-role authority, token persistence, endpoint installation or fetch.
export function createProviderFirebaseSessionPorts({enabled=false,auth,sendCommand,onSession=()=>{},makeSessionId=()=>globalThis.crypto.randomUUID()}={}){
 let active=false,uid=null,sessionId=null,epoch=0,unsubscribe=()=>{};const pending=new Set();
 function clear(){epoch++;uid=null;sessionId=null;for(const c of pending)c.abort();pending.clear();onSession(null);}
 const valid=enabled===true&&auth?.app?.options?.projectId==='oldx-staging'&&typeof auth.onIdTokenChanged==='function'&&typeof sendCommand==='function';
 if(valid){active=true;unsubscribe=auth.onIdTokenChanged(user=>{if(!active)return;if(!user){clear();return;}if(!id(user.uid)||auth.currentUser?.uid!==user.uid){if(auth.currentUser?.uid!==uid)clear();return;}
  if(uid!==user.uid){clear();let next;try{next=makeSessionId();}catch{return;}if(!id(next))return;uid=user.uid;sessionId=next;onSession({uid,sessionId,revision:0,generation:0});}
 },()=>{if(active)clear();});}
 async function execute(operation,body,context={}){
  if(!active)return unavailable();
  if(!['draft.save','publication.manage','owner.bootstrap','enquiry.create','enquiry.cancel','enquiry.change','enquiry.detail','enquiry.inbox'].includes(operation))return {status:400,body:{ok:false,error:{code:'INVALID_REQUEST'}}};
  const user=auth.currentUser,version=epoch,mutation=['draft.save','publication.manage','enquiry.create','enquiry.cancel','enquiry.change'].includes(operation);
  if(!uid||user?.uid!==uid||context.session?.uid!==uid||context.session?.sessionId!==sessionId||context.signal?.aborted)return {status:401,body:{ok:false,error:{code:'AUTH_REQUIRED'}}};
  const controller=new AbortController(),abort=()=>controller.abort();context.signal?.addEventListener('abort',abort,{once:true});pending.add(controller);let sent=false;
  try{
   const input=structuredClone(body),token=await user.getIdToken();
   if(version!==epoch||controller.signal.aborted||auth.currentUser?.uid!==uid||typeof token!=='string'||token.length>8192||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(token))return {status:401,body:{ok:false,error:{code:'AUTH_REQUIRED'}}};
   sent=true;const response=await sendCommand(operation,input,{credential:token,signal:controller.signal});
   if(version!==epoch||controller.signal.aborted)return {status:401,body:{ok:false,error:{code:'AUTH_REQUIRED'}}};
   return response;
  }catch{return sent&&mutation?{status:202,body:{ok:false,error:{code:'OUTCOME_UNKNOWN'},retrySameRequest:true}}:unavailable();}
  finally{pending.delete(controller);context.signal?.removeEventListener('abort',abort);}
 }
 return Object.freeze({commands:Object.freeze({execute}),owner:Object.freeze({load:(body,context)=>execute('owner.bootstrap',body,context)}),destroy(){active=false;unsubscribe?.();clear();}});
}
