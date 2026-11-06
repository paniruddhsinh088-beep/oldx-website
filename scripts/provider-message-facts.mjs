import {copyRecord} from './isolated-firestore-context.mjs';
import {productMessageFacts,productMessageVisible} from './product-message-facts.mjs';
// Map the existing canonical Provider schema into the shared private-message v1
// visibility contract; unknown fields/foreign enquiry identities stay unavailable.
function map(message,thread){if(!message||typeof message!=='object'||!thread)return null;const keys=['providerId','enquiryId','sequence','senderUid','text',...['readPrefix','committedAt','hiddenFor','deletedForEveryone'].filter(k=>Object.hasOwn(message,k))],m=copyRecord(message,keys);if(!m||m.providerId!==thread.providerId||m.enquiryId!==thread.enquiryId)return null;const {providerId,enquiryId,...fields}=m;return {message:{...fields,threadId:enquiryId},thread:{id:thread.enquiryId,buyerUid:thread.buyerUid,sellerUid:thread.providerUid,revision:thread.revision}};}
export function providerMessageFacts(message,thread){const v=map(message,thread);return v?productMessageFacts(v.message,v.thread):null;}
export function providerMessageVisible(message,thread,uid){const v=map(message,thread);return v?productMessageVisible(v.message,v.thread,uid):false;}
