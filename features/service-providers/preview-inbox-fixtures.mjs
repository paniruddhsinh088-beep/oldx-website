import { demoProviders } from './preview-fixtures.mjs';
import { SAMPLE_ENQUIRY_STATES } from './preview-inbox-model.mjs';
// Authored sample notes only; never fetch, merge or persist real enquiries here.
export function createSampleInbox(providerId){
 const p=demoProviders.find(p=>p.id===providerId);if(!p)return null;
 return {provider:{id:p.id,name:p.name,services:[...p.services],published:true},records:SAMPLE_ENQUIRY_STATES.map((status,index)=>({
  id:`${p.id}-sample-${index+1}`,providerId:p.id,buyerId:`sample-buyer-${index+1}`,service:p.services[index%p.services.length],status,
  note:'નમૂનાનું કામ · नमूना काम · Sample repair only. No real buyer.',reply:'',revision:0,buyerConfirmed:status==='completed'
 }))};
}

export const SAMPLE_BUYERS=Object.freeze(['sample-buyer-1','sample-buyer-2']);
export function createSampleBuyerInbox(providerId){
 const context=createSampleInbox(providerId);if(!context)return null;
 return {...context,records:context.records.map((row,index)=>({...row,buyerId:index===1?'sample-buyer-2':'sample-buyer-1',
   reply:['new','viewed'].includes(row.status)?'':'નમૂનાનો પ્રદાતા જવાબ · नमूना उत्तर · Sample response only.'}))};
}
