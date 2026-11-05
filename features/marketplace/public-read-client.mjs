import {projectProduct} from './product-integration.mjs';
import {STORE_CATEGORY_IDS} from '../stores/store-catalogue.mjs';
import {publicStore} from './store-integration.mjs';
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).sort().join(',')===[...keys].sort().join(',');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export function projectMarketplacePublicResponse(operation,input,value){
 const project=v=>input.kind==='product'?projectProduct(v):publicStore(v);
 if(operation==='detail'){const p=project(value?.profile);return exact(value,['ok','profile'])&&value.ok===true&&p?.id===input.id?{ok:true,profile:p}:null;}
 if(!exact(value,['ok','items','nextCursor','publicationEpoch'])||value.ok!==true||!Array.isArray(value.items)||value.items.length>input.limit||!Number.isSafeInteger(value.publicationEpoch)||value.publicationEpoch<0||value.nextCursor!==null&&(typeof value.nextCursor!=='string'||value.nextCursor.length<1||value.nextCursor.length>1024))return null;
 const rows=value.items.map(project);let previous=null;
 for(const row of rows){if(!row||previous!==null&&row.id<=previous||input.storeId!==null&&row.storeId!==input.storeId||input.category&&!(row.categories??[row.category]).includes(input.category))return null;previous=row.id;}
 return {ok:true,items:rows,nextCursor:value.nextCursor,publicationEpoch:value.publicationEpoch};
}
// Injected transport only. Existing controllers own bounded deadlines/session epochs.
// No token, cookies, persistence, endpoint URL, automatic retries or SDK access.
export function createMarketplacePublicClient({enabled=false,sendRead}={}){
 return Object.freeze(Object.fromEntries(['list','detail'].map(operation=>[operation,async(input,{signal}={})=>{
  if(enabled!==true||typeof sendRead!=='function')return {ok:false,code:'UNAVAILABLE'};
  if(signal?.aborted)return {ok:false,code:'CANCELLED'};
  if(!exact(input,operation==='detail'?['kind','id']:['kind','limit','category','storeId','cursor'])||!['product','store'].includes(input?.kind)||operation==='detail'&&!id(input.id)||operation==='list'&&(!Number.isInteger(input.limit)||input.limit<1||input.limit>24||input.category!==''&&!STORE_CATEGORY_IDS.includes(input.category)||input.storeId!==null&&(!id(input.storeId)||input.kind!=='product')||input.cursor!==null&&(typeof input.cursor!=='string'||input.cursor.length<1||input.cursor.length>1024)))return {ok:false,code:'INVALID_REQUEST'};
  try{const request=structuredClone(input),response=await sendRead(operation,request,{signal});if(signal?.aborted)return {ok:false,code:'CANCELLED'};
   if(response?.status===200)return projectMarketplacePublicResponse(operation,request,response.body)??{ok:false,code:'UNAVAILABLE'};
   const code=response?.body?.error?.code;return {ok:false,code:['INVALID_REQUEST','CURSOR_INVALID','RATE_LIMITED','UNAVAILABLE','CANCELLED','DEADLINE_EXCEEDED'].includes(code)?code:'UNAVAILABLE'};
  }catch{return {ok:false,code:signal?.aborted?'CANCELLED':'UNAVAILABLE'};}
 }])));
}
