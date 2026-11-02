import {createHash} from 'node:crypto';
import {inspectProviderDraftRequest,prepareProviderDraftIntent} from './provider-draft-preparation.mjs';
import {runVerifiedOperation} from './verified-operation.mjs';
const OP='save-provider-private-draft';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const revision=v=>Number.isSafeInteger(v)&&v>=0;
function copy(input,keys){try{if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).sort().join(',')!==[...keys].sort().join(','))return null;const out={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;}catch{return null;}}
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=code=>({ok:false,code});
// Default-disabled injected transaction adapter. No SDK, endpoint or public writes.
// Repository MUST atomically commit owner mapping + private draft + receipt + audit,
// enforce uniqueness/read conflicts, and retry callback only against fresh reads.
export function createProviderDraftTransaction({enabled=false,authenticate,repository,providerIdForActor,timeoutMs=5000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 return Object.freeze({async save(request,{credential,signal}={}){
  if(enabled!==true)return fail('UNAVAILABLE');
  const input=inspectProviderDraftRequest(request);
  if(!input)return fail('INVALID_REQUEST');
  if(typeof repository?.runTransaction!=='function'||typeof providerIdForActor!=='function')return fail('UNAVAILABLE');
  return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,schedule,cancel,run:async context=>{
   const {actorUid,checkpoint}=context;if(!id(actorUid))return fail('UNAVAILABLE');
   const candidate=providerIdForActor(actorUid);if(!id(candidate))return fail('UNAVAILABLE');
   const normalized=prepareProviderDraftIntent(input,{providerId:candidate,ownerUid:actorUid,revision:input.expectedRevision,status:'draft'},actorUid,{enabled:true});
   if(!normalized)return fail('INVALID_REQUEST');
   const {id:ignored,...content}=normalized.draft;
   const fingerprint=hash([OP,actorUid,input.expectedRevision,content]),auditId=hash([OP,actorUid,input.requestId]);
   checkpoint();context.markMutationAttempted();
   const mutate=async tx=>{
    checkpoint();
    const actor=copy(await tx.getActorState(actorUid),['uid','canWrite','suspended']);checkpoint();
    if(!actor||actor.uid!==actorUid||actor.canWrite!==true||actor.suspended!==false)return fail('DENIED');
    const stored=await tx.getOwnedProvider(actorUid);checkpoint();
    const canonical=stored===null?null:copy(stored,['providerId','ownerUid','revision','status']);
    if(stored!==null&&(!canonical||canonical.ownerUid!==actorUid||!id(canonical.providerId)||!revision(canonical.revision)||!['draft','published'].includes(canonical.status)))return fail('DENIED');
    const providerId=canonical?.providerId??candidate;
    const rawIdentity=await tx.getProviderIdentity(providerId);checkpoint();
    const identity=rawIdentity===null?null:copy(rawIdentity,['providerId','ownerUid']);
    if(canonical===null?rawIdentity!==null:!identity||identity.providerId!==providerId||identity.ownerUid!==actorUid)return fail('DENIED');
    const rawDraft=await tx.getDraftMetadata(providerId);checkpoint();
    const draft=rawDraft===null?null:copy(rawDraft,['providerId','ownerUid','revision']);
    if(rawDraft!==null&&(!draft||draft.providerId!==providerId||draft.ownerUid!==actorUid||!revision(draft.revision)))return fail('DENIED');
    const rawReceipt=await tx.getIdempotency(actorUid,OP,input.requestId);checkpoint();
    if(rawReceipt!==null){
     const receipt=copy(rawReceipt,['operation','actorUid','providerId','requestId','fingerprint','revision','auditId']);
     if(!receipt||receipt.operation!==OP||receipt.actorUid!==actorUid||receipt.providerId!==providerId||receipt.requestId!==input.requestId||receipt.fingerprint!==fingerprint||receipt.auditId!==auditId||!revision(receipt.revision)||receipt.revision<1)return fail('IDEMPOTENCY_CONFLICT');
     if(!canonical||!draft||canonical.revision!==draft.revision||canonical.revision<receipt.revision)return fail('CONFLICT');
     const audit=copy(await tx.getAudit(auditId),['id','operation','actorUid','providerId','requestId','fromRevision','toRevision']);checkpoint();
     if(!audit||audit.id!==auditId||audit.operation!==OP||audit.actorUid!==actorUid||audit.providerId!==providerId||audit.requestId!==input.requestId||audit.toRevision!==receipt.revision||audit.fromRevision!==receipt.revision-1)return fail('CONFLICT');
     return {ok:true,status:'replayed',providerId,revision:receipt.revision};
    }
    if(canonical===null){if(draft!==null||input.expectedRevision!==0)return fail('REVISION_CONFLICT');}
    else if(draft===null||draft.revision!==canonical.revision||input.expectedRevision!==canonical.revision)return fail('REVISION_CONFLICT');
    const base=canonical??{providerId,ownerUid:actorUid,revision:0,status:'draft'};
    const intent=prepareProviderDraftIntent(input,base,actorUid,{enabled:true});if(!intent)return fail('DENIED');
    const nextRevision=base.revision+1;
    const audit={id:auditId,operation:OP,actorUid,providerId,requestId:input.requestId,fromRevision:base.revision,toRevision:nextRevision};
    // All canonical reads precede staging. No public data/generation/status changes.
    checkpoint();
    await tx.stagePrivateDraft({mode:canonical===null?'create':'update',identity:{providerId,ownerUid:actorUid},canonical:{...base,revision:nextRevision},
     draft:{providerId,ownerUid:actorUid,revision:nextRevision,profile:intent.draft},
     receipt:{operation:OP,actorUid,providerId,requestId:input.requestId,fingerprint,revision:nextRevision,auditId},audit});
    checkpoint();return {ok:true,status:'saved',providerId,revision:nextRevision};
   };
   let expectedOutcome;
   const outcome=await repository.runTransaction(async tx=>{expectedOutcome=await mutate(tx);return expectedOutcome;},{signal:context.signal,deadlineAt:context.deadlineAt});
   const safe=expectedOutcome&&copy(outcome,Object.keys(expectedOutcome));
   if(!safe||!Object.entries(expectedOutcome).every(([key,value])=>safe[key]===value))throw new Error('Invalid transaction acknowledgement');
   return safe;
  }});
 }});
}
