import {createHash} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {buildPublicProviderProfile} from '../features/service-providers/provider-public-profile.mjs';
import {normalizeServiceSelections} from '../features/service-providers/service-selections.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),integer=v=>Number.isSafeInteger(v)&&v>=0;
const operations={'draft.save':'save-provider-private-draft','publication.manage':'provider-publication'};
const fail=code=>({ok:false,code});
function copy(input,keys){try{if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).sort().join(',')!==[...keys].sort().join(','))return null;return Object.fromEntries(keys.map(k=>{const d=Object.getOwnPropertyDescriptor(input,k);if(!d||!Object.hasOwn(d,'value'))throw new Error();return [k,d.value];}));}catch{return null;}}
// Default-disabled private owner read. No request UID/providerId, allocation,
// persistence or publication. Never feed this private DTO into public renderers.
export function createProviderOwnerBootstrap({enabled=false,authenticate,repository,timeoutMs=5000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 return Object.freeze({async load(request,{credential,signal}={}){
  if(enabled!==true||typeof repository?.runTransaction!=='function')return fail('UNAVAILABLE');
  const r=copy(request,['operation','requestId']);if(!r||!(r.operation===null&&r.requestId===null||typeof r.operation==='string'&&Object.hasOwn(operations,r.operation)&&id(r.requestId)))return fail('INVALID_REQUEST');
  return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,schedule,cancel,run:async context=>{
   const uid=context.actorUid;if(!id(uid))return fail('DENIED');let expected;
   const result=await repository.runTransaction(async tx=>{
    const read=async()=>{
     const check=context.checkpoint;check();const actor=copy(await tx.getActorState(uid),['uid','canWrite','suspended']);check();
     if(!actor||actor.uid!==uid||actor.canWrite!==true||actor.suspended!==false)return fail('DENIED');
     const generation=copy(await tx.getGeneration(),['value']);check();if(!generation||!integer(generation.value))return fail('CONFLICT');
     const raw=await tx.getOwnedProvider(uid);check();let canonical=null,draft=null,publication=null;
     if(raw!==null){
      canonical=copy(raw,['providerId','ownerUid','revision','status']);
      if(!canonical||canonical.ownerUid!==uid||!id(canonical.providerId)||!integer(canonical.revision)||!['draft','published'].includes(canonical.status))return fail('DENIED');
      const identity=copy(await tx.getProviderIdentity(canonical.providerId),['providerId','ownerUid']);check();
      if(!identity||identity.providerId!==canonical.providerId||identity.ownerUid!==uid)return fail('DENIED');
      const stored=copy(await tx.getDraft(canonical.providerId),['providerId','ownerUid','revision','profile']);check();
      if(!stored||stored.providerId!==canonical.providerId||stored.ownerUid!==uid||stored.revision!==canonical.revision)return fail('CONFLICT');
      const source=copy(stored.profile,['id','displayName','city','serviceArea','services','available','experienceYears','description','languages']);
      const projected=buildPublicProviderProfile(source);if(!source||source.id!==canonical.providerId||!projected.ok)return fail('CONFLICT');
      const {id:ignored,...editable}=projected.profile;draft=editable;
      const rawPublication=await tx.getPublication(canonical.providerId);check();
      if(rawPublication!==null){publication=copy(rawPublication,['providerId','ownerUid','published','services','publicationEpoch']);if(!publication||publication.providerId!==canonical.providerId||publication.ownerUid!==uid||typeof publication.published!=='boolean'||!integer(publication.publicationEpoch)||publication.publicationEpoch>generation.value||!normalizeServiceSelections(publication.services).ok)return fail('CONFLICT');}
      if((canonical.status==='published')!==(publication?.published===true))return fail('CONFLICT');
     }
     const rawPermission=await tx.getPublicationPermission(uid);check();let permission=null;
     if(rawPermission!==null){permission=copy(rawPermission,['uid','canPublish','canWithdraw','suspended']);if(!permission||permission.uid!==uid||typeof permission.canPublish!=='boolean'||typeof permission.canWithdraw!=='boolean'||typeof permission.suspended!=='boolean')return fail('DENIED');}
     let receipt=null;
     if(r.operation!==null){
      const operation=operations[r.operation],stored=await tx.getIdempotency(uid,operation,r.requestId);check();
      // Absent is not failed: the original commit may still be in flight.
      receipt={operation:r.operation,status:'unknown'};
      if(stored!==null){
       const isDraft=r.operation==='draft.save',keys=isDraft?['operation','actorUid','providerId','requestId','fingerprint','revision','auditId']:['operation','actorUid','providerId','requestId','fingerprint','generation','action','auditId'];
       const fact=copy(stored,keys),auditId=createHash('sha256').update(JSON.stringify([operation,uid,r.requestId])).digest('hex');
       if(!canonical||!fact||fact.operation!==operation||fact.actorUid!==uid||fact.providerId!==canonical.providerId||fact.requestId!==r.requestId||typeof fact.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(fact.fingerprint)||fact.auditId!==auditId)return fail('CONFLICT');
       const value=isDraft?fact.revision:fact.generation;if(!integer(value)||value<1||value>(isDraft?canonical.revision:generation.value)||!isDraft&&!['publish','withdraw'].includes(fact.action))return fail('CONFLICT');
       const audit=copy(await tx.getAudit(auditId),isDraft?['id','operation','actorUid','providerId','requestId','fromRevision','toRevision']:['id','operation','actorUid','providerId','requestId','fromGeneration','toGeneration','action']);check();
       if(!audit||audit.id!==auditId||audit.operation!==operation||audit.actorUid!==uid||audit.providerId!==canonical.providerId||audit.requestId!==r.requestId||(isDraft?audit.fromRevision!==value-1||audit.toRevision!==value:audit.fromGeneration!==value-1||audit.toGeneration!==value||audit.action!==fact.action))return fail('CONFLICT');
       receipt=isDraft?{operation:r.operation,status:'committed',revision:value}:{operation:r.operation,status:'committed',generation:value,action:fact.action};
      }
     }
     return {ok:true,schemaVersion:1,exists:canonical!==null,providerId:canonical?.providerId??null,revision:canonical?.revision??0,generation:generation.value,published:publication?.published??false,publicationGeneration:publication?.publicationEpoch??0,
      capabilities:{canSaveDraft:true,canPublish:!!canonical&&permission?.suspended===false&&permission.canPublish===true,canWithdraw:publication?.published===true&&permission?.suspended===false&&permission.canWithdraw===true},draft,receipt};
    };expected=await read();return expected;
   },{signal:context.signal,deadlineAt:context.deadlineAt});
   // Reject driver additions/alterations, return only our own private projection.
   if(!expected||JSON.stringify(result)!==JSON.stringify(expected))throw new Error('Invalid bootstrap acknowledgement');return structuredClone(expected);
  }});
 }});
}
