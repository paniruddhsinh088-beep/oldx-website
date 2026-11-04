import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {snapshotVerifiedMediaProof} from './media-proof-snapshot.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {isolatedFirestoreContext,safeId,copyRecord,isolatedTransactionCheck} from './isolated-firestore-context.mjs';
import {validateProcessedImage} from './image-upload-contract-policy.mjs';
const roles=['assets','quotas','operations','audits'];
export const MEDIA_JOURNAL_TEST_SCHEMA=Object.freeze({assets:'testOldxPhotoAssets',quotas:'testOldxMediaQuotas',operations:'testOldxMediaOperations',audits:'testOldxMediaAudits'});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),int=v=>Number.isSafeInteger(v)&&v>=0,fail=code=>({ok:false,code});
export const mediaQuotaKeys=(uid,kind,parentId,service)=>['global',hash(['actor',uid]),hash(['parent',uid,kind,parentId,service])];
const kinds=['product','store','provider'],surface=a=>a.kind==='provider'?'profile':a.kind;
const imageId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{20,80}$/.test(v);
// Actual SDK durable journal only. No image provider client, bytes, signing keys,
// decoder, network calls or production/browser mode. All effects are Emulator-only.
function journalCore({sdk,parentCollections,actorCollections,authenticate,verifyProof,authorizeOrphan,allocateId=randomUUID,now=Date.now,timeoutMs=5000,orphanRetentionMs=86400000}={}, {db,collections:c},nativeScope=false){
 const allowedKinds=nativeScope?['product','store']:kinds;
 for(const mapping of [parentCollections,actorCollections])if(!copyRecord(mapping,kinds)||Object.values(mapping).some(v=>typeof v!=='string'||(!nativeScope&&!/^test(?:Oldx|Provider)[A-Za-z0-9]{1,48}$/.test(v))))throw new Error('Unactivated media scope');
 const parents={...parentCollections},actors={...actorCollections};if(!int(orphanRetentionMs)||orphanRetentionMs<60000)throw new Error('Invalid orphan policy');
 const ref=(role,key)=>sdk.doc(db,c[role],key);
 async function read(raw,r){const snapshot=await raw.get(r);if(!snapshot.exists())return null;const {committedAt,...data}=snapshot.data();return data;}
 async function scope(raw,a,uid){
  const actor=await read(raw,sdk.doc(db,actors[a.kind],uid)),parent=await read(raw,sdk.doc(db,parents[a.kind],a.kind==='provider'?a.parentId:a.kind+'_'+a.parentId));
  const owner=parent?.ownerUid===uid&&(a.kind==='provider'?parent.providerId===a.parentId:parent.id===a.parentId&&parent.kind===a.kind)&&int(parent.revision)&&actor?.uid===uid&&actor.canWrite===true&&actor.suspended===false&&(a.service===null||parent.profile?.services?.includes(a.service));return {actor,parent,owner:!!owner};
 }
 async function cleanupAllowed(asset,uid,parent,context){return typeof authorizeOrphan==='function'&&int(asset.createdAtMs)&&now()-asset.createdAtMs>=orphanRetentionMs&&await authorizeOrphan({actorUid:uid,asset:structuredClone(asset),parentExists:parent!==null},context)===true;}
 async function quotas(raw,a){const rows=[];for(const key of mediaQuotaKeys(a.ownerUid,a.kind,a.parentId,a.service)){const row=await read(raw,ref('quotas',key));if(!row||!copyRecord(row,['known','bytesReserved','imagesReserved','maxBytes','maxImages','reservationsUsed','maxReservations'])||row.known!==true||!['bytesReserved','imagesReserved','maxBytes','maxImages','reservationsUsed','maxReservations'].every(k=>int(row[k]))||row.bytesReserved>row.maxBytes||row.imagesReserved>row.maxImages||row.reservationsUsed>row.maxReservations)return null;rows.push({key,row});}return rows;}
 function writeQuotas(raw,rows,bytes,images){for(const {key,row} of rows){const next={...row,bytesReserved:row.bytesReserved+bytes,imagesReserved:row.imagesReserved+images,reservationsUsed:row.reservationsUsed+(bytes>0&&images>0?1:0)};if(!int(next.bytesReserved)||!int(next.imagesReserved)||next.bytesReserved>next.maxBytes||next.imagesReserved>next.maxImages||next.reservationsUsed>next.maxReservations)throw new Error('Quota conflict');raw.set(ref('quotas',key),next);}}
 function result(a){return {ok:true,imageId:a.imageId,state:a.state,revision:a.revision,parentRevision:a.parentRevision};}
 async function operation(op,input,{credential,signal}={}){
  return runVerifiedOperation({authenticate,credential,signal,timeoutMs,now,run:async context=>{
   const uid=context.actorUid,key=hash([uid,op,input.requestId]),fingerprint=hash(input);context.markMutationAttempted();
   return sdk.runTransaction(db,async raw=>{
    const check=()=>isolatedTransactionCheck(context.signal,context.deadlineAt,now);check();const receipt=await read(raw,ref('operations',key)),audit=await read(raw,ref('audits',key));
    if(receipt){
     const stored=copyRecord(receipt,['actorUid','operation','fingerprint','imageId','outcome']),saved=copyRecord(stored?.outcome,['ok','imageId','state','revision','parentRevision']);
     if(!stored||!saved||!imageId(stored.imageId)||saved.ok!==true||saved.imageId!==stored.imageId||!['reserved','uploading','quarantined','cancelled','deleting','deleted'].includes(saved.state)||!int(saved.revision)||!int(saved.parentRevision))return fail('IDEMPOTENCY_CONFLICT');
     const asset=await read(raw,ref('assets',stored.imageId));if(asset){const current=await scope(raw,asset,uid);if(!current.owner&&!await cleanupAllowed(asset,uid,current.parent,context))return fail('DENIED');}
     if(!asset||asset.ownerUid!==uid||stored.actorUid!==uid||stored.operation!==op||stored.fingerprint!==fingerprint||saved.parentRevision!==asset.parentRevision||audit?.requestKey!==key||audit.actorUid!==uid||audit.operation!==op||audit.imageId!==asset.imageId||audit.toRevision!==saved.revision||audit.fromRevision!==(op==='reserve'?null:input.expectedRevision)||asset.revision<saved.revision)return fail('IDEMPOTENCY_CONFLICT');return {...saved,replayed:true};
    }
    if(audit)return fail('CONFLICT');let asset,refund=false,quotaRows;
    if(op==='reserve'){
     const eligibility=await scope(raw,input,uid);if(!eligibility.owner||eligibility.parent.revision!==input.expectedParentRevision)return fail('DENIED');
     const allocated=allocateId();if(!imageId(allocated))return fail('UNAVAILABLE');if(await read(raw,ref('assets',allocated))!==null)return fail('CONFLICT');
     asset={imageId:allocated,ownerUid:uid,kind:input.kind,parentId:input.parentId,service:input.service,parentRevision:input.expectedParentRevision,sourceDigest:input.sourceDigest,reservedBytes:input.reservedBytes,publicId:'oldx/quarantine/'+allocated,state:'reserved',references:[],revision:0,createdAtMs:now(),attemptNonce:null,deleteNonce:null,assetId:null,processed:null,processedDigest:null,operationCount:1};quotaRows=await quotas(raw,asset);
     if(!quotaRows||quotaRows.some(({row})=>row.bytesReserved+asset.reservedBytes>row.maxBytes||row.imagesReserved+1>row.maxImages||row.reservationsUsed>=row.maxReservations))return fail('QUOTA_UNAVAILABLE');
     const parentQuota=quotaRows.at(-1).row,maxAttached=input.kind==='store'||input.kind==='provider'&&input.service===null?1:6;if(parentQuota.imagesReserved>=maxAttached+1)return fail('QUOTA_UNAVAILABLE');
    }else{
     asset=await read(raw,ref('assets',input.imageId));if(!asset||asset.imageId!==input.imageId||asset.ownerUid!==uid||!allowedKinds.includes(asset.kind)||!imageId(asset.imageId)||!safeId(asset.parentId)||!int(asset.parentRevision)||!int(asset.revision)||asset.revision!==input.expectedRevision||asset.revision===Number.MAX_SAFE_INTEGER||!int(asset.operationCount)||asset.operationCount>=12||!Array.isArray(asset.references)||asset.references.length>12||!int(asset.reservedBytes)||asset.reservedBytes<1||asset.publicId!=='oldx/quarantine/'+asset.imageId)return fail('CONFLICT');
     const eligibility=await scope(raw,asset,uid);check();const owner=eligibility.owner;
     if(['orphan-delete','orphan-cancel'].includes(op)){if(!await cleanupAllowed(asset,uid,eligibility.parent,context))return fail('DENIED');}
     else if(!owner){if(!(op.startsWith('reconcile-')||op==='confirm-delete')||!await cleanupAllowed(asset,uid,eligibility.parent,context))return fail('DENIED');}
     if(op==='attempt'){
      if(asset.state!=='reserved'||eligibility.parent.revision!==asset.parentRevision)return fail('REVISION_CONFLICT');const nonce=allocateId();if(!imageId(nonce))return fail('UNAVAILABLE');asset={...asset,state:'uploading',attemptNonce:nonce};
     }else if(op==='cancel'||op==='orphan-cancel'){
      if(asset.state!=='reserved')return fail('CONFLICT');asset={...asset,state:'cancelled'};refund=true;
     }else if(['confirm-upload','reconcile-upload'].includes(op)){
      if(asset.state!=='uploading'||typeof verifyProof!=='function')return fail('DENIED');
      const expected=Object.freeze({purpose:'upload',imageId:asset.imageId,nonce:asset.attemptNonce,publicId:asset.publicId,sourceDigest:asset.sourceDigest,expectedRevision:asset.revision});const proof=snapshotVerifiedMediaProof(await verifyProof(input.proof,expected,context),expected);check();if(!proof)return {ok:false,code:'OUTCOME_UNKNOWN',retrySameRequest:true};
      if(proof?.status==='present'&&proof.nonce===asset.attemptNonce&&proof.publicId===asset.publicId&&proof.sourceDigest===asset.sourceDigest&&safeId(proof.assetId)&&proof.deliveryType==='authenticated'&&proof.metadataStripped===true&&proof.contentScanned===true&&proof.byteSize<=asset.reservedBytes&&validateProcessedImage({surface:surface(asset),contentType:proof.contentType,byteSize:proof.byteSize,width:proof.width,height:proof.height,fileCount:1}).ok){asset={...asset,state:'quarantined',assetId:proof.assetId,processedDigest:typeof proof.processedDigest==='string'&&/^[a-f0-9]{64}$/.test(proof.processedDigest)?proof.processedDigest:null,processed:{contentType:proof.contentType,byteSize:proof.byteSize,width:proof.width,height:proof.height,metadataStripped:true,contentScanned:true},orphaned:!eligibility.owner||eligibility.parent?.revision!==asset.parentRevision};}
      else if(proof?.status==='absent'&&proof.nonce===asset.attemptNonce&&proof.publicId===asset.publicId&&proof.definitive===true&&proof.operationSettled===true){asset={...asset,state:'cancelled'};refund=true;}
      else return {ok:false,code:'OUTCOME_UNKNOWN',retrySameRequest:true};
     }else if(['lease-delete','orphan-delete'].includes(op)){
      if(!['quarantined','attached'].includes(asset.state)||asset.references.length!==0)return fail('DENIED');const nonce=allocateId();if(!imageId(nonce))return fail('UNAVAILABLE');asset={...asset,state:'deleting',deleteNonce:nonce};
     }else if(['confirm-delete','reconcile-delete'].includes(op)){
      if(asset.state!=='deleting'||asset.references.length!==0||typeof verifyProof!=='function')return fail('DENIED');const expected=Object.freeze({purpose:'delete',imageId:asset.imageId,nonce:asset.deleteNonce,publicId:asset.publicId,assetId:asset.assetId,expectedRevision:asset.revision});const proof=snapshotVerifiedMediaProof(await verifyProof(input.proof,expected,context),expected);check();if(!proof)return {ok:false,code:'OUTCOME_UNKNOWN',retrySameRequest:true};
      if(proof?.status!=='absent'||proof.nonce!==asset.deleteNonce||proof.publicId!==asset.publicId||proof.assetId!==asset.assetId||proof.definitive!==true||proof.operationSettled!==true)return {ok:false,code:'OUTCOME_UNKNOWN',retrySameRequest:true};asset={...asset,state:'deleted'};refund=true;
     }else return fail('INVALID_REQUEST');
     asset={...asset,revision:asset.revision+1,operationCount:asset.operationCount+1};if(refund){quotaRows=await quotas(raw,asset);if(!quotaRows||quotaRows.some(({row})=>row.bytesReserved<asset.reservedBytes||row.imagesReserved<1))return fail('CONFLICT');}
    }
    check();if(op==='reserve')writeQuotas(raw,quotaRows,asset.reservedBytes,1);else if(refund)writeQuotas(raw,quotaRows,-asset.reservedBytes,-1);
    const outcome=result(asset);raw.set(ref('assets',asset.imageId),{...asset,committedAt:sdk.serverTimestamp()});raw.set(ref('operations',key),{actorUid:uid,operation:op,fingerprint,imageId:asset.imageId,outcome});raw.set(ref('audits',key),{requestKey:key,actorUid:uid,imageId:asset.imageId,operation:op,fromRevision:op==='reserve'?null:input.expectedRevision,toRevision:asset.revision});check();return outcome;
   },{maxAttempts:3});
  }});
 }
 return Object.freeze({
  reserve(request,options){const r=copyRecord(request,['requestId','kind','parentId','service','expectedParentRevision','sourceDigest','reservedBytes']);if(!r||!safeId(r.requestId)||!allowedKinds.includes(r.kind)||!safeId(r.parentId)||r.service!==null&&(r.kind!=='provider'||typeof r.service!=='string'||r.service.length<1||r.service.length>80)||!int(r.expectedParentRevision)||typeof r.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(r.sourceDigest)||!int(r.reservedBytes)||r.reservedBytes<1||r.reservedBytes>(r.kind==='provider'?2:3)*1024*1024)return Promise.resolve(fail('INVALID_REQUEST'));return operation('reserve',structuredClone(r),options);},
  transition(op,request,options){const r=copyRecord(request,['requestId','imageId','expectedRevision','proof']);if(!['attempt','cancel','confirm-upload','reconcile-upload','lease-delete','confirm-delete','reconcile-delete','orphan-delete','orphan-cancel'].includes(op)||!r||!safeId(r.requestId)||!imageId(r.imageId)||!int(r.expectedRevision)||r.proof!==null&&(typeof r.proof!=='string'||!/^[A-Za-z0-9_.-]{1,2048}$/.test(r.proof)))return Promise.resolve(fail('INVALID_REQUEST'));return operation(op,structuredClone(r),options);}
 });
}

export function createIsolatedMediaJournal(options={}){
 if(options.enabled!==true)return Object.freeze({reserve:async()=>fail('UNAVAILABLE'),transition:async()=>fail('UNAVAILABLE')});
 return journalCore(options,isolatedFirestoreContext({...options,roles}));
}
export function createStagingMediaJournal(options={}){
 if(options.enabled!==true)return Object.freeze({reserve:async()=>fail('UNAVAILABLE'),transition:async()=>fail('UNAVAILABLE')});const b=requireStagingMarketplaceBinding(options.binding);
 return journalCore({...options,sdk:b.sdk,parentCollections:{product:b.collections.privateRecords,store:b.collections.privateRecords,provider:'unsupportedProvider'},actorCollections:{product:b.collections.actors,store:b.collections.actors,provider:'unsupportedProvider'}},{db:b.db,collections:b.journalCollections},true);
}
