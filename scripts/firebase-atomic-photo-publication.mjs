import {createHash} from 'node:crypto';
import {isolatedFirestoreContext,safeId,copyRecord} from './isolated-firestore-context.mjs';
import {preparePhotoReferences} from './photo-reference-contract.mjs';
import {createIsolatedMandatoryPhotoPolicy} from './mandatory-photo-policy.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const int=v=>Number.isSafeInteger(v)&&v>=0&&v<Number.MAX_SAFE_INTEGER;
const roles=['assets','associations','reviews','publications','permissions','generations','receipts','audits'];
const fail=code=>({ok:false,code});
// Server-only prepare/commit hook for the EXISTING parent transaction. All reads
// finish before any writes. No own transaction, bytes, provider, credentials or URL.
export function createIsolatedAtomicPhotoPublication({enabled=false,firestore,sdk,schema,marketplaceSchema}={}){
 if(enabled!==true)return Object.freeze({prepare:async()=>fail('UNAVAILABLE')});
 const {db,collections:c}=isolatedFirestoreContext({firestore,sdk,schema,roles});
 const {collections:m}=isolatedFirestoreContext({firestore,sdk,schema:marketplaceSchema,roles:['actors','privateRecords','publicViews','owners','generations','receipts','audits']});
 if(Object.values(c).some(v=>Object.values(m).includes(v)))throw new Error('Overlapping parent/media mapping');
 const policy=createIsolatedMandatoryPhotoPolicy({enabled:true,firestore,sdk,schema});
 return Object.freeze({marketplaceCollections:m,async verifyReplay(raw,{kind,parentId,actorUid,requestKey,fingerprint,parentRevision,action}){
  const key=hash(['atomic-parent-media',actorUid,kind,parentId,requestKey]),fields=['actorUid','requestKey','fingerprint','kind','parentId','parentRevision','photoRevision','releaseRevision','generation','action'];
  const read=async role=>{const snap=await raw.get(sdk.doc(db,c[role],key));if(!snap.exists())return null;const {committedAt,...value}=snap.data();return copyRecord(value,fields);};
  const receipt=await read('receipts'),audit=await read('audits');
  return !!receipt&&!!audit&&Object.entries({kind,parentId,actorUid,requestKey,fingerprint,parentRevision,action}).every(([k,v])=>receipt[k]===v)&&int(receipt.parentRevision)&&receipt.parentRevision>0&&int(receipt.photoRevision)&&int(receipt.releaseRevision)&&receipt.releaseRevision>0&&int(receipt.generation)&&receipt.generation>0&&fields.every(k=>audit[k]===receipt[k]);
 },async prepare(raw,{kind,previous,next,actorUid,requestKey,fingerprint,action}={}){
  if(!['product','store'].includes(kind)||!['publish','withdraw','archive'].includes(action)||!safeId(actorUid)||!safeId(requestKey)||typeof fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(fingerprint)||!previous||previous.id!==next?.id||previous.kind!==kind||next.kind!==kind||previous.ownerUid!==actorUid||next.ownerUid!==actorUid||!safeId(next.id)||!int(previous.revision)||next.revision!==previous.revision+1)return fail('DENIED');
  const publish=action==='publish';if(next.published!==publish||publish&&next.publicationRevision!==next.revision||!publish&&next.publicProfile!==null)return fail('CONFLICT');
  const scopeId=hash([kind,next.id,null]),referenceId='public_'+scopeId,key=hash(['atomic-parent-media',actorUid,kind,next.id,requestKey]);
  const cache=new Map(),ref=(role,id)=>sdk.doc(db,c[role],id),get=async(role,id)=>{const r=ref(role,id);if(!cache.has(r.path)){const s=await raw.get(r);if(!s.exists())cache.set(r.path,null);else {const {committedAt,...value}=s.data();cache.set(r.path,value);}}return cache.get(r.path);};
  const old=await get('publications',scopeId),generation=await get('generations','current'),receipt=await get('receipts',key),audit=await get('audits',key);
  if(!generation||!int(generation.value)||receipt||audit)return fail('CONFLICT');
  if(old&&(!copyRecord(old,['kind','parentId','ownerUid','parentRevision','photoRevision','referenceId','published','revision','generation','photos'])||old.kind!==kind||old.parentId!==next.id||old.ownerUid!==actorUid||old.referenceId!==referenceId||typeof old.published!=='boolean'||!int(old.revision)||old.revision<1||!int(old.generation)||old.generation>generation.value||!Array.isArray(old.photos)||old.photos.length>(kind==='store'?1:6)||new Set(old.photos.map(p=>p.imageId)).size!==old.photos.length))return fail('CONFLICT');
  let association=null;const reviews=new Map();
  if(publish){const permission=await get('permissions',actorUid);if(permission?.uid!==actorUid||permission.canRelease!==true||permission.suspended!==false)return fail('DENIED');association=await get('associations',scopeId);const selected=preparePhotoReferences(kind,next.profile?.photos);if(!selected.ok||selected.references.length<1||selected.references.some(r=>r.kind!=='managed')||JSON.stringify(selected.references.map(r=>r.imageId))!==JSON.stringify(association?.imageIds)||!await policy.check(raw,{kind,parentId:next.id,ownerUid:actorUid,parentRevision:previous.revision}))return fail('PHOTOS_REQUIRED');}
  const ids=new Set([...(old?.photos??[]).map(p=>p.imageId),...(association?.imageIds??[])]);if(ids.size>12||[...ids].some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{20,80}$/.test(id)))return fail('CONFLICT');
  const assets=new Map();for(const imageId of ids){const asset=await get('assets',imageId);if(!asset||asset.imageId!==imageId||asset.kind!==kind||asset.parentId!==next.id||asset.ownerUid!==actorUid||asset.service!==null||!int(asset.revision)||!Array.isArray(asset.references)||asset.references.length>12||new Set(asset.references).size!==asset.references.length||asset.references.some(r=>!safeId(r))||!['attached','quarantined'].includes(asset.state))return fail('DENIED');assets.set(imageId,asset);
   if(publish&&association.imageIds.includes(imageId)){const review=await get('reviews',imageId);if(!review||review.assetRevision!==asset.revision||review.processedDigest!==asset.processedDigest)return fail('PHOTOS_REQUIRED');reviews.set(imageId,review);}}
  const revision=(old?.revision??0)+1,newGeneration=generation.value+1,photos=publish?association.imageIds.map(imageId=>({imageId,derivativeId:'image_'+imageId,version:revision,processedDigest:assets.get(imageId).processedDigest,reviewRevision:reviews.get(imageId).revision})):[];
  let committed=false;return Object.freeze({ok:true,commit(){if(committed)throw new Error('Duplicate media staging');committed=true;
   for(const [imageId,asset] of assets){const references=asset.references.filter(r=>r!==referenceId),photo=photos.find(p=>p.imageId===imageId);if(photo)references.push(referenceId);if(references.length>12)throw new Error('Media reference limit');raw.set(ref('assets',imageId),{...asset,parentRevision:photo?next.revision:asset.parentRevision,references,state:references.length?'attached':'quarantined',revision:asset.revision+1,publicRelease:photo?{approved:true,kind,parentId:next.id,parentRevision:next.revision,photoRevision:association.photoRevision,imageId,derivativeId:photo.derivativeId,version:revision}:null,committedAt:sdk.serverTimestamp()});}
   // Bind the same approved immutable content to the accepted parent revision.
   // Independent review rows/decisions are NEVER written by the parent owner.
   if(publish)raw.set(ref('associations',scopeId),{...association,parentRevision:next.revision,committedAt:sdk.serverTimestamp()});
   raw.set(ref('publications',scopeId),{kind,parentId:next.id,ownerUid:actorUid,parentRevision:next.revision,photoRevision:association?.photoRevision??old?.photoRevision??0,referenceId,published:publish,revision,generation:newGeneration,photos,committedAt:sdk.serverTimestamp()});
   raw.set(ref('generations','current'),{value:newGeneration});const record={actorUid,requestKey,fingerprint,kind,parentId:next.id,parentRevision:next.revision,photoRevision:association?.photoRevision??old?.photoRevision??0,releaseRevision:revision,generation:newGeneration,action};raw.set(ref('receipts',key),record);raw.set(ref('audits',key),record);
  }});
 }});
}
