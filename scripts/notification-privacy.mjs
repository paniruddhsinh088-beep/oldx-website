import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {authorizeChatRead,authorizeChatSend} from './chat-privacy-policy.mjs';
// Normalized facts come ONLY from injected transactional server readers. Missing
// legacy/visibility facts are unknown (null), never assumed publicly deliverable.
export function createNotificationPrivacyPolicy({readWorker,readThread,readMessage,readRecipient,readBlock}={}){
 const configured=[readWorker,readThread,readMessage,readRecipient,readBlock].every(f=>typeof f==='function');
 async function maintenance(tx,ctx){if(!configured)return false;const w=copyRecord(await readWorker(tx,ctx.actorUid),['uid','role','active']);ctx.checkpoint();return !!w&&w.uid===ctx.actorUid&&w.role==='notification-worker'&&w.active===true;}
 return Object.freeze({authorizeMaintenance:maintenance,async authorizeDelivery(tx,event,ctx){if(!configured||!await maintenance(tx,ctx))return null;
  const e=copyRecord(event,['kind','threadId','sequence','senderUid','recipientUid']);if(!e||!['product','provider'].includes(e.kind)||![e.threadId,e.senderUid,e.recipientUid].every(safeId)||e.senderUid===e.recipientUid||!Number.isSafeInteger(e.sequence)||e.sequence<1)return null;
  const t=copyRecord(await readThread(tx,e),['kind','threadId','participantUids','active','revision']);ctx.checkpoint();if(!t||t.kind!==e.kind||t.threadId!==e.threadId||typeof t.active!=='boolean'||!Number.isSafeInteger(t.revision)||t.revision<e.sequence||!Array.isArray(t.participantUids)||t.participantUids.length!==2||!t.participantUids.every(safeId)||new Set(t.participantUids).size!==2||![e.senderUid,e.recipientUid].every(uid=>t.participantUids.includes(uid)))return null;
  const m=copyRecord(await readMessage(tx,e),['threadId','sequence','senderUid','deletedForEveryone','hiddenFor','authorizedRecipientUids']),r=copyRecord(await readRecipient(tx,e.recipientUid,e),['uid','enabled','suspended']);ctx.checkpoint();if(!m||m.threadId!==e.threadId||m.sequence!==e.sequence||m.senderUid!==e.senderUid||typeof m.deletedForEveryone!=='boolean'||!Array.isArray(m.hiddenFor)||m.hiddenFor.some(uid=>!t.participantUids.includes(uid))||!Array.isArray(m.authorizedRecipientUids)||m.authorizedRecipientUids.some(uid=>!t.participantUids.includes(uid))||!r||r.uid!==e.recipientUid||typeof r.enabled!=='boolean'||typeof r.suspended!=='boolean')return null;
  const edges=[];for(const[a,b]of[[e.senderUid,e.recipientUid],[e.recipientUid,e.senderUid]]){const v=copyRecord(await readBlock(tx,a,b),['blockerUid','blockedUid','blocked']);ctx.checkpoint();if(!v||v.blockerUid!==a||v.blockedUid!==b||typeof v.blocked!=='boolean')return null;if(v.blocked)edges.push(v);}
  const access=authorizeChatRead({verifiedUid:e.recipientUid,participants:t.participantUids,hiddenFor:m.hiddenFor,deletedForEveryone:m.deletedForEveryone}),send=authorizeChatSend({verifiedUid:e.senderUid,senderUid:e.senderUid,recipientUid:e.recipientUid,participants:t.participantUids,blockEdges:edges});
  return t.active&&r.enabled&&!r.suspended&&m.authorizedRecipientUids.includes(e.recipientUid)&&access.ok&&access.visible&&send.ok;
 }});
}
