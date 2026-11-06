import {createHash} from 'node:crypto';
import {requireStagingMarketplaceBinding,STAGING_RATE_COLLECTION} from './staging-marketplace-context.mjs';
import {consumeAtomicRate} from './atomic-rate.mjs';
import {safeId} from './isolated-firestore-context.mjs';
export function createStagingMarketplaceRate({binding,policy,now=Date.now}={}){
 const b=requireStagingMarketplaceBinding(binding);
 if(!policy||!['windowMs','actorLimit','globalLimit'].every(k=>Number.isSafeInteger(policy[k])&&policy[k]>0)||policy.windowMs<1000||policy.windowMs>600000||policy.actorLimit>policy.globalLimit)throw Error('Rate policy unavailable');
 const config=Object.freeze({...policy});
 return async({actorUid},context)=>{
  if(!safeId(actorUid)||context?.signal?.aborted||!Number.isSafeInteger(context?.deadlineAt)||now()>=context.deadlineAt)return {allowed:false};const clock=now();if(!Number.isSafeInteger(clock)||clock<0)throw Error('Rate clock unavailable');
  const bucket=Math.floor(clock/config.windowMs),key=scope=>createHash('sha256').update(JSON.stringify([scope,bucket])).digest('hex');
  return consumeAtomicRate({sdk:b.sdk,db:b.db,actorRef:b.sdk.doc(b.db,STAGING_RATE_COLLECTION,key('actor:'+actorUid)),globalRef:b.sdk.doc(b.db,STAGING_RATE_COLLECTION,key('global')),actorLimit:config.actorLimit,globalLimit:config.globalLimit,expiresAtMs:(bucket+2)*config.windowMs,context,now});
 };
}
