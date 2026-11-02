import {randomUUID} from 'node:crypto';
import {getSurfacePolicy} from './image-upload-contract-policy.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const clone=v=>v===null?null:structuredClone(v);
// Reference repository only: synchronous critical sections are atomic in ONE
// process. No persistence, distributed locking, provider client or runtime binding.
export function createInMemoryMediaJournal({enabled=false,mode,limits,now=Date.now,allocateId=randomUUID,authorizeReference,authorizeDelete,inspectUpload,inspectDelete}={}){
 const active=enabled===true&&mode==='isolated-test'&&limits&&['globalBytes','actorBytes','parentBytes','maxImages','maxEntries'].every(k=>integer(limits[k])&&limits[k]>0)&&limits.maxEntries<=10000&&limits.maxImages<=limits.maxEntries;
 limits=limits?Object.freeze({...limits}):null;
 const uploads=new Map(),images=new Map(),deletes=new Map(),references=new Map(),ids=new Set();
 const key=(...parts)=>JSON.stringify(parts),scope=r=>key(r.actorUid,r.surface,r.parentId);
 function check(actorUid,context){if(!active||!id(actorUid)||context?.actorUid!==actorUid)throw new Error('Media journal unavailable');context.checkpoint();}
 function allocate(){const value=allocateId();if(typeof value!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(value)||ids.has(value))throw new Error('Media allocation unavailable');ids.add(value);return value;}
 const capacity=()=>uploads.size+deletes.size+references.size<limits.maxEntries;
 const owned=(leaseId,actorUid)=>{const value=images.get(leaseId);return value?.actorUid===actorUid?value:null;};
 const held=r=>!['rejected','deleted'].includes(r.state);
 function release(r,state){r.state=state;r.quotaReserved=false;r.revision++;}
 function referenceProof(input,context){return authorizeReference?.(clone(input),context);}
 function publicLease(r){const {refs,...value}=r;return {...value,references:refs.size,published:[...refs.values()].some(v=>v==='public')};}
 function newDelete(input,context){
  check(input.actorUid,context);if(!id(input.requestId)||!id(input.imageId))return null;
  const token=key(input.actorUid,input.requestId),previous=deletes.get(token);
  if(previous)return previous.imageId===input.imageId?clone(publicLease(previous)):null;
  const r=[...images.values()].find(v=>v.imageId===input.imageId&&v.actorUid===input.actorUid);
  if(!r||!['quarantined','attached','deleting','deleted'].includes(r.state)||r.refs.size||[...references.values()].some(v=>(v.imageId===r.imageId||v.oldImageId===r.imageId)&&v.state==='reserved'&&v.expiresAt>now())||!capacity())return null;
  if(r.state==='deleting')return null;
  if(r.state!=='deleted'){r.state='deleting';r.revision++;}const lease={...r,refs:r.refs,leaseId:allocate(),managed:true};deletes.set(token,lease);return clone(publicLease(lease));
 }
 return Object.freeze({
  reserveUpload(input,context){
   check(input.actorUid,context);if(!id(input.requestId)||!id(input.parentId)||!getSurfacePolicy(input.surface)||!Number.isSafeInteger(input.reservedBytes)||input.reservedBytes<1||input.reservedBytes>getSurfacePolicy(input.surface).maxBytes||typeof input.digest!=='string'||!/^[a-f0-9]{64}$/.test(input.digest))return null;
   const token=key(input.actorUid,input.requestId),prior=uploads.get(token);
   if(prior)return prior.surface===input.surface&&prior.parentId===input.parentId&&prior.digest===input.digest&&prior.reservedBytes===input.reservedBytes?clone(publicLease(prior)):null;
   const current=[...images.values()].filter(held),bytes=rows=>rows.reduce((n,r)=>n+r.reservedBytes,0),parent=current.filter(r=>scope(r)===scope(input));
   if(!capacity()||current.length>=limits.maxImages||bytes(current)+input.reservedBytes>limits.globalBytes||bytes(current.filter(r=>r.actorUid===input.actorUid))+input.reservedBytes>limits.actorBytes||bytes(parent)+input.reservedBytes>limits.parentBytes||parent.length>=getSurfacePolicy(input.surface).maxFiles+1)return null;
   const imageId=allocate(),leaseId=allocate(),record={...input,imageId,leaseId,publicId:'oldx/quarantine/'+imageId,state:'reserved',quotaReserved:true,budgetKnown:true,revision:0,refs:new Map()};uploads.set(token,record);images.set(leaseId,record);return clone(publicLease(record));
  },
  rejectLease(leaseId,actorUid,context){check(actorUid,context);const r=owned(leaseId,actorUid);if(!r||r.state!=='reserved')return false;release(r,'rejected');return true;},
  markUploadAttempt(leaseId,actorUid,context){check(actorUid,context);const r=owned(leaseId,actorUid);if(!r||r.state!=='reserved')return false;r.state='uploading';r.revision++;return true;},
  attachQuarantined(input,context){check(input.actorUid,context);const r=owned(input.leaseId,input.actorUid);if(!r||r.imageId!==input.imageId||r.publicId!==input.publicId||r.digest!==input.digest||!id(input.assetId)||!Number.isSafeInteger(input.byteSize)||input.byteSize<1||input.byteSize>r.reservedBytes)return false;if(r.state==='quarantined')return r.assetId===input.assetId&&r.byteSize===input.byteSize;if(r.state!=='uploading')return false;r.assetId=input.assetId;r.byteSize=input.byteSize;r.state='quarantined';r.revision++;return true;},
  async reconcileUpload({leaseId,actorUid},context){
   check(actorUid,context);const r=owned(leaseId,actorUid);if(!r)return null;if(r.state!=='uploading')return clone(publicLease(r));if(typeof inspectUpload!=='function')return clone(publicLease(r));const revision=r.revision;
   const proof=await inspectUpload({imageId:r.imageId,publicId:r.publicId,digest:r.digest},context);check(actorUid,context);if(r.revision!==revision||r.state!=='uploading')return clone(publicLease(r));
   if(proof?.status==='present'&&proof.publicId===r.publicId&&proof.digest===r.digest&&id(proof.assetId)&&Number.isSafeInteger(proof.byteSize)&&proof.byteSize>0&&proof.byteSize<=r.reservedBytes){r.assetId=proof.assetId;r.byteSize=proof.byteSize;r.state='quarantined';r.revision++;}
   else if(proof?.status==='absent'&&proof.definitive===true&&proof.operationSettled===true)release(r,'rejected');
   return clone(publicLease(r));
  },
  reserveDelete:newDelete,
  confirmDeleteLease(leaseId,actorUid,context){check(actorUid,context);const r=[...deletes.values()].find(v=>v.leaseId===leaseId&&v.actorUid===actorUid);return !!r&&authorizeDelete?.({actorUid,imageId:r.imageId,surface:r.surface,parentId:r.parentId},context)===true&&r.state==='deleting'&&[...images.values()].some(v=>v.imageId===r.imageId&&v.state==='deleting'&&v.refs.size===0);},
  completeDelete(leaseId,actorUid,context){check(actorUid,context);const d=[...deletes.values()].find(v=>v.leaseId===leaseId&&v.actorUid===actorUid);if(!d)return false;if(d.state==='deleted')return true;const r=[...images.values()].find(v=>v.imageId===d.imageId);if(d.state!=='deleting'||!r||r.state!=='deleting'||r.refs.size)return false;release(r,'deleted');d.state='deleted';d.quotaReserved=false;return true;},
  async reconcileDelete({leaseId,actorUid},context){check(actorUid,context);const d=[...deletes.values()].find(v=>v.leaseId===leaseId&&v.actorUid===actorUid);if(!d)return null;if(d.state==='deleting'&&typeof inspectDelete==='function'){const proof=await inspectDelete({assetId:d.assetId,publicId:d.publicId},context);check(actorUid,context);if(proof?.status==='absent'&&proof.definitive===true){const r=[...images.values()].find(v=>v.imageId===d.imageId);if(r?.state==='deleting'&&r.refs.size===0){release(r,'deleted');d.state='deleted';d.quotaReserved=false;}}}return clone(publicLease(d));},
  async reserveReference(input,context){
   check(input.actorUid,context);if(!id(input.requestId)||!id(input.referenceId)||!id(input.imageId)||!id(input.parentId)||!getSurfacePolicy(input.surface)||!integer(input.expectedRevision)||!['attach','detach','replace'].includes(input.action)||input.action==='replace'&&(!id(input.oldImageId)||input.oldImageId===input.imageId||!integer(input.expectedOldRevision))||!['private','public'].includes(input.visibility))return null;
   const token=key(input.actorUid,input.requestId),fingerprint=key(input.imageId,input.surface,input.parentId,input.referenceId,input.expectedRevision,input.action,input.visibility,input.oldImageId??null,input.expectedOldRevision??null),prior=references.get(token);
   if(prior)return prior.fingerprint===fingerprint?clone(prior):null;
   const proof=referenceProof(input,context);check(input.actorUid,context);
   if(proof?.allowed!==true||input.visibility==='public'&&(proof.publicationAuthorized!==true||proof.moderationApproved!==true))return null;
   // All mutable facts re-read after authorization; there is no await in commit.
   const r=[...images.values()].find(v=>v.actorUid===input.actorUid&&v.imageId===input.imageId&&v.surface===input.surface&&v.parentId===input.parentId);
   const old=input.action==='replace'?[...images.values()].find(v=>v.imageId===input.oldImageId&&scope(v)===scope(input)):null;
   if(references.has(token))return references.get(token).fingerprint===fingerprint?clone(references.get(token)):null;
   if(!r||!['quarantined','attached'].includes(r.state)||r.revision!==input.expectedRevision||!capacity()||input.action==='replace'&&(!old||old.state!=='attached'||old.revision!==input.expectedOldRevision||old.refs.get(input.referenceId)!==input.visibility||r.refs.has(input.referenceId)||r.refs.size>=10)||input.action==='attach'&&(r.refs.has(input.referenceId)||r.refs.size>=10)||input.action==='detach'&&r.refs.get(input.referenceId)!==input.visibility)return null;
   if(input.action==='attach'&&[...images.values()].some(v=>v.imageId!==r.imageId&&scope(v)===scope(input)&&v.refs.has(input.referenceId)))return null;
   if(input.action==='attach'&&!r.refs.size&&[...images.values()].filter(v=>scope(v)===scope(input)&&v.refs.size>0).length>=getSurfacePolicy(input.surface).maxFiles)return null;
   const lease={...input,fingerprint,leaseId:allocate(),state:'reserved',expiresAt:now()+30000};references.set(token,lease);return clone(lease);
  },
  async commitReference({leaseId,actorUid},context){
   check(actorUid,context);const lease=[...references.values()].find(v=>v.leaseId===leaseId&&v.actorUid===actorUid);if(!lease)return false;if(lease.state==='committed')return true;
   const proof=referenceProof(lease,context);check(actorUid,context);const r=[...images.values()].find(v=>v.imageId===lease.imageId&&v.actorUid===actorUid);
   if(lease.state==='committed')return true;
   if(proof?.allowed!==true||lease.visibility==='public'&&(proof.publicationAuthorized!==true||proof.moderationApproved!==true)||lease.state!=='reserved'||now()>=lease.expiresAt||!r||!['quarantined','attached'].includes(r.state)||r.revision!==lease.expectedRevision)return false;
   if(lease.action==='replace'){const old=[...images.values()].find(v=>v.imageId===lease.oldImageId&&scope(v)===scope(lease));if(!old||old.state!=='attached'||old.revision!==lease.expectedOldRevision||old.refs.get(lease.referenceId)!==lease.visibility||r.refs.has(lease.referenceId)||r.refs.size>=10)return false;old.refs.delete(lease.referenceId);old.state=old.refs.size?'attached':'quarantined';old.revision++;r.refs.set(lease.referenceId,lease.visibility);}
   else if(lease.action==='attach'){if([...images.values()].some(v=>v.imageId!==r.imageId&&scope(v)===scope(lease)&&v.refs.has(lease.referenceId)))return false;if(!r.refs.size&&[...images.values()].filter(v=>scope(v)===scope(lease)&&v.refs.size>0).length>=getSurfacePolicy(lease.surface).maxFiles)return false;r.refs.set(lease.referenceId,lease.visibility);}else r.refs.delete(lease.referenceId);r.state=r.refs.size?'attached':'quarantined';r.revision++;lease.state='committed';return true;
  },
  inspect({imageId,actorUid},context){check(actorUid,context);const r=[...images.values()].find(v=>v.imageId===imageId&&v.actorUid===actorUid);return r?clone(publicLease(r)):null;},
  quota(actorUid,context){check(actorUid,context);const rows=[...images.values()].filter(r=>r.actorUid===actorUid&&held(r));return {reservedBytes:rows.reduce((n,r)=>n+r.reservedBytes,0),images:rows.length};}
 });
}
