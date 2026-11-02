import {createBoundedRead} from '../shared/bounded-read.mjs';
import {readSampleConversation,createSampleConversationMessages} from './preview-conversation.mjs';
import {createSampleBuyerInbox} from './preview-inbox-fixtures.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export function projectSampleConversationRead(response,request){
 if(!request||Object.keys(request).sort().join(',')!=='enquiryId,providerId,role'||!['buyer','provider'].includes(request.role)||!id(request.providerId)||!id(request.enquiryId)||
   !response||response.providerId!==request.providerId||response.enquiryId!==request.enquiryId||response.role!==request.role||
   response.blocks?.buyerBlocked!==false||response.blocks?.providerBlocked!==false)return null;
 const view=readSampleConversation(response.context,{role:request.role,id:request.role==='provider'?request.providerId:'sample-buyer-1'},
  {providerId:request.providerId,enquiryId:request.enquiryId,revision:response.revision},response.messages,response.blocks);
 if(!view.ok)return null;
 return Object.freeze({...view,enquiry:Object.freeze(view.enquiry),items:Object.freeze(view.items.map(Object.freeze))});
}
export function createConversationRead(options){return createBoundedRead({...options,project:projectSampleConversationRead});}
// Only synthetic, bounded local fixtures. No fetch, account, persistence or SDK.
export function createMockConversationRead({mode=()=> 'normal',unavailable=()=>false,schedule=setTimeout,cancel=clearTimeout}={}){
 return (request,{signal})=>new Promise((resolve,reject)=>{
  const selected=mode();let timer=null;
  function cleanup(){if(timer!==null)cancel(timer);signal.removeEventListener('abort',abort);}
  function abort(){cleanup();reject(new Error('Sample read cancelled'));}
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
  if(selected==='timeout')return;
  timer=schedule(()=>{cleanup();if(selected==='error'){reject(new Error('Sample read failure'));return;}
   const context=createSampleBuyerInbox(request.providerId);if(context)context.provider.published=!unavailable();
   resolve(selected==='invalid'?{}:{...request,context,revision:0,blocks:{buyerBlocked:unavailable(),providerBlocked:false},
    messages:selected==='empty'?[]:createSampleConversationMessages(context,request.enquiryId)});
  },selected==='slow'?350:15);
 });
}
