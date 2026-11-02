import {normalizeProviderProfile} from '../features/service-providers/provider-profile.mjs';
import {buildPublicProviderProfile} from '../features/service-providers/provider-public-profile.mjs';
import {createBoundedRead} from '../features/shared/bounded-read.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
function copy(input,keys){try{if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).sort().join(',')!==[...keys].sort().join(','))return null;const result={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}return result;}catch{return null;}}
const profileKeys=['displayName','city','serviceArea','services','description','experienceYears','available','languages'];
// Inactive private draft intent only. No persistence, publish permission, contact,
// moderation, ID allocation, verified claims, timestamp or public-view mutation.
export function prepareProviderDraftIntent(request,canonical,actorUid,{enabled=false}={}){
 if(enabled!==true)return null;
 const r=copy(request,['requestId','expectedRevision','profile']),c=copy(canonical,['providerId','ownerUid','revision','status']);
 if(!r||!c||!id(actorUid)||c.ownerUid!==actorUid||!id(c.providerId)||!['draft','published'].includes(c.status)||!Number.isSafeInteger(c.revision)||c.revision<0||c.revision===Number.MAX_SAFE_INTEGER||r.expectedRevision!==c.revision||!id(r.requestId))return null;
 const raw=copy(r.profile,profileKeys);if(!raw)return null;
 const normalized=normalizeProviderProfile(raw);if(!normalized.ok)return null;
 const safe=buildPublicProviderProfile({id:c.providerId,...normalized.value});if(!safe.ok)return null;
 return Object.freeze({operation:'save-provider-private-draft',providerId:c.providerId,ownerUid:actorUid,expectedRevision:c.revision,requestId:r.requestId,
  draft:Object.freeze({...safe.profile,services:Object.freeze(safe.profile.services),languages:Object.freeze(safe.profile.languages)})});
}
// Shared strict request snapshot; no credentials/canonical ownership in input.
export function inspectProviderDraftRequest(request){
 const input=copy(request,['requestId','expectedRevision','profile']),profile=copy(input?.profile,profileKeys);
 if(!input||!profile||!id(input.requestId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||input.expectedRevision===Number.MAX_SAFE_INTEGER)return null;
 const normalized=normalizeProviderProfile(profile);if(!normalized.ok||!buildPublicProviderProfile({id:'validation',...normalized.value}).ok)return null;
 return Object.freeze({...input,profile:Object.freeze({...profile,services:Object.freeze([...normalized.value.services]),languages:Object.freeze([...normalized.value.languages])})});
}
// Inject verified authentication and owner lookup. Both must be implemented by a
// future approved trusted adapter. This port NEVER commits or publishes anything.
export function createProviderDraftPreparation({enabled=false,authenticate,readOwnedProvider,timeoutMs=5000,schedule=setTimeout,cancel=clearTimeout}={}){
 return Object.freeze({async prepare(request,{credential,signal}={}){
  if(enabled!==true||typeof authenticate!=='function'||typeof readOwnedProvider!=='function'||signal?.aborted)return {status:'unavailable'};
  const immutable=inspectProviderDraftRequest(request);if(!immutable)return {status:'unavailable'};
  const input=immutable;
  let state={status:'idle'};
  const reader=createBoundedRead({timeoutMs,schedule,cancel,onChange:next=>{state=next;},read:async(_,context)=>{
   const identity=await authenticate(credential,context);
   if(!id(identity?.uid)||context.signal.aborted)throw new Error('Unavailable');
   const actorUid=identity.uid;return {actorUid,canonical:await readOwnedProvider(actorUid,context)};
  },project:response=>prepareProviderDraftIntent(immutable,response.canonical,response.actorUid,{enabled:true})});
  const abort=()=>reader.clear();signal?.addEventListener('abort',abort,{once:true});
  try{await reader.load({requestId:input.requestId,expectedRevision:input.expectedRevision});return state.status==='idle'?{status:'cancelled'}:state;}
  finally{signal?.removeEventListener('abort',abort);}
 }});
}
