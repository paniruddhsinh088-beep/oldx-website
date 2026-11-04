import {createPrivateConversationHttp} from './product-conversation-http.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {validateMarketplaceProfile} from './firebase-marketplace-repository.mjs';
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const keys={save:['kind','requestId','id','expectedRevision','publication','profile'],archive:['kind','requestId','id','expectedRevision'],owner:['kind','id','requestId']};
function project(kind,operation,result){
 if(operation!=='owner'){
  const v=copyRecord(result,['ok','status','id','revision','generation']);
  return v?.ok===true&&safeId(v.id)&&integer(v.revision)&&v.revision>0&&integer(v.generation)&&(operation==='save'?['saved','replayed']:['archived','replayed']).includes(v.status)?v:null;
 }
 const v=copyRecord(result,['ok','id','revision','profile','published','publicationRevision','receipt']),profile=validateMarketplaceProfile(kind,v?.profile);
 if(!v||v.ok!==true||!safeId(v.id)||!integer(v.revision)||v.revision<1||!profile||typeof v.published!=='boolean'||!integer(v.publicationRevision)||v.publicationRevision>v.revision)return null;
 const receipt=v.receipt===null?null:copyRecord(v.receipt,['requestId','revision','status']);
 if(v.receipt!==null&&(!receipt||!safeId(receipt.requestId)||!integer(receipt.revision)||receipt.revision<1||receipt.revision>v.revision||receipt.status!=='committed'))return null;
 return {...v,profile,receipt};
}
// Inactive private command composition, not a route. The trusted repository
// factory MUST bind mandatory photo policy/atomic publication inside transactions.
// No public reads, SDK creation, credentials, upload bytes or backend activation.
export function createMarketplaceCommandHttp({createRepository,...options}={}){
 return Object.freeze({async handle(operation,request,context={}){
  let kind=null;
  const handler=createPrivateConversationHttp({...options,contract:{prefix:'marketplace.',maxBodyBytes:32768,keys,mutations:['save','archive'],projection:(op,value)=>project(kind,op,value)},createRepository:scope=>{
   const repo=typeof createRepository==='function'?createRepository(scope):null;
   return Object.fromEntries(Object.keys(keys).map(op=>[op,async(input,ctx)=>{
    if(!['product','store'].includes(input.kind))return {ok:false,code:'INVALID_REQUEST'};kind=input.kind;
    if(op==='save'&&(!safeId(input.requestId)||input.id!==null&&!safeId(input.id)||!integer(input.expectedRevision)||!['draft','publish','withdraw'].includes(input.publication)||!validateMarketplaceProfile(kind,input.profile)))return {ok:false,code:'INVALID_REQUEST'};
    if(op==='archive'&&(!safeId(input.requestId)||!safeId(input.id)||!integer(input.expectedRevision)||input.expectedRevision<1))return {ok:false,code:'INVALID_REQUEST'};
    if(op==='owner'&&(input.id!==null&&!safeId(input.id)||input.requestId!==null&&!safeId(input.requestId)||kind==='product'&&input.id===null&&input.requestId===null))return {ok:false,code:'INVALID_REQUEST'};
    if(typeof repo?.[op]!=='function')return {ok:false,code:'ENFORCEMENT_UNAVAILABLE'};
    if(op==='owner')return repo.owner(input,ctx);
    const {kind:ignored,...body}=input;return repo[op](kind,body,ctx);
   }]));
  }});
  return handler.handle(operation,request,context);
 }});
}
