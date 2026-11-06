import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {authorizeChatRead} from './chat-privacy-policy.mjs';
// Known private Product-message v1 schema only. Legacy/unknown fields are never
// normalized into public visibility. Optional visibility flags must be well typed.
export function productMessageFacts(message,thread){
 if(!message||typeof message!=='object'||!thread)return null;
 const keys=['threadId','sequence','senderUid','text',...['committedAt','readPrefix','hiddenFor','deletedForEveryone'].filter(k=>Object.hasOwn(message,k))],m=copyRecord(message,keys),participants=[thread.buyerUid,thread.sellerUid];
 if(!m||!participants.every(safeId)||participants[0]===participants[1]||m.threadId!==thread.id||!Number.isSafeInteger(m.sequence)||m.sequence<1||m.sequence>thread.revision||!participants.includes(m.senderUid)||typeof m.text!=='string'||m.text.length>2000)return null;
 const hiddenFor=Object.hasOwn(m,'hiddenFor')?m.hiddenFor:[],deletedForEveryone=Object.hasOwn(m,'deletedForEveryone')?m.deletedForEveryone:false;
 if(typeof deletedForEveryone!=='boolean'||!Array.isArray(hiddenFor)||hiddenFor.length>2||new Set(hiddenFor).size!==hiddenFor.length||hiddenFor.some(uid=>!participants.includes(uid)))return null;
 return {threadId:m.threadId,sequence:m.sequence,senderUid:m.senderUid,deletedForEveryone,hiddenFor:[...hiddenFor],authorizedRecipientUids:[...participants]};
}
export function productMessageVisible(message,thread,uid){const facts=productMessageFacts(message,thread);if(!facts)return false;const access=authorizeChatRead({verifiedUid:uid,participants:facts.authorizedRecipientUids,hiddenFor:facts.hiddenFor,deletedForEveryone:facts.deletedForEveryone});return access.ok&&access.visible;}
