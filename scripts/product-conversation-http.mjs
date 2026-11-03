import {parseBoundedJson} from './bounded-json.mjs';
import {runVerifiedOperation} from './verified-operation.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
const headers=Object.freeze({'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',Vary:'Authorization'});
const reply=(status,body)=>({status,headers:{...headers},body}),failure=(status,code,retry=false)=>reply(status,{ok:false,error:{code},...(retry?{retrySameRequest:true}:{})});
const keys={open:['requestId','productId','expectedProductRevision','text'],send:['requestId','threadId','expectedRevision','text'],read:['threadId','expectedRevision','afterSequence','limit'],inbox:['role','limit'],inboxPage:['role','limit','cursor'],thread:['threadId']};
function inspectHeaders(value){try{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length>32)return null;const h=Object.create(null);for(const key of Reflect.ownKeys(value)){if(typeof key!=='string')return null;const d=Object.getOwnPropertyDescriptor(value,key),lower=key.toLowerCase();if(!Object.hasOwn(d,'value')||typeof d.value!=='string'||d.value.length>8192||/[\r\n]/.test(d.value)||Object.hasOwn(h,lower))return null;h[lower]=d.value;}return h;}catch{return null;}}
function thread(value){const t=copyRecord(value,['id','productId','productRevision','revision','role']);return t&&safeId(t.id)&&safeId(t.productId)&&Number.isSafeInteger(t.productRevision)&&t.productRevision>0&&Number.isSafeInteger(t.revision)&&t.revision>0&&['buyer','seller'].includes(t.role)?t:null;}
function projection(operation,result){
 if(operation==='thread'){const r=copyRecord(result,['ok','thread']),t=thread(r?.thread);return r?.ok===true&&t?{ok:true,thread:t}:null;}
 if(operation==='inbox'||operation==='inboxPage'){const r=copyRecord(result,operation==='inboxPage'?['ok','items','bounded','nextCursor']:['ok','items','bounded']);if(!r||r.ok!==true||r.bounded!==true||!Array.isArray(r.items)||r.items.length>20)return null;const items=r.items.map(thread);if(operation==='inboxPage'&&r.nextCursor!==null&&(typeof r.nextCursor!=='string'||r.nextCursor.length<1||r.nextCursor.length>1024))return null;return items.every(Boolean)?{ok:true,items,bounded:true,...(operation==='inboxPage'?{nextCursor:r.nextCursor}:{})}:null;}
 if(operation==='read'){const r=copyRecord(result,['ok','thread','messages','hasMore']),t=thread(r?.thread);if(!r||r.ok!==true||!t||typeof r.hasMore!=='boolean'||!Array.isArray(r.messages)||r.messages.length>20)return null;const messages=r.messages.map(value=>copyRecord(value,['sequence','senderRole','text']));if(messages.some(v=>!v||!Number.isSafeInteger(v.sequence)||v.sequence<1||v.sequence>t.revision||!['buyer','seller'].includes(v.senderRole)||typeof v.text!=='string'||v.text.length>2000))return null;return {ok:true,thread:t,messages,hasMore:r.hasMore};}
 const r=copyRecord(result,['ok','status','thread']),t=thread(r?.thread);return r?.ok===true&&t&&['sent','replayed'].includes(r.status)?{ok:true,status:r.status,thread:t}:null;
}
// No route or SDK initialization. createRepository receives ONLY the identity
// derived from verified credentials; callers cannot select sender/owner/role.
export function createPrivateConversationHttp({enabled=false,verifyFirebaseToken,consumeRateLimit,createRepository,timeoutMs=5000,now=Date.now,contract}={}){
 const keys=contract?.keys,projection=contract?.projection;
 if(!keys||typeof projection!=='function')return Object.freeze({handle:async()=>failure(503,'ENFORCEMENT_UNAVAILABLE')});
 return Object.freeze({async handle(operation,request,{signal}={}){
  if(enabled!==true)return failure(503,'UNAVAILABLE');if(!Object.hasOwn(keys,operation))return failure(404,'NOT_FOUND');
  const r=copyRecord(request,['method','headers','body']);if(!r)return failure(400,'BAD_REQUEST');if(r.method!=='POST')return failure(405,'METHOD_NOT_ALLOWED');const h=inspectHeaders(r.headers);if(!h)return failure(400,'BAD_REQUEST');
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(h['content-type']??'')||h['content-encoding']&&h['content-encoding']!=='identity')return failure(415,'UNSUPPORTED_MEDIA_TYPE');
  const parsed=parseBoundedJson(r.body);if(!parsed.ok)return failure(parsed.code==='BODY_TOO_LARGE'?413:400,parsed.code);const input=copyRecord(parsed.value,keys[operation]);if(!input)return failure(400,'INVALID_REQUEST');
  const token=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(h.authorization??'')?.[1];if(!token)return failure(401,'AUTH_REQUIRED');if(![verifyFirebaseToken,consumeRateLimit,createRepository].every(f=>typeof f==='function'))return failure(503,'ENFORCEMENT_UNAVAILABLE');
  const result=await runVerifiedOperation({authenticate:(credential,context)=>verifyFirebaseToken(credential,{...context,checkRevoked:true}),credential:token,signal,timeoutMs,now,run:async context=>{
   const rate=copyRecord(await consumeRateLimit({actorUid:context.actorUid,operation:contract.prefix+operation},{signal:context.signal,deadlineAt:context.deadlineAt}),['allowed']);context.checkpoint();if(!rate||typeof rate.allowed!=='boolean')return {ok:false,code:'ENFORCEMENT_UNAVAILABLE'};if(!rate.allowed)return {ok:false,code:'RATE_LIMITED'};
   const repository=createRepository({authenticate:()=>({uid:context.actorUid}),timeoutMs:Math.max(1,context.deadlineAt-now())});context.checkpoint();if(typeof repository?.[operation]!=='function')return {ok:false,code:'ENFORCEMENT_UNAVAILABLE'};
   if(['open','send'].includes(operation))context.markMutationAttempted();return repository[operation](input,{signal:context.signal});
  }});
  if(result?.ok===true){const dto=projection(operation,result);return dto?reply(200,dto):failure(503,'UNAVAILABLE');}
  const code=result?.code,known={CURSOR_INVALID:409,INVALID_REQUEST:400,AUTH_REQUIRED:401,DENIED:403,REVISION_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,LIMIT_REACHED:409,RATE_LIMITED:429,ENFORCEMENT_UNAVAILABLE:503,CANCELLED:408,DEADLINE_EXCEEDED:504,UNAVAILABLE:503,OUTCOME_UNKNOWN:202};return failure(known[code]??503,Object.hasOwn(known,code)?code:'UNAVAILABLE',code==='OUTCOME_UNKNOWN');
 }});
}

export function createProductConversationHttp(options={}){return createPrivateConversationHttp({...options,contract:{keys,projection,prefix:'product.conversation.'}});}
