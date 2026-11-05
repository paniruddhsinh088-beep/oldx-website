import {createHash} from 'node:crypto';
import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {runVerifiedOperation} from './verified-operation.mjs';
import {validateProcessedImage} from './image-upload-contract-policy.mjs';
import {mediaProviderRecordDigest} from './staging-media-provider-runtime.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),fail=code=>({ok:false,code}),integer=v=>Number.isSafeInteger(v)&&v>=0;
// Human/trusted moderator decision transaction, not an automated detector.
// No client-provided role, credentials, provider calls or public URL output.
export function createStagingProviderMediaModeration({enabled=false,binding,authenticate,timeoutMs=5000}={}){
 if(enabled!==true)return Object.freeze({decide:async()=>fail('UNAVAILABLE')});const b=requireStagingMarketplaceBinding(binding),{sdk,db}=b,c=b.mediaCollections;
 return Object.freeze({async decide(request,{credential,signal}={}){const r=copyRecord(request,['requestId','imageId','expectedAssetRevision','expectedReviewRevision','decision']);if(!r||!safeId(r.requestId)||typeof r.imageId!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(r.imageId)||!integer(r.expectedAssetRevision)||!integer(r.expectedReviewRevision)||!['approved','rejected'].includes(r.decision))return fail('INVALID_REQUEST');
  return runVerifiedOperation({authenticate,credential,signal,timeoutMs,run:context=>sdk.runTransaction(db,async tx=>{const uid=context.actorUid,get=async(collection,key)=>{context.checkpoint();const s=await tx.get(sdk.doc(db,collection,key));if(!s.exists())return null;const {committedAt,...v}=s.data();return v;};
   const permission=await get(c.permissions,uid),asset=await get(c.assets,r.imageId),review=await get(c.reviews,r.imageId),key='provider_review_'+hash([uid,r.requestId]),receipt=await get(c.receipts,key),audit=await get(c.audits,key),fingerprint=hash(r);
   if(permission?.uid!==uid||permission.canModerate!==true||permission.suspended!==false||!asset||asset.imageId!==r.imageId||asset.kind!=='provider'||asset.ownerUid===uid||!safeId(asset.ownerUid)||!safeId(asset.parentId)||typeof asset.processedDigest!=='string'||!(/^[a-f0-9]{64}$/).test(asset.processedDigest)||!['quarantined','attached'].includes(asset.state))return fail('DENIED');
   if(receipt){if(receipt.moderatorUid!==uid||receipt.fingerprint!==fingerprint||receipt.imageId!==r.imageId||audit?.requestKey!==key||audit.moderatorUid!==uid||audit.reviewRevision!==receipt.reviewRevision||audit.imageId!==receipt.imageId||audit.fingerprint!==receipt.fingerprint||audit.decision!==receipt.decision||!review||review.revision<receipt.reviewRevision)return fail('IDEMPOTENCY_CONFLICT');return {ok:true,status:'replayed',reviewRevision:receipt.reviewRevision};}
   if(audit||asset.revision!==r.expectedAssetRevision||(review?.revision??0)!==r.expectedReviewRevision||r.expectedReviewRevision===Number.MAX_SAFE_INTEGER)return fail('REVISION_CONFLICT');
   if(r.decision==='approved'){
    if(!['quarantined','attached'].includes(asset.state)||asset.processed?.metadataStripped!==true||asset.processed?.contentScanned!==true||!validateProcessedImage({...asset.processed,surface:'profile',fileCount:1}).ok||typeof asset.providerProof!=='string')return fail('DENIED');
    const proof=await get(b.journalCollections.operations,asset.providerProof),proofAudit=await get(b.journalCollections.audits,asset.providerProof),parent=await get(b.providerCollections.drafts,asset.parentId),owner=await get(b.providerCollections.owners,asset.ownerUid),identity=await get(b.providerCollections.identities,asset.parentId),actor=await get(b.providerCollections.actors,asset.ownerUid);
    if(proof?.phase!=='complete'||proof.ownerUid!==asset.ownerUid||proof.proof?.processedDigest!==asset.processedDigest||proofAudit?.ownerUid!==asset.ownerUid||proofAudit.proofDigest!==mediaProviderRecordDigest(proof.proof)||proofAudit.providerDigest!==mediaProviderRecordDigest(proof.provider??null)||parent?.providerId!==asset.parentId||parent.ownerUid!==asset.ownerUid||parent.revision!==asset.parentRevision||owner?.providerId!==asset.parentId||owner.ownerUid!==asset.ownerUid||owner.revision!==parent.revision||identity?.providerId!==asset.parentId||identity.ownerUid!==asset.ownerUid||actor?.uid!==asset.ownerUid||actor.canWrite!==true||actor.suspended!==false)return fail('DENIED');
   }
   const revision=r.expectedReviewRevision+1;context.checkpoint();context.markMutationAttempted();tx.set(sdk.doc(db,c.reviews,r.imageId),{imageId:r.imageId,ownerUid:asset.ownerUid,decision:r.decision,assetRevision:asset.revision,processedDigest:asset.processedDigest,revision,moderatorUid:uid,committedAt:sdk.serverTimestamp()});const record={requestKey:key,moderatorUid:uid,fingerprint,imageId:r.imageId,reviewRevision:revision,decision:r.decision};for(const role of ['receipts','audits'])tx.set(sdk.doc(db,c[role],key),record);context.checkpoint();return {ok:true,status:'reviewed',reviewRevision:revision};
  },{maxAttempts:3})});
 }});
}
