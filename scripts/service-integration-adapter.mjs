import {buildPublicProviderProfile} from '../features/service-providers/provider-public-profile.mjs';
import {readSampleInboxDetail} from '../features/service-providers/preview-inbox-model.mjs';
import {readSampleConversation} from '../features/service-providers/preview-conversation.mjs';
const deny=()=>({ok:false,code:'SERVICE_READ_UNAVAILABLE'});
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
// INACTIVE server-side response adapter. No transport, SDK, identity lookup or
// permission inference. Canonical facts must be supplied by a future trusted
// server adapter after policy approval; browser flags can never supply proof.
export function projectServiceIntegrationResponse(request,trusted,actor,{enabled=false}={}) {
 if(enabled!==true||!plain(request)||!plain(trusted)||!['profile','enquiry','conversation'].includes(request.kind)||
  Object.keys(request).sort().join(',')!=='enquiryId,expectedRevision,kind,providerId'||!id(request.providerId)||
  !Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0||trusted.providerId!==request.providerId||
  trusted.revision!==request.expectedRevision||trusted.published!==true)return deny();
 if(request.kind==='profile'){
  if(request.enquiryId!==null||trusted.publicProfile?.id!==request.providerId)return deny();
  const projected=buildPublicProviderProfile(trusted.publicProfile);
  return projected.ok?{ok:true,kind:'profile',revision:trusted.revision,value:projected.profile}:deny();
 }
 if(!id(request.enquiryId)||trusted.context?.provider?.id!==request.providerId||!plain(actor))return deny();
 const detail=readSampleInboxDetail(trusted.context,actor,request.enquiryId);
 if(!detail.ok||detail.record.revision!==request.expectedRevision)return deny();
 if(request.kind==='enquiry'){
  const r=detail.record;
  // Private participant-only DTO; never use for public catalogue/profile reads.
  return {ok:true,kind:'enquiry',revision:r.revision,value:{id:r.id,providerId:r.providerId,service:r.service,status:r.status,note:r.note,reply:r.reply}};
 }
 // Unknown block state cannot be turned into permission by preview defaults.
 if(!plain(trusted.blocks)||trusted.blocks.buyerBlocked!==false||trusted.blocks.providerBlocked!==false)return deny();
 const view=readSampleConversation(trusted.context,actor,{providerId:request.providerId,enquiryId:request.enquiryId,revision:request.expectedRevision},trusted.messages,trusted.blocks);
 return view.ok?{ok:true,kind:'conversation',revision:trusted.revision,value:view.items}:deny();
}
