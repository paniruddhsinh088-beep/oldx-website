import {mediaProviderRecordDigest} from './staging-media-provider-runtime.mjs';
import {createApprovedMediaByteDelivery} from './approved-media-byte-delivery.mjs';
import {createHash} from 'node:crypto';
import {runVerifiedOperation} from './verified-operation.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {createStagingMandatoryPhotoPolicy} from './mandatory-photo-policy.mjs';
import {createStagingAtomicPhotoPublication} from './firebase-atomic-photo-publication.mjs';
import {createStagingPhotoReferenceRepository,createStagingDraftPhotoReferences,createStagingOwnerPhotoRead} from './firebase-photo-reference-repository.mjs';
import {createStagingMediaJournal} from './firebase-media-journal.mjs';
import {createStagingPublicMediaRead} from './firebase-media-delivery-read.mjs';
import {createMediaDeliveryContract} from './media-delivery-contract.mjs';
// Same transaction/policy code as isolated adapters. No provider call, fake scan,
// public activation or automatic SDK initialization. Product/Store only.
export function createStagingMarketplaceMedia({enabled=false,binding,authenticate,verifyProof,authorizeOrphan,readApprovedDerivative,consumePublicRateLimit,now=Date.now}={}){
 if(enabled!==true)return null;const b=requireStagingMarketplaceBinding(binding),options={enabled:true,binding:b,authenticate,verifyProof,authorizeOrphan,now};
 const readPublicSnapshot=createStagingPublicMediaRead(options),delivery=createMediaDeliveryContract({enabled:true,readPublicSnapshot,now});
 const publicManifest=async(input,{signal}={})=>{
  const r=copyRecord(input,['kind','parentId','expectedParentRevision']);if(!r||!['product','store'].includes(r.kind)||!safeId(r.parentId)||!Number.isSafeInteger(r.expectedParentRevision)||r.expectedParentRevision<1||typeof consumePublicRateLimit!=='function')return {ok:false,code:'MEDIA_UNAVAILABLE'};
  return runVerifiedOperation({authenticate:()=>({uid:'public-image'}),signal,now,run:async context=>{
   const rate=copyRecord(await consumePublicRateLimit({operation:'media.public.manifest'},{signal:context.signal,deadlineAt:context.deadlineAt}),['allowed']);context.checkpoint();if(rate?.allowed!==true)return {ok:false,code:'MEDIA_UNAVAILABLE'};
   const key=createHash('sha256').update(JSON.stringify([r.kind,r.parentId,null])).digest('hex');
   const revision=await b.sdk.runTransaction(b.db,async tx=>{const p=await tx.get(b.sdk.doc(b.db,b.mediaCollections.publications,key));return p.exists()&&p.data().published===true?p.data().photoRevision:null;},{maxAttempts:3});context.checkpoint();
   if(!Number.isSafeInteger(revision)||revision<1)return {ok:false,code:'MEDIA_UNAVAILABLE'};
   return delivery.publicPhotos({...r,expectedPhotoRevision:revision},{signal:context.signal});
  }});
 };

 const resolveApprovedDerivative=async(input,context)=>{
  const r=copyRecord(input,['derivativeId','version']),imageId=typeof r?.derivativeId==='string'?/^image_([A-Za-z0-9_-]{20,80})$/.exec(r.derivativeId)?.[1]:null;
  if(!imageId||!Number.isSafeInteger(r.version)||r.version<1||context?.signal?.aborted)return null;
  const facts=await b.sdk.runTransaction(b.db,async tx=>{
   const get=async(collection,key)=>{const s=await tx.get(b.sdk.doc(b.db,collection,key));return s.exists()?s.data():null;};
   const a=await get(b.mediaCollections.assets,imageId),release=a?.publicRelease;
   if(!a||release?.approved!==true||release.imageId!==imageId||release.derivativeId!==r.derivativeId||release.version!==r.version||!/^providerproof_[a-f0-9]{64}$/.test(a.providerProof??''))return null;
   const receipt=await get(b.journalCollections.operations,a.providerProof),audit=await get(b.journalCollections.audits,a.providerProof),provider=receipt?.provider;
   if(receipt?.phase!=='complete'||receipt.ownerUid!==a.ownerUid||receipt.expected?.imageId!==imageId||receipt.expected.nonce!==a.attemptNonce||receipt.expected.sourceDigest!==a.sourceDigest||receipt.proof?.assetId!==a.assetId||receipt.proof.processedDigest!==a.processedDigest||provider?.assetId!==a.assetId||provider.publicId!==a.publicId||provider.digest!==a.processedDigest||!Number.isSafeInteger(provider.version)||provider.version<1||audit?.proofDigest!==mediaProviderRecordDigest(receipt.proof)||audit.providerDigest!==mediaProviderRecordDigest(provider))return null;
   return {release,provider};
  },{maxAttempts:3});
  if(!facts||context?.signal?.aborted)return null;const p=facts.release,approved=await delivery.publicPhotos({kind:p.kind,parentId:p.parentId,expectedParentRevision:p.parentRevision,expectedPhotoRevision:p.photoRevision},{signal:context?.signal});
  return approved?.ok===true&&approved.photos.some(photo=>photo.imageId===imageId&&photo.derivativeId===r.derivativeId&&photo.version===r.version)?{...facts.provider,releaseVersion:r.version}:null;
 };
 return Object.freeze({resolveApprovedDerivative,ownerPhotos:createStagingOwnerPhotoRead(options),publicManifest,publicBytes:createApprovedMediaByteDelivery({enabled:true,contract:delivery,readApprovedDerivative,consumeRateLimit:consumePublicRateLimit}),photoPolicy:createStagingMandatoryPhotoPolicy(options),atomicPhotos:createStagingAtomicPhotoPublication(options),draftPhotos:createStagingDraftPhotoReferences(options),references:createStagingPhotoReferenceRepository(options),journal:createStagingMediaJournal(options),readPublicSnapshot,delivery});
}
