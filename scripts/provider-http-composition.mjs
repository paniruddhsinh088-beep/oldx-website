import {parseBoundedJson} from './bounded-json.mjs';
import {runVerifiedOperation} from './verified-operation.mjs';
import {inspectProviderDraftRequest} from './provider-draft-preparation.mjs';
import {createProviderDraftTransaction} from './provider-draft-transaction.mjs';
import {createProviderPublicationTransaction} from './provider-publication-transaction.mjs';
const headers=Object.freeze({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0',Pragma:'no-cache','X-Content-Type-Options':'nosniff',Vary:'Authorization'});
const reply=(status,body,extra={})=>({status,headers:{...headers,...extra},body});
const error=(status,code,extra={})=>reply(status,{ok:false,error:{code}},extra);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
function copy(input,keys){try{if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).sort().join(',')!==[...keys].sort().join(','))return null;return Object.fromEntries(keys.map(k=>{const d=Object.getOwnPropertyDescriptor(input,k);if(!d||!Object.hasOwn(d,'value'))throw new Error();return [k,d.value];}));}catch{return null;}}
function requestHeaders(input){try{if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length>32)return null;const out=Object.create(null);for(const key of Reflect.ownKeys(input)){const d=Object.getOwnPropertyDescriptor(input,key),lower=key.toLowerCase();if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='string'||d.value.length>8192||Object.hasOwn(out,lower)||/[\r\n]/.test(d.value))return null;out[lower]=d.value;}return out;}catch{return null;}}
// Default-disabled, framework-neutral function only. No route/listener/SDK/auth
// provider is initialized. All roles, rates and identities are trusted injections.
export function createProviderHttpComposition({enabled=false,verifyFirebaseToken,resolveProviderRole,consumeRateLimit,draft={},publication={},timeoutMs=5000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 return Object.freeze({async handle(operation,request,{signal}={}){
  if(enabled!==true)return error(503,'UNAVAILABLE');
  if(!['draft.save','publication.manage'].includes(operation))return error(404,'NOT_FOUND');
  const r=copy(request,['method','headers','body']);if(!r)return error(400,'BAD_REQUEST');
  if(typeof r.method!=='string')return error(400,'BAD_REQUEST');
  if(r.method!=='POST')return error(405,'METHOD_NOT_ALLOWED',{Allow:'POST'});
  const h=requestHeaders(r.headers);if(!h)return error(400,'BAD_REQUEST');
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(h['content-type']??'')||h['content-encoding']&&h['content-encoding']!=='identity')return error(415,'UNSUPPORTED_MEDIA_TYPE');
  const parsed=parseBoundedJson(r.body);if(!parsed.ok)return error(parsed.code==='BODY_TOO_LARGE'?413:400,parsed.code);
  let input;
  if(operation==='draft.save')input=inspectProviderDraftRequest(parsed.value);
  else{input=copy(parsed.value,['requestId','expectedRevision','expectedGeneration','action']);if(input&&(!id(input.requestId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!Number.isSafeInteger(input.expectedGeneration)||input.expectedGeneration<0||!['publish','withdraw'].includes(input.action)))input=null;}
  if(!input)return error(400,'INVALID_REQUEST');
  const token=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(h.authorization??'')?.[1];
  if(!token)return error(401,'AUTH_REQUIRED');
  if(![verifyFirebaseToken,resolveProviderRole,consumeRateLimit].every(fn=>typeof fn==='function'))return error(503,'ENFORCEMENT_UNAVAILABLE');
  const result=await runVerifiedOperation({credential:token,authenticate:(credential,context)=>verifyFirebaseToken(credential,{...context,checkRevoked:true}),signal,timeoutMs,now,schedule,cancel,run:async context=>{
   const role=copy(await resolveProviderRole(context.actorUid,{signal:context.signal,deadlineAt:context.deadlineAt}),['uid','role','active']);context.checkpoint();
   if(!role||role.uid!==context.actorUid||role.active!==true||!(operation==='draft.save'?['member','provider']:['provider']).includes(role.role))return {ok:false,code:'DENIED'};
   const rate=copy(await consumeRateLimit({actorUid:context.actorUid,operation,requestId:input.requestId},{signal:context.signal,deadlineAt:context.deadlineAt}),['allowed','retryAfterSeconds']);context.checkpoint();
   if(!rate||typeof rate.allowed!=='boolean'||!Number.isInteger(rate.retryAfterSeconds)||rate.allowed&&rate.retryAfterSeconds!==0||!rate.allowed&&(rate.retryAfterSeconds<1||rate.retryAfterSeconds>3600))return {ok:false,code:'ENFORCEMENT_UNAVAILABLE'};
   if(!rate.allowed)return {ok:false,code:'RATE_LIMITED',retryAfterSeconds:rate.retryAfterSeconds};
   const shared={enabled:true,authenticate:()=>({uid:context.actorUid}),timeoutMs:Math.max(1,context.deadlineAt-now()),now,schedule,cancel};
   // Once dispatched, timeout may conceal an in-flight commit. The atomic port
   // remains responsible for current permission/ownership, receipt and audit.
   context.markMutationAttempted();
   return operation==='draft.save'?createProviderDraftTransaction({...draft,...shared}).save(input,{signal:context.signal}):createProviderPublicationTransaction({...publication,...shared}).execute(input,{signal:context.signal});
  }});
  if(result?.ok===true){
   const keys=operation==='draft.save'?['ok','status','providerId','revision']:['ok','status','providerId','action','generation'];const safe=copy(result,keys);
   if(!safe||!id(safe.providerId)||!(operation==='draft.save'?['saved','replayed']:['applied','replayed']).includes(safe.status)||!Number.isSafeInteger(operation==='draft.save'?safe.revision:safe.generation))return error(503,'UNAVAILABLE');
   return reply(200,safe);
  }
  if(result?.code==='OUTCOME_UNKNOWN')return reply(202,{ok:false,error:{code:'OUTCOME_UNKNOWN'},retrySameRequest:true});
  if(result?.code==='RATE_LIMITED')return error(429,'RATE_LIMITED',{'Retry-After':String(result.retryAfterSeconds)});
  const status={AUTH_REQUIRED:401,DENIED:403,INVALID_REQUEST:400,INVALID_PUBLIC_PROFILE:400,REVISION_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,CONFLICT:409,DEADLINE_EXCEEDED:504,CANCELLED:408,ENFORCEMENT_UNAVAILABLE:503}[result?.code]??503;
  return error(status,status===503?'ENFORCEMENT_UNAVAILABLE':result.code);
 }});
}
