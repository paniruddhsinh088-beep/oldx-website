import {createHash} from 'node:crypto';
import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createStagingMediaJournal} from './firebase-media-journal.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {snapshotVerifiedMediaProof} from './media-proof-snapshot.mjs';
import {validateProcessedImage} from './image-upload-contract-policy.mjs';
import {runVerifiedOperation} from './verified-operation.mjs';
const hash=v=>createHash('sha256').update(typeof v==='string'||ArrayBuffer.isView(v)?v:JSON.stringify(v,(_k,value)=>value&&[Object.prototype,null].includes(Object.getPrototypeOf(value))?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value)).digest('hex');
const imageId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{20,80}$/.test(v);
const unknown=()=>({ok:false,code:'OUTCOME_UNKNOWN',retrySameRequest:true});
const fail=code=>({ok:false,code});
// Server-only, default disabled. No provider/default transport/SDK startup.
// Domain-separated rows reuse existing journal operations + audits; no new
// collections, Rules or schema activation. Bytes and credentials are NEVER stored.
export function createStagingMediaProviderRuntime({enabled=false,binding,authenticate,processor,createUploadProvider,inspectAsset,destroy,inspectDeletionSettlement,now=Date.now,timeoutMs=5000}={}){
 if(enabled!==true)return Object.freeze(Object.fromEntries(['upload','reconcileUpload','remove','reconcileDelete'].map(k=>[k,async()=>fail('UNAVAILABLE')])));
 const b=requireStagingMarketplaceBinding(binding),{sdk,db}=b,c=b.journalCollections;
 const ref=(role,key)=>sdk.doc(db,c[role],key),read=async(tx,r)=>{const s=await tx.get(r);return s.exists()?s.data():null;};
 const key=(uid,e)=>'providerproof_'+hash([uid,e.purpose,e.imageId,e.nonce,e.expectedRevision]);
 const transaction=(context,work)=>sdk.runTransaction(db,async tx=>{context.checkpoint();const result=await work(tx);context.checkpoint();return result;},{maxAttempts:3});
 async function lease(tx,input,context,purpose){
  const asset=await read(tx,ref('assets',input.imageId));
  if(!asset||asset.ownerUid!==context.actorUid||!['product','store'].includes(asset.kind)||asset.publicId!=='oldx/quarantine/'+input.imageId||!safeId(asset.parentId))throw Error('Denied lease');
  const actor=await read(tx,sdk.doc(db,b.collections.actors,context.actorUid)),parent=await read(tx,sdk.doc(db,b.collections.privateRecords,asset.kind+'_'+asset.parentId));
  if(actor?.uid!==context.actorUid||actor.canWrite!==true||actor.suspended!==false||parent?.ownerUid!==context.actorUid||parent.id!==asset.parentId||parent.kind!==asset.kind)throw Error('Denied owner');
  const nonce=purpose==='upload'?asset.attemptNonce:asset.deleteNonce;
  if(!imageId(nonce)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1||asset.revision<input.expectedRevision)throw Error('Invalid lease');
  const expected={purpose,imageId:input.imageId,nonce,publicId:asset.publicId,expectedRevision:input.expectedRevision,...(purpose==='upload'?{sourceDigest:asset.sourceDigest}:{assetId:asset.assetId})};
  return {asset,parent,expected,token:key(context.actorUid,expected)};
 }
 async function verifyProof(token,expected,context){
  if(token!==key(context.actorUid,expected))return null;
  const verify=async tx=>{
   const row=await read(tx,ref('operations',token)),audit=await read(tx,ref('audits',token));
   if(row?.ownerUid!==context.actorUid||row.phase!=='complete'||audit?.ownerUid!==context.actorUid||audit.proofDigest!==hash(row.proof))return null;
   return snapshotVerifiedMediaProof(row.proof,expected);
  };
  return context.transaction?verify(context.transaction):transaction(context,verify);
 }
 const journal=createStagingMediaJournal({enabled:true,binding:b,authenticate,verifyProof,now,timeoutMs});
 async function stored(input,context,purpose){return transaction(context,async tx=>{const scope=await lease(tx,input,context,purpose),row=await read(tx,ref('operations',scope.token));return {...scope,row};});}
 async function claim(input,context,purpose,processed){
  context.markMutationAttempted();return transaction(context,async tx=>{
   const scope=await lease(tx,input,context,purpose),row=await read(tx,ref('operations',scope.token));
   if(row)return {...scope,row,claimed:false};
   const {asset,parent}=scope;
   if(asset.revision!==input.expectedRevision||asset.state!==(purpose==='upload'?'uploading':'deleting')||purpose==='upload'&&parent.revision!==asset.parentRevision||purpose==='delete'&&(!Array.isArray(asset.references)||asset.references.length!==0))throw Error('Stale lease');
   const next={ownerUid:context.actorUid,phase:'attempting',expected:scope.expected,processed:processed??null};
   tx.set(ref('operations',scope.token),next);tx.set(ref('audits','attempt_'+scope.token),{ownerUid:context.actorUid,purpose,imageId:input.imageId,nonce:scope.expected.nonce});return {...scope,row:next,claimed:true};
  });
 }
 async function persist(input,context,purpose,proof){
  return transaction(context,async tx=>{
   const scope=await lease(tx,input,context,purpose),row=await read(tx,ref('operations',scope.token));
   const validated=snapshotVerifiedMediaProof(proof,scope.expected);
   if(!row||row.ownerUid!==context.actorUid||!validated||hash(row.expected)!==hash(scope.expected))return false;
   if(row.phase==='complete')return hash(row.proof)===hash(validated);
   if(row.phase!=='attempting'||scope.asset.revision!==input.expectedRevision||scope.asset.state!==(purpose==='upload'?'uploading':'deleting'))return false;
   if(purpose==='upload'){
    const p=row.processed;
    if(!p||proof.processedDigest!==p.digest||proof.byteSize!==p.byteSize||proof.width!==p.width||proof.height!==p.height||proof.contentType!==p.contentType||proof.metadataStripped!==true||proof.contentScanned!==true||proof.deliveryType!=='authenticated'||!safeId(proof.assetId))return false;
   }else if(scope.asset.references.length!==0||proof.status!=='absent'||proof.definitive!==true||proof.operationSettled!==true)return false;
   tx.set(ref('operations',scope.token),{...row,phase:'complete',proof:{...validated}});tx.set(ref('audits',scope.token),{ownerUid:context.actorUid,proofDigest:hash(validated),committedAt:sdk.serverTimestamp()});return true;
  });
 }
 async function acceptUpload(input,context,inspection){
  const scope=await stored(input,context,'upload'),v=copyRecord(inspection,['assetId','publicId','version','resourceType','deliveryType','format','byteSize','width','height','digest']),p=scope.row?.processed;
  if(!v||!p||v.publicId!==scope.expected.publicId||!Number.isSafeInteger(v.version)||v.version<1||v.resourceType!=='image'||v.deliveryType!=='authenticated'||v.format!=='webp'||v.digest!==p.digest)return false;
  return persist(input,context,'upload',{...scope.expected,status:'present',assetId:v.assetId,deliveryType:'authenticated',metadataStripped:true,contentScanned:true,byteSize:v.byteSize,width:v.width,height:v.height,contentType:'image/webp',processedDigest:v.digest});
 }
 const valid=request=>{const r=copyRecord(request,['requestId','imageId','expectedRevision']);return r&&safeId(r.requestId)&&imageId(r.imageId)&&Number.isSafeInteger(r.expectedRevision)&&r.expectedRevision>0?r:null;};
 const run=(request,options,purpose,work)=>{
  const input=valid(request);if(!input)return Promise.resolve(fail('INVALID_REQUEST'));
  return runVerifiedOperation({authenticate,credential:options?.credential,signal:options?.signal,now,timeoutMs,run:async context=>{
   const scope=await stored(input,context,purpose);
   if(scope.row?.phase==='complete')return journal.transition(purpose==='upload'?'confirm-upload':'confirm-delete',{...input,proof:scope.token},options);
   return work(input,context,scope);
  }});
 };
 const finish=(input,scope,options,purpose)=>journal.transition(purpose==='upload'?'confirm-upload':'confirm-delete',{...input,proof:scope.token},options);
 return Object.freeze({journal,
  upload(request,source,options={}){return run(request,options,'upload',async(input,context,scope)=>{
   if(scope.row)return unknown();if(!(source instanceof Uint8Array)||source.length<1||source.length>3*1024*1024||hash(Buffer.from(source))!==scope.asset.sourceDigest)return fail('INVALID_REQUEST');
   if(typeof processor?.decodeAndReencode!=='function'||typeof createUploadProvider!=='function')return fail('UNAVAILABLE');
   const p=copyRecord(await processor.decodeAndReencode(new Uint8Array(source),{surface:scope.asset.kind,maxBytes:scope.asset.reservedBytes,signal:context.signal}),['bytes','contentType','width','height','metadataStripped','contentScanned']);context.checkpoint();
   if(!p||!(p.bytes instanceof Uint8Array)||p.bytes.length>scope.asset.reservedBytes||p.contentType!=='image/webp'||p.metadataStripped!==true||p.contentScanned!==true||!validateProcessedImage({surface:scope.asset.kind,...p,byteSize:p.bytes.length}).ok)return fail('IMAGE_REJECTED');
   const bytes=new Uint8Array(p.bytes),processed={digest:hash(Buffer.from(bytes)),contentType:p.contentType,byteSize:bytes.length,width:p.width,height:p.height};
   const claimed=await claim(input,context,'upload',processed);if(!claimed.claimed)return unknown();context.checkpoint();
   const provider=createUploadProvider({persistVerifiedUpload:proof=>acceptUpload(input,context,proof)});
   if(typeof provider?.uploadProcessed!=='function')return unknown();
   await provider.uploadProcessed({bytes,publicId:claimed.expected.publicId,resourceType:'image',deliveryType:'authenticated',overwrite:false},context);context.checkpoint();
   const after=await stored(input,context,'upload');if(after.row?.phase!=='complete')return unknown();return finish(input,after,options,'upload');
  });},
  reconcileUpload(request,identity,options={}){return run(request,options,'upload',async(input,context,scope)=>{
   const id=copyRecord(identity,['assetId','version']);if(!scope.row||typeof inspectAsset!=='function'||!id||!safeId(id.assetId)||!Number.isSafeInteger(id.version)||id.version<1)return unknown();
   const proof=await inspectAsset({...id,publicId:scope.expected.publicId},context);context.checkpoint();if(proof?.assetId!==id.assetId||proof?.version!==id.version)return unknown();
   if(!await acceptUpload(input,context,proof))return unknown();return finish(input,scope,options,'upload');
  });},
  remove(request,options={}){return run(request,options,'delete',async(input,context)=>{
   if(typeof destroy!=='function')return fail('UNAVAILABLE');const scope=await claim(input,context,'delete');if(!scope.claimed)return unknown();context.checkpoint();
   const result=await destroy({assetId:scope.expected.assetId,publicId:scope.expected.publicId,resourceType:'image',deliveryType:'authenticated',invalidate:true},context);context.checkpoint();
   if(!['ok','not found'].includes(result?.result))return unknown();
   if(!await persist(input,context,'delete',{...scope.expected,status:'absent',definitive:true,operationSettled:true}))return unknown();return finish(input,scope,options,'delete');
  });},
  reconcileDelete(request,options={}){return run(request,options,'delete',async(input,context,scope)=>{
   if(!scope.row||typeof inspectDeletionSettlement!=='function')return unknown();const proof=await inspectDeletionSettlement({...scope.expected},context);context.checkpoint();
   if(!await persist(input,context,'delete',proof))return unknown();return finish(input,scope,options,'delete');
  });}
 });
}
