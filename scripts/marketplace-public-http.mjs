import {validateMarketplaceProfile} from './firebase-marketplace-repository.mjs';
import {parseBoundedJson} from './bounded-json.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {runVerifiedOperation} from './verified-operation.mjs';
import {STORE_CATEGORY_IDS} from '../features/stores/store-catalogue.mjs';
import {projectMarketplacePublicResponse} from '../features/marketplace/public-read-client.mjs';
const reply=(status,body)=>({status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body});
const fail=(status,code)=>reply(status,{ok:false,error:{code}});
// Library only: caller injects trusted guest rate enforcement and an existing
// bounded public repository. Never forwards request headers/identity to repository.
export function createMarketplacePublicHttp({enabled=false,repository,consumeRateLimit,timeoutMs=5000,now=Date.now}={}){
 return Object.freeze({async handle(operation,request,{signal}={}){
  if(enabled!==true)return fail(503,'UNAVAILABLE');
  if(!['list','detail'].includes(operation))return fail(404,'NOT_FOUND');
  const r=copyRecord(request,['method','headers','body']);if(!r)return fail(400,'INVALID_REQUEST');if(r.method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
  if(!r.headers||Object.getPrototypeOf(r.headers)!==Object.prototype||Reflect.ownKeys(r.headers).length>32)return fail(400,'INVALID_REQUEST');
  const h=Object.create(null);for(const k of Reflect.ownKeys(r.headers)){const d=Object.getOwnPropertyDescriptor(r.headers,k);if(typeof k!=='string'||!Object.hasOwn(d,'value')||typeof d.value!=='string'||d.value.length>8192||/[\r\n]/.test(d.value)||Object.hasOwn(h,k.toLowerCase()))return fail(400,'INVALID_REQUEST');h[k.toLowerCase()]=d.value;}
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(h['content-type']??'')||h['content-encoding']&&h['content-encoding']!=='identity')return fail(415,'UNSUPPORTED_MEDIA_TYPE');
  const parsed=parseBoundedJson(r.body,{maxBytes:4096});if(!parsed.ok)return fail(parsed.code==='BODY_TOO_LARGE'?413:400,'INVALID_REQUEST');
  const input=copyRecord(parsed.value,operation==='list'?['kind','limit','category','storeId','cursor']:['kind','id']);
  if(!input||!['product','store'].includes(input.kind)||operation==='detail'&&!safeId(input.id)||operation==='list'&&(!Number.isInteger(input.limit)||input.limit<1||input.limit>24||input.category!==''&&!STORE_CATEGORY_IDS.includes(input.category)||input.storeId!==null&&(!safeId(input.storeId)||input.kind!=='product')||input.cursor!==null&&(typeof input.cursor!=='string'||input.cursor.length<1||input.cursor.length>1024)))return fail(400,'INVALID_REQUEST');
  if(typeof consumeRateLimit!=='function'||typeof repository?.[operation]!=='function')return fail(503,'ENFORCEMENT_UNAVAILABLE');
  const result=await runVerifiedOperation({authenticate:()=>({uid:'public-read'}),signal,timeoutMs,now,run:async context=>{
   const rate=copyRecord(await consumeRateLimit({operation:'marketplace.public.'+operation},{signal:context.signal,deadlineAt:context.deadlineAt}),['allowed']);context.checkpoint();if(!rate||typeof rate.allowed!=='boolean')return {ok:false,code:'ENFORCEMENT_UNAVAILABLE'};if(!rate.allowed)return {ok:false,code:'RATE_LIMITED'};
   const value=await repository[operation](input,{signal:context.signal});context.checkpoint();return value;
  }});
  if(result?.ok===true){const rows=operation==='detail'?[result.profile]:result.items;if(!Array.isArray(rows)||rows.some(row=>{if(!row||typeof row!=='object')return true;const {id,kind,revision,...fields}=row;return kind!==input.kind||!validateMarketplaceProfile(kind,{...fields,photos:[]});}))return fail(503,'UNAVAILABLE');const dto=projectMarketplacePublicResponse(operation,input,result);return dto?reply(200,dto):fail(503,'UNAVAILABLE');}
  const codes={INVALID_REQUEST:400,CURSOR_INVALID:409,RATE_LIMITED:429,CANCELLED:408,DEADLINE_EXCEEDED:504,ENFORCEMENT_UNAVAILABLE:503,UNAVAILABLE:503};return fail(codes[result?.code]??503,Object.hasOwn(codes,result?.code)?result.code:'UNAVAILABLE');
 }});
}
