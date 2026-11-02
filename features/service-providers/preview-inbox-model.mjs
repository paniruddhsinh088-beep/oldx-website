import {inspectSampleProviderInbox,rehearseSampleEnquiryTransition} from './preview-inbox.mjs';
import { inspectSampleEnquiry } from './preview-enquiry.mjs';
export const SAMPLE_ENQUIRY_STATES=Object.freeze(['new','viewed','accepted','in-progress','completion-requested','completed','declined','cancelled','disputed']);
const ID=/^[A-Za-z0-9_-]{1,100}$/;
const plain=v=>v!==null && typeof v==='object' && !Array.isArray(v) && Object.getPrototypeOf(v)===Object.prototype;
export const isSampleReply=v=>typeof v==='string' && v.length<=400 && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(v);
const fail=()=>({ok:false,code:'SAMPLE_UNAVAILABLE'});
const providerActions={
  view:['new'],accept:['new','viewed'],decline:['new','viewed'],start:['accepted'],
  'request-completion':['in-progress'],
  reply:['new','viewed','accepted','in-progress','completion-requested']
};
export const SAMPLE_PROVIDER_ACTIONS=Object.freeze(Object.fromEntries(Object.entries(providerActions).map(([key,states])=>[key,Object.freeze(states)])));
const targets={view:'viewed',accept:'accepted',decline:'declined',start:'in-progress','request-completion':'completion-requested',cancel:'cancelled','confirm-completion':'completed',dispute:'disputed'};
const remoteStatus=status=>({viewed:'new','in-progress':'in_progress','completion-requested':'completion_requested',completed:'completed_confirmed'}[status]??status);
const remoteRow=(row,index=0)=>({requestId:row.id,providerId:row.providerId,service:row.service,summary:'Sample enquiry only',timing:'flexible',status:remoteStatus(row.status),createdOrder:index});
function validContext(context){
 return plain(context) && plain(context.provider) && context.provider.published===true && typeof context.provider.id==='string' && ID.test(context.provider.id) && Array.isArray(context.provider.services) && context.provider.services.length>0 && context.provider.services.length<=12 &&
  Array.isArray(context.records) && context.records.length<=20 && new Set(context.records.map(r=>r?.id)).size===context.records.length &&
  Array.from(context.records).every(r=>plain(r) && Object.keys(r).sort().join(',')==='buyerConfirmed,buyerId,id,note,providerId,reply,revision,service,status' &&
    typeof r.id==='string' && ID.test(r.id) && typeof r.buyerId==='string' && ID.test(r.buyerId) &&
    r.providerId===context.provider.id && SAMPLE_ENQUIRY_STATES.includes(r.status) &&
    Number.isSafeInteger(r.revision) && r.revision>=0 && typeof r.buyerConfirmed==='boolean' &&
    r.buyerConfirmed===(r.status==='completed') && isSampleReply(r.reply) &&
    inspectSampleEnquiry(context.provider,{service:r.service,description:r.note,timing:'flexible'}).ok) &&
  inspectSampleProviderInbox(context.provider,context.records.map(remoteRow),{limit:20}).ok;
}
export function buildSampleInbox(context,actor,{status='all',service='all'}={}){
 if(!validContext(context) || actor?.role!=='provider' || actor.id!==context.provider.id ||
   (status!=='all'&&!SAMPLE_ENQUIRY_STATES.includes(status)) || (service!=='all'&&!context.provider.services.includes(service)))return fail();
 return {ok:true,items:context.records.filter(r=>(status==='all'||r.status===status)&&(service==='all'||r.service===service))
  .map(r=>({id:r.id,service:r.service,status:r.status,revision:r.revision}))};
}
export function readSampleInboxDetail(context,actor,id){
 if(!plain(actor)||!validContext(context)||typeof id!=='string'||!ID.test(id))return fail();
 const record=context.records.find(r=>r.id===id);
 if(!record || !(actor?.role==='provider'&&actor.id===record.providerId || actor?.role==='buyer'&&actor.id===record.buyerId))return fail();
 return {ok:true,record:{...record}};
}
// INACTIVE proposal/rehearsal only. actor is synthetic context, never proof of
// identity. Real authorization/state history/confirmation must be server-trusted.
export function changeSampleEnquiry(context,actor,input){
 if(!plain(input)||typeof input.action!=='string'||!Number.isSafeInteger(input.revision)||input.revision<0||input.action!=='reply'&&Object.hasOwn(input,'reply')||Object.keys(input).some(k=>!['providerId','id','revision','action','reply'].includes(k))||input.providerId!==context?.provider?.id)return fail();
 const found=readSampleInboxDetail(context,actor,input.id);if(!found.ok)return found;
 const row=found.record;
 if(input.revision!==row.revision || row.revision===Number.MAX_SAFE_INTEGER)return {ok:false,code:'STALE_SAMPLE'};
 let allowed=false;
 if(actor.role==='provider'&&actor.id===row.providerId && Object.hasOwn(SAMPLE_PROVIDER_ACTIONS,input.action))allowed=SAMPLE_PROVIDER_ACTIONS[input.action].includes(row.status);
 if(actor.role==='buyer'&&actor.id===row.buyerId)allowed=input.action==='confirm-completion'&&row.status==='completion-requested'||input.action==='cancel'&&['new','viewed','accepted','in-progress'].includes(row.status)||input.action==='dispute'&&['in-progress','completion-requested'].includes(row.status);
 if(!allowed || input.action==='reply'&&!isSampleReply(input.reply))return fail();
 if(!['view','reply'].includes(input.action) && !rehearseSampleEnquiryTransition(context.provider,remoteRow(row),{actor:actor.role,nextStatus:remoteStatus(targets[input.action])}).ok)return fail();
 const changed={...row,revision:row.revision+1};
 if(input.action==='reply')changed.reply=input.reply;
 else changed.status=targets[input.action];
 if(input.action==='confirm-completion')changed.buyerConfirmed=true;
 return {ok:true,context:{provider:{...context.provider,services:[...context.provider.services]},records:context.records.map(r=>r.id===row.id?changed:{...r})}};
}

export function buildSampleBuyerInbox(context,actor,{status='all',service='all'}={}){
 if(!plain(actor)||actor.role!=='buyer'||typeof actor.id!=='string'||!ID.test(actor.id)||!validContext(context)||
   (status!=='all'&&!SAMPLE_ENQUIRY_STATES.includes(status))||(service!=='all'&&!context.provider.services.includes(service)))return fail();
 return {ok:true,items:context.records.filter(r=>r.buyerId===actor.id&&(status==='all'||r.status===status)&&(service==='all'||r.service===service))
  .map(r=>({id:r.id,service:r.service,status:r.status,revision:r.revision}))};
}
export function sampleBuyerActions(context,actor,id){
 const row=readSampleInboxDetail(context,actor,id);if(!row.ok||actor.role!=='buyer')return [];
 return ['cancel','dispute','confirm-completion'].filter(action=>changeSampleEnquiry(context,actor,{providerId:row.record.providerId,id,revision:row.record.revision,action}).ok);
}
