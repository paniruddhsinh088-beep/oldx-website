import {createHash} from 'node:crypto';
import {isolatedFirestoreContext,safeId} from './isolated-firestore-context.mjs';
import {validateProcessedImage} from './image-upload-contract-policy.mjs';
// Server-only transaction hook, not standalone authorization. The caller must
// derive owner/parent/revision inside the SAME trusted parent transaction.
// A valid quarantine/reference is not a public release or automated moderation.
export function createIsolatedMandatoryPhotoPolicy({enabled=false,firestore,sdk,schema}={}){
 if(enabled!==true)return Object.freeze({check:async()=>false});
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles:['assets','associations','reviews','publications','permissions','generations','receipts','audits']});
 const get=async(tx,role,key)=>{const s=await tx.get(sdk.doc(db,c[role],key));if(!s.exists())return null;const {committedAt,...value}=s.data();return value;};
 return Object.freeze({async check(tx,{kind,parentId,ownerUid,parentRevision}={}){
  if(!['product','store','provider'].includes(kind)||!safeId(parentId)||!safeId(ownerUid)||!Number.isSafeInteger(parentRevision)||parentRevision<1)return false;
  const scope=createHash('sha256').update(JSON.stringify([kind,parentId,null])).digest('hex'),a=await get(tx,'associations',scope);
  if(!a||a.kind!==kind||a.parentId!==parentId||a.ownerUid!==ownerUid||a.service!==null||a.parentRevision!==parentRevision||a.visibility!=='private'||!Number.isSafeInteger(a.photoRevision)||a.photoRevision<1||!Array.isArray(a.imageIds)||a.imageIds.length<1||a.imageIds.length>(kind==='product'?6:1)||new Set(a.imageIds).size!==a.imageIds.length)return false;
  for(const imageId of a.imageIds){if(typeof imageId!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(imageId))return false;const asset=await get(tx,'assets',imageId),review=await get(tx,'reviews',imageId);
   if(!asset||asset.imageId!==imageId||asset.ownerUid!==ownerUid||asset.kind!==kind||asset.parentId!==parentId||asset.parentRevision!==parentRevision||asset.service!==null||asset.state!=='attached'||!Array.isArray(asset.references)||!asset.references.includes(scope)||asset.processed?.metadataStripped!==true||asset.processed.contentScanned!==true||!validateProcessedImage({...asset.processed,surface:kind==='provider'?'profile':kind,fileCount:1}).ok||typeof asset.processedDigest!=='string'||!/^[a-f0-9]{64}$/.test(asset.processedDigest)||!review||review.imageId!==imageId||review.ownerUid!==ownerUid||review.decision!=='approved'||review.assetRevision!==asset.revision||review.processedDigest!==asset.processedDigest||!Number.isSafeInteger(review.revision)||review.revision<1||!safeId(review.moderatorUid)||review.moderatorUid===ownerUid)return false;
   const moderator=await get(tx,'permissions',review.moderatorUid);if(moderator?.uid!==review.moderatorUid||moderator.canModerate!==true||moderator.suspended!==false)return false;
  }return true;
 }});
}
