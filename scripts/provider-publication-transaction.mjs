import {createHash} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {buildPublicProviderProfile} from '../features/service-providers/provider-public-profile.mjs';
import {normalizeServiceSelections} from '../features/service-providers/service-selections.mjs';
import {planPublicProviderQuery,DISCOVERY_FIELDS} from '../features/service-providers/provider-discovery.mjs';
const OP='provider-publication',id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v),integer=v=>Number.isSafeInteger(v)&&v>=0;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),fail=code=>({ok:false,code});
function copy(input,keys){try{if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).sort().join(',')!==[...keys].sort().join(','))return null;return Object.fromEntries(keys.map(k=>{const d=Object.getOwnPropertyDescriptor(input,k);if(!d||!Object.hasOwn(d,'value'))throw new Error('Invalid record');return [k,d.value];}));}catch{return null;}}
// INACTIVE publication command. Independent permission + ownership + approved
// content checked inside transaction. Never publishes caller-supplied fields.
export function createProviderPublicationTransaction({enabled=false,authenticate,repository,catalog,mandatoryPhotos=false,timeoutMs=5000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
 const approvedCatalog=planPublicProviderQuery({category:'',locality:'',limit:1,cursor:null},catalog,{publicationEpoch:0})?{services:[...catalog.services],localities:catalog.localities.map(l=>({...l}))}:null;
 return Object.freeze({async execute(request,{credential,signal}={}){
  if(enabled!==true)return fail('UNAVAILABLE');
  const r=copy(request,['requestId','expectedRevision','expectedGeneration','action']);
  if(!r||!id(r.requestId)||!integer(r.expectedRevision)||!integer(r.expectedGeneration)||!['publish','withdraw'].includes(r.action))return fail('INVALID_REQUEST');
  if(typeof repository?.runTransaction!=='function'||!approvedCatalog)return fail('UNAVAILABLE');
  return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,schedule,cancel,run:async context=>{
   if(!id(context.actorUid))return fail('DENIED');
   const actorUid=context.actorUid,auditId=hash([OP,actorUid,r.requestId]);let expected;
   context.markMutationAttempted();
   const result=await repository.runTransaction(async tx=>{
    const mutate=async()=>{
     const check=context.checkpoint;check();
     const actor=copy(await tx.getActorState(actorUid),['uid','canWrite','suspended']);check();
     const permission=copy(await tx.getPublicationPermission(actorUid),['uid','canPublish','canWithdraw','suspended']);check();
     if(!actor||actor.uid!==actorUid||actor.canWrite!==true||actor.suspended!==false||!permission||permission.uid!==actorUid||permission.suspended!==false||(r.action==='publish'?permission.canPublish:permission.canWithdraw)!==true)return fail('DENIED');
     const canonical=copy(await tx.getOwnedProvider(actorUid),['providerId','ownerUid','revision','status']);check();
     if(!canonical||canonical.ownerUid!==actorUid||!id(canonical.providerId)||!integer(canonical.revision)||!['draft','published','suspended'].includes(canonical.status)||r.action==='publish'&&canonical.status==='suspended')return fail('DENIED');
     const providerId=canonical.providerId,identity=copy(await tx.getProviderIdentity(providerId),['providerId','ownerUid']);check();
     if(!identity||identity.providerId!==providerId||identity.ownerUid!==actorUid)return fail('DENIED');
     const generation=copy(await tx.getGeneration(),['value']);check();if(!generation||!integer(generation.value))return fail('CONFLICT');
     const fingerprint=hash([OP,actorUid,providerId,r.expectedRevision,r.expectedGeneration,r.action]);
     const stored=await tx.getIdempotency(actorUid,OP,r.requestId);check();
     if(stored!==null){
      const receipt=copy(stored,['operation','actorUid','providerId','requestId','fingerprint','generation','action','auditId']);
      if(!receipt||receipt.operation!==OP||receipt.actorUid!==actorUid||receipt.providerId!==providerId||receipt.requestId!==r.requestId||receipt.fingerprint!==fingerprint||receipt.action!==r.action||receipt.auditId!==auditId||!integer(receipt.generation)||receipt.generation<1||receipt.generation>generation.value)return fail('IDEMPOTENCY_CONFLICT');
      const audit=copy(await tx.getAudit(auditId),['id','operation','actorUid','providerId','requestId','fromGeneration','toGeneration','action']);check();
      if(!audit||audit.id!==auditId||audit.operation!==OP||audit.actorUid!==actorUid||audit.providerId!==providerId||audit.requestId!==r.requestId||audit.fromGeneration!==receipt.generation-1||audit.toGeneration!==receipt.generation||audit.action!==r.action)return fail('CONFLICT');
      return {ok:true,status:'replayed',providerId,action:r.action,generation:receipt.generation};
     }
     if(canonical.revision!==r.expectedRevision||generation.value!==r.expectedGeneration||generation.value===Number.MAX_SAFE_INTEGER)return fail('REVISION_CONFLICT');
     const draft=copy(await tx.getDraft(providerId),['providerId','ownerUid','revision','profile']);check();
     if(!draft||draft.providerId!==providerId||draft.ownerUid!==actorUid||draft.revision!==canonical.revision)return fail('DENIED');
     const previous=await tx.getPublication(providerId);check();
     const prior=previous===null?null:copy(previous,['providerId','ownerUid','published','services','publicationEpoch']);
     if(previous!==null&&(!prior||prior.providerId!==providerId||prior.ownerUid!==actorUid||typeof prior.published!=='boolean'||!integer(prior.publicationEpoch)||prior.publicationEpoch>generation.value||!normalizeServiceSelections(prior.services).ok))return fail('DENIED');
     if(canonical.status==='published'&&prior?.published!==true||canonical.status==='draft'&&prior?.published===true)return fail('CONFLICT');
     let profile=null,services;
     if(r.action==='publish'){
      if(mandatoryPhotos&&(typeof tx.checkPublicationPhotos!=='function'||await tx.checkPublicationPhotos({kind:'provider',parentId:providerId,ownerUid:actorUid,parentRevision:canonical.revision})!==true))return fail('PHOTOS_REQUIRED');
      const source=copy(draft.profile,['id','displayName','city','serviceArea','services','available','experienceYears','description','languages']);
      const projected=buildPublicProviderProfile(source);
      if(!source||source.id!==providerId||!projected.ok||!approvedCatalog.localities.some(l=>l.city===projected.profile.city&&l.serviceArea===projected.profile.serviceArea)||projected.profile.services.some(category=>!planPublicProviderQuery({category,locality:projected.profile.serviceArea,limit:1,cursor:null},approvedCatalog,{publicationEpoch:0})))return fail('INVALID_PUBLIC_PROFILE');
      profile=projected.profile;services=[...profile.services];
     }else{
      if(!prior||prior.published!==true)return fail('CONFLICT');
      services=[...prior.services];
     }
     const next=generation.value+1,publication={providerId,ownerUid:actorUid,published:r.action==='publish',services,publicationEpoch:next};
     const publicProfile=profile?{...profile,published:true,publicationEpoch:next}:null;
     if(publicProfile&&Reflect.ownKeys(publicProfile).sort().join(',')!==[...DISCOVERY_FIELDS].sort().join(','))return fail('INVALID_PUBLIC_PROFILE');
     const status=canonical.status==='suspended'?'suspended':r.action==='publish'?'published':'draft';check();
     await tx.stagePublication({canonical:{...canonical,status},publication,publicProfile,generation:{value:next},
      receipt:{operation:OP,actorUid,providerId,requestId:r.requestId,fingerprint,generation:next,action:r.action,auditId},
      audit:{id:auditId,operation:OP,actorUid,providerId,requestId:r.requestId,fromGeneration:generation.value,toGeneration:next,action:r.action}});check();
     return {ok:true,status:'applied',providerId,action:r.action,generation:next};
    };
    expected=await mutate();return expected;
   },{signal:context.signal,deadlineAt:context.deadlineAt});
   const safe=expected&&copy(result,Object.keys(expected));if(!safe||!Object.entries(expected).every(([key,value])=>safe[key]===value))throw new Error('Invalid publication acknowledgement');return safe;
  }});
 }});
}
