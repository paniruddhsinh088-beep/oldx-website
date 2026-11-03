import {createHash} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {safeId,copyRecord} from './isolated-firestore-context.mjs';
import {projectProviderEnquiryRead} from './provider-enquiry-transaction.mjs';
import {changeSampleEnquiry,SAMPLE_PROVIDER_ACTIONS,isSampleReply} from '../features/service-providers/preview-inbox-model.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),fail=code=>({ok:false,code});
export function createProviderEnquiryLifecycle({enabled=false,authenticate,repository,timeoutMs=5000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 async function run(kind,request,{credential,signal}={}){
  if(enabled!==true||typeof repository?.runTransaction!=='function')return fail('UNAVAILABLE');
  const OP=kind==='change'?'change-provider-private-enquiry':'cancel-provider-private-enquiry';
  const input=copyRecord(request,kind==='change'?['providerId','enquiryId','expectedRevision','requestId','action','reply']:kind==='read'?['providerId','enquiryId','expectedRevision']:['providerId','enquiryId','expectedRevision','requestId']);
  if(!input||!safeId(input.providerId)||!safeId(input.enquiryId)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||kind!=='read'&&!safeId(input.requestId))return fail('INVALID_REQUEST');
  if(kind==='change'&&(!Object.hasOwn(SAMPLE_PROVIDER_ACTIONS,input.action)||(input.action==='reply'?(!isSampleReply(input.reply)||!input.reply.trim()):input.reply!==null)))return fail('INVALID_REQUEST');
  return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,schedule,cancel,run:async context=>{
   if(kind!=='read')context.markMutationAttempted();let expected;
   const result=await repository.runTransaction(async tx=>{
    const actor=copyRecord(await tx.getEnquiryActor(context.actorUid),['uid','canEnquire','suspended']);context.checkpoint();if(!actor||actor.uid!==context.actorUid||typeof actor.canEnquire!=='boolean'||actor.suspended!==false)return expected=fail('DENIED');
    const row=await tx.getEnquiry(input.enquiryId),canonical=await tx.getPublishedProvider(input.providerId);context.checkpoint();if(!row||!canonical||row.providerId!==input.providerId)return expected=fail('UNAVAILABLE');
    // Never read block relationships for an unrelated caller.
    if(context.actorUid!==row.buyerUid&&context.actorUid!==canonical.ownerUid)return expected=fail('DENIED');
    const blocks=await tx.getParticipantBlocks(row.buyerUid,canonical.ownerUid);context.checkpoint();
    const projected=projectProviderEnquiryRead({kind:'enquiry',providerId:input.providerId,enquiryId:input.enquiryId,expectedRevision:row.revision},canonical,row,blocks,context.actorUid,{enabled:true});if(!projected.ok)return expected=fail('DENIED');
    if(kind==='read')return expected=row.revision===input.expectedRevision?projected:fail('REVISION_CONFLICT');
    if((kind==='change'?context.actorUid!==canonical.ownerUid:context.actorUid!==row.buyerUid)||actor.canEnquire!==true)return expected=fail('DENIED');
    const auditId=hash([OP,context.actorUid,input.requestId]),fingerprint=hash([OP,context.actorUid,input.providerId,input.enquiryId,input.expectedRevision,...(kind==='change'?[input.action,input.reply]:[])]);
    const old=await tx.getEnquiryReceipt(context.actorUid,input.requestId,OP);context.checkpoint();
    if(old!==null){const receipt=copyRecord(old,['operation','actorUid','requestId','providerId','enquiryId','fingerprint','auditId','revision']);const audit=await tx.getEnquiryAudit(auditId);context.checkpoint();if(!receipt||receipt.operation!==OP||receipt.actorUid!==context.actorUid||receipt.requestId!==input.requestId||receipt.providerId!==row.providerId||receipt.enquiryId!==row.id||receipt.fingerprint!==fingerprint||receipt.auditId!==auditId||receipt.revision!==input.expectedRevision+1||row.revision<receipt.revision||audit?.id!==auditId||audit.actorUid!==context.actorUid||audit.enquiryId!==row.id||audit.operation!==OP||audit.fromRevision!==input.expectedRevision||audit.toRevision!==receipt.revision||kind==='change'&&audit.action!==input.action)return expected=fail('IDEMPOTENCY_CONFLICT');return expected={ok:true,status:'replayed',enquiryId:row.id,revision:receipt.revision};}
    if(row.revision!==input.expectedRevision)return expected=fail('REVISION_CONFLICT');
    const sample={id:row.id,providerId:row.providerId,buyerId:row.buyerUid,service:row.service,status:row.status,note:row.note,reply:row.reply,revision:row.revision,buyerConfirmed:row.buyerConfirmed};
    const changed=changeSampleEnquiry({provider:{id:row.providerId,published:true,services:canonical.services},records:[sample]},{role:kind==='change'?'provider':'buyer',id:kind==='change'?row.providerId:context.actorUid},{providerId:row.providerId,id:row.id,revision:row.revision,action:kind==='change'?input.action:'cancel',...(kind==='change'&&input.action==='reply'?{reply:input.reply}:{})});if(!changed.ok)return expected=fail('DENIED');
    const next=changed.context.records[0];context.checkpoint();await tx.stageEnquiryUpdate({record:{...row,status:next.status,reply:next.reply,revision:next.revision},receipt:{operation:OP,actorUid:context.actorUid,requestId:input.requestId,providerId:row.providerId,enquiryId:row.id,fingerprint,auditId,revision:next.revision},audit:{id:auditId,operation:OP,actorUid:context.actorUid,providerId:row.providerId,enquiryId:row.id,requestId:input.requestId,fromRevision:row.revision,toRevision:next.revision,...(kind==='change'?{action:input.action}:{})}});context.checkpoint();return expected={ok:true,status:kind==='change'?'changed':'cancelled',enquiryId:row.id,revision:next.revision};
   },{signal:context.signal,deadlineAt:context.deadlineAt});
   if(JSON.stringify(result)!==JSON.stringify(expected))throw new Error('Invalid lifecycle acknowledgement');return result;
  }});
 }
 return Object.freeze({read:(...args)=>run('read',...args),cancel:(...args)=>run('cancel',...args),change:(...args)=>run('change',...args)});
}
