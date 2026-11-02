// SERVER ONLY. No SDK initialization/JWKS/network implementation. The injected
// Admin Auth must perform actual cryptographic Firebase verification/revocation.
export function createIsolatedProviderEnforcement({enabled=false,projectId,adminAuth,readMembership,consumeAtomicQuota,now=Date.now}={}){
 const deny=()=>{throw new Error('Provider enforcement unavailable');};
 const configured=enabled===true&&typeof projectId==='string'&&/^demo-oldx-[a-z0-9-]{1,60}$/.test(projectId)&&adminAuth?.app?.options?.projectId===projectId;
 return Object.freeze({
  async verifyFirebaseToken(token,context={}){
   if(!configured||typeof adminAuth?.verifyIdToken!=='function'||context.checkRevoked!==true||context.signal?.aborted||typeof token!=='string'||token.length>8192||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token))deny();
   let decoded;try{decoded=await adminAuth.verifyIdToken(token,true);}catch{deny();}
   const descriptor=decoded&&Object.getOwnPropertyDescriptor(decoded,'uid'),seconds=Math.floor(now()/1000);
   if(context.signal?.aborted||!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(descriptor.value)||decoded.aud!==projectId||decoded.iss!=='https://securetoken.google.com/'+projectId||decoded.sub!==descriptor.value||!Number.isSafeInteger(decoded.exp)||decoded.exp<=seconds||!Number.isSafeInteger(decoded.iat)||decoded.iat>seconds+60||decoded.firebase?.tenant!==undefined)deny();
   return {uid:descriptor.value};
  },
  async resolveProviderRole(uid,context){if(!configured||typeof readMembership!=='function'||context?.signal?.aborted)deny();return readMembership(uid,context);},
  async consumeRateLimit(key,context){if(!configured||typeof consumeAtomicQuota!=='function'||context?.signal?.aborted)deny();return consumeAtomicQuota(key,context);}
 });
}
