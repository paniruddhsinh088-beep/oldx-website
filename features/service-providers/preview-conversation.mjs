import {readSampleInboxDetail} from './preview-inbox-model.mjs';
import {normalizeMessageDraft} from '../chat/message-text.mjs';
const deny=()=>({ok:false,code:'SAMPLE_CONVERSATION_UNAVAILABLE'});
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
// Synthetic read projection. Canonical enquiry checks, never client authorization.
export function readSampleConversation(context,actor,scope,messages,{buyerBlocked=false,providerBlocked=false}={}) {
 if(!plain(scope)||Object.keys(scope).sort().join(',')!=='enquiryId,providerId,revision'||scope.providerId!==context?.provider?.id||
   buyerBlocked!==false||providerBlocked!==false)return deny();
 const detail=readSampleInboxDetail(context,actor,scope.enquiryId);
 if(!detail.ok||detail.record.revision!==scope.revision||!Array.isArray(messages)||messages.length>35)return deny();
 const row=detail.record,ids=new Set(),items=[];
 for(const m of messages){
  if(!plain(m)||typeof m.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(m.id)||ids.has(m.id)||m.enquiryId!==row.id||m.providerId!==row.providerId||
    m.service!==row.service||!['buyer','provider'].includes(m.role)||m.authorId!==(m.role==='buyer'?row.buyerId:row.providerId)||
    !Number.isSafeInteger(m.order)||m.order<0||items.length&&m.order<=items.at(-1).order||normalizeMessageDraft(m.text)===null)return deny();
  ids.add(m.id);items.push({id:m.id,role:m.role,text:normalizeMessageDraft(m.text),order:m.order});
 }
 return {ok:true,enquiry:{id:row.id,providerId:row.providerId,service:row.service,status:row.status,revision:row.revision},items,
  canDraft:['new','viewed','accepted','in-progress','completion-requested'].includes(row.status)};
}
export function inspectSampleConversationDraft(context,actor,scope,messages,blocks,text){
 const view=readSampleConversation(context,actor,scope,messages,blocks),normalized=normalizeMessageDraft(text);
 if(!view.ok||!view.canDraft||normalized===null)return deny();
 // A local preview only: never append, send, assign an ID or persist this text.
 return {ok:true,text:normalized};
}
export function createSampleConversationMessages(context,id){
 const row=context?.records.find(r=>r.id===id);if(!row)return [];
 return [{id:'sample-message-1',role:'buyer',authorId:row.buyerId,text:'નમૂનાનું કામ · नमूना काम · Sample repair only.',order:1},
 {id:'sample-message-2',role:'provider',authorId:row.providerId,text:'નમૂનાનો જવાબ · नमूना उत्तर · Sample response only.',order:2}]
 .map(m=>({...m,enquiryId:row.id,providerId:row.providerId,service:row.service}));
}
export function parseSampleConversationRoute(hash){
 if(hash==='')return {role:'buyer',providerId:'p1',enquiryId:'p1-sample-3'};
 if(typeof hash!=='string'||hash.length>260)return null;
 const match=/^#conversation\/(buyer|provider)\/([A-Za-z0-9_-]{1,100})\/([A-Za-z0-9_-]{1,100})$/.exec(hash);
 return match?{role:match[1],providerId:match[2],enquiryId:match[3]}:null;
}
