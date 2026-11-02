import {deriveOtherChatParticipant,authorizeMessageAgainstBlock} from './chat-block-relationship-policy.mjs';
import {authorizeChatMutation,validateMessageId} from './chat-message-authorization-policy.mjs';
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const deny=()=>({ok:false,code:'ENQUIRY_MESSAGE_UNAVAILABLE'});
// INACTIVE trusted-server composition proposal. Never imported by a browser.
// Context must come from authenticated canonical reads, not a request body.
export function prepareEnquiryMessageIntent(context,request,actorUid,{enabled=false}={}){
 if(enabled!==true||!plain(context)||!plain(request)||Object.keys(request).sort().join(',')!=='clientRequestId,enquiryId,expectedRevision,text')return deny();
 if(!validateMessageId(context.enquiryId)||!validateMessageId(context.buyerUid)||!validateMessageId(context.providerUid)||
   context.buyerUid===context.providerUid||context.providerPublished!==true||context.messagingAllowed!==true||
   request.enquiryId!==context.enquiryId||!Number.isSafeInteger(context.revision)||context.revision<0||request.expectedRevision!==context.revision||
   !validateMessageId(request.clientRequestId)||typeof request.text!=='string'||request.text.length>2000||!request.text.trim()||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(request.text))return deny();
 const participants=[context.buyerUid,context.providerUid],other=deriveOtherChatParticipant({actorUid,participants});
 if(!other.ok)return deny();
 const recipientBlocked=actorUid===context.buyerUid?context.providerBlockedBuyer:context.buyerBlockedProvider;
 const senderBlocked=actorUid===context.buyerUid?context.buyerBlockedProvider:context.providerBlockedBuyer;
 if(!authorizeMessageAgainstBlock({senderUid:actorUid,recipientUid:other.otherUid,chatParticipants:participants,blockedByRecipient:recipientBlocked}).ok||
    !authorizeMessageAgainstBlock({senderUid:other.otherUid,recipientUid:actorUid,chatParticipants:participants,blockedByRecipient:senderBlocked}).ok||
    !authorizeChatMutation({action:'send',actorUid,senderUid:actorUid,participants,blocked:false}).ok)return deny();
 return {ok:true,value:{enquiryId:context.enquiryId,expectedRevision:context.revision,clientRequestId:request.clientRequestId,
  senderUid:actorUid,recipientUid:other.otherUid,text:request.text.normalize('NFC').trim()}};
}
