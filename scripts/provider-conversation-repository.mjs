import {createHash} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {projectProviderEnquiryRead} from './provider-enquiry-transaction.mjs';
import {prepareEnquiryMessageIntent} from './enquiry-message-intent.mjs';
import {normalizeMessageDraft} from '../features/chat/message-text.mjs';
export const SERVICE_CONVERSATION_TEST_SCHEMA=Object.freeze(Object.fromEntries(['threads','messages','receipts','audits'].map(k=>[k,'testOldxServiceChat'+k[0].toUpperCase()+k.slice(1)])));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const int=v=>Number.isSafeInteger(v)&&v>=0&&v<10000,fail=code=>({ok:false,code});
const writable=status=>['new','viewed','accepted','in-progress','completion-requested'].includes(status);
// Inactive trusted ports. The injected enquiry repository supplies the same atomic
// SDK transaction for fresh publication/participants/blocks and all message writes.
export function createProviderConversationRepository({enabled=false,authenticate,repository,timeoutMs=5000,now=Date.now}={}){
 const run=(options,work)=>enabled&&typeof repository?.runTransaction==='function'?runVerifiedOperation({authenticate,credential:options?.credential,signal:options?.signal,timeoutMs,now,run:c=>repository.runTransaction(tx=>work(tx,c),c)}):Promise.resolve(fail('UNAVAILABLE'));
 async function authority(tx,c,input){
  const row=await tx.getEnquiry(input.enquiryId),p=await tx.getPublishedProvider(input.providerId);
  if(!row||row.id!==input.enquiryId||!p)return null;
  const blocks=await tx.getParticipantBlocks(row.buyerUid,row.providerUid);
  const allowed=projectProviderEnquiryRead({kind:'enquiry',providerId:input.providerId,enquiryId:input.enquiryId,expectedRevision:row.revision},p,row,blocks,c.actorUid,{enabled:true});
  if(!allowed.ok)return null;
  for(const uid of [row.buyerUid,row.providerUid]){const actor=await tx.getEnquiryActor(uid);if(actor?.uid!==uid||actor.canEnquire!==true||actor.suspended!==false)return null;}
  const stored=await tx.getConversation(row.id);
  if(stored&&(!copyRecord(stored,['providerId','enquiryId','buyerUid','providerUid','service','revision'])||stored.providerId!==row.providerId||stored.enquiryId!==row.id||stored.buyerUid!==row.buyerUid||stored.providerUid!==row.providerUid||stored.service!==row.service||!int(stored.revision)||stored.revision<1))return null;
  const thread=stored??{providerId:row.providerId,enquiryId:row.id,buyerUid:row.buyerUid,providerUid:row.providerUid,service:row.service,revision:0};
  const dto={providerId:row.providerId,enquiryId:row.id,service:row.service,revision:thread.revision,enquiryRevision:row.revision,generation:p.generation,role:c.actorUid===row.buyerUid?'buyer':'provider',canSend:writable(row.status)&&thread.revision<9999};
  return {row,p,blocks,thread,dto};
 }
 return Object.freeze({
  async read(request,options){const input=copyRecord(request,['providerId','enquiryId','expectedRevision','afterSequence','limit']);if(!input||!safeId(input.providerId)||!safeId(input.enquiryId)||input.expectedRevision!==null&&!int(input.expectedRevision)||!int(input.afterSequence)||!Number.isInteger(input.limit)||input.limit<1||input.limit>20)return fail('INVALID_REQUEST');
   return run(options,async(tx,c)=>{const a=await authority(tx,c,input);if(!a)return fail('DENIED');if(input.expectedRevision!==null&&input.expectedRevision!==a.thread.revision)return fail('REVISION_CONFLICT');if(input.afterSequence>a.thread.revision)return fail('INVALID_REQUEST');const messages=[];
    for(let n=input.afterSequence+1;n<=Math.min(a.thread.revision,input.afterSequence+input.limit);n++){const m=await tx.getConversationMessage(input.enquiryId,n);if(!copyRecord(m,['providerId','enquiryId','sequence','senderUid','text'])||m.providerId!==input.providerId||m.enquiryId!==input.enquiryId||m.sequence!==n||![a.row.buyerUid,a.row.providerUid].includes(m.senderUid)||normalizeMessageDraft(m.text)===null)return fail('UNAVAILABLE');messages.push({sequence:n,role:m.senderUid===a.row.buyerUid?'buyer':'provider',text:m.text});}
    c.checkpoint();return {ok:true,thread:a.dto,messages,hasMore:input.afterSequence+messages.length<a.thread.revision};});
  },
  async send(request,options){const input=copyRecord(request,['providerId','enquiryId','expectedRevision','expectedEnquiryRevision','expectedGeneration','requestId','text']);const text=input?.text;if(!input||!safeId(input.providerId)||!safeId(input.enquiryId)||!safeId(input.requestId)||!int(input.expectedRevision)||!int(input.expectedEnquiryRevision)||!Number.isSafeInteger(input.expectedGeneration)||input.expectedGeneration<1||normalizeMessageDraft(text)===null)return fail('INVALID_REQUEST');input.text=text;
   return run(options,async(tx,c)=>{const a=await authority(tx,c,input);if(!a)return fail('DENIED');const fingerprint=hash(input),receipt=await tx.getConversationReceipt(c.actorUid,input.requestId),audit=await tx.getConversationAudit(c.actorUid,input.requestId);
    if(receipt){const message=await tx.getConversationMessage(input.enquiryId,receipt.revision);if(!copyRecord(receipt,['actorUid','requestId','providerId','enquiryId','revision','fingerprint'])||!copyRecord(audit,['actorUid','requestId','providerId','enquiryId','revision','fingerprint'])||audit.requestId!==input.requestId||!int(receipt.revision)||receipt.revision<1||receipt.actorUid!==c.actorUid||receipt.requestId!==input.requestId||receipt.fingerprint!==fingerprint||receipt.enquiryId!==input.enquiryId||receipt.providerId!==input.providerId||receipt.revision>a.thread.revision||audit?.actorUid!==c.actorUid||audit.fingerprint!==fingerprint||audit.revision!==receipt.revision||audit.enquiryId!==input.enquiryId||audit.providerId!==input.providerId||message?.senderUid!==c.actorUid||message.text!==text||message.enquiryId!==input.enquiryId||message.providerId!==input.providerId||message.sequence!==receipt.revision)return fail('IDEMPOTENCY_CONFLICT');return {ok:true,status:'replayed',thread:{...a.dto,revision:receipt.revision}};}
    if(!a.dto.canSend)return fail('DENIED');
    const intent=prepareEnquiryMessageIntent({enquiryId:a.row.id,buyerUid:a.row.buyerUid,providerUid:a.row.providerUid,providerPublished:true,messagingAllowed:a.dto.canSend,revision:a.row.revision,providerBlockedBuyer:a.blocks.providerBlocked,buyerBlockedProvider:a.blocks.buyerBlocked},{enquiryId:input.enquiryId,expectedRevision:a.row.revision,clientRequestId:input.requestId,text},c.actorUid,{enabled:true});if(!intent.ok)return fail('DENIED');
    if(audit||a.thread.revision!==input.expectedRevision||a.row.revision!==input.expectedEnquiryRevision||a.p.generation!==input.expectedGeneration)return fail('REVISION_CONFLICT');
    const revision=a.thread.revision+1,record={actorUid:c.actorUid,requestId:input.requestId,providerId:input.providerId,enquiryId:input.enquiryId,revision,fingerprint};
    c.markMutationAttempted();tx.stageConversation({expectedRevision:a.thread.revision,thread:{...a.thread,revision},message:{providerId:input.providerId,enquiryId:input.enquiryId,sequence:revision,senderUid:intent.value.senderUid,text},receipt:record,audit:record});c.checkpoint();return {ok:true,status:'sent',thread:{...a.dto,revision,canSend:revision<9999}};
   });
  }
 });
}
