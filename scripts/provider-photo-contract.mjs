import {copyRecord,safeId} from './isolated-firestore-context.mjs';
import {createMediaDeliveryContract} from './media-delivery-contract.mjs';
import {normalizeServiceSelections} from '../features/service-providers/service-selections.mjs';
const positive=v=>Number.isSafeInteger(v)&&v>0;
const unavailable=()=>({ok:false,code:'MEDIA_UNAVAILABLE'});
// Inactive profile-image sidecar read contract. readSnapshot is a TRUSTED atomic,
// fresh server read boundary: canonical Provider publication/identity/owner/actor,
// generation AND media approval/release facts from the same read transaction.
// It must never be implemented by browser-side filtering or a cached public DTO.
// No SDK/schema initialization, write, provider URL, token or v1 DTO extension.
export function createProviderPhotoContract({enabled=false,readSnapshot,timeoutMs=5000,now=Date.now}={}){
 const delivery=createMediaDeliveryContract({enabled,timeoutMs,now,readProviderSnapshot:async(request,context)=>{
  if(typeof readSnapshot!=='function')return null;
  const snapshot=await readSnapshot({providerId:request.parentId,expectedPublicationEpoch:request.expectedParentRevision,expectedPhotoRevision:request.expectedPhotoRevision},context);context.checkpoint();
  const row=copyRecord(snapshot?.providerPublication,['providerId','ownerUid','published','services','publicationEpoch']),identity=copyRecord(snapshot?.identity,['providerId','ownerUid']),owner=copyRecord(snapshot?.owner,['providerId','ownerUid','status']),actor=copyRecord(snapshot?.ownerActor,['uid','canWrite','suspended']);
  if(!row||row.providerId!==request.parentId||!safeId(row.ownerUid)||row.published!==true||row.publicationEpoch!==request.expectedParentRevision||!normalizeServiceSelections(row.services).ok||!positive(snapshot.providerGeneration)||snapshot.providerGeneration<row.publicationEpoch||identity?.providerId!==row.providerId||identity.ownerUid!==row.ownerUid||owner?.providerId!==row.providerId||owner.ownerUid!==row.ownerUid||owner.status!=='published'||actor?.uid!==row.ownerUid||actor.canWrite!==true||actor.suspended!==false)return null;
  const media=snapshot.media,parent=media?.parent;
  if(parent?.kind!=='provider'||parent.id!==row.providerId||parent.ownerUid!==row.ownerUid||parent.publicationRevision!==row.publicationEpoch||parent.published!==true||parent.actorActive!==true)return null;
  return media;
 }});
 return Object.freeze({async profilePhoto(request,options){
  const r=copyRecord(request,['providerId','expectedPublicationEpoch','expectedPhotoRevision']);
  if(enabled!==true||!r||!safeId(r.providerId)||!positive(r.expectedPublicationEpoch)||!positive(r.expectedPhotoRevision))return unavailable();
  const result=await delivery.providerPhotos({kind:'provider',parentId:r.providerId,expectedParentRevision:r.expectedPublicationEpoch,expectedPhotoRevision:r.expectedPhotoRevision},options);
  if(!result.ok||result.photos.length!==1)return unavailable();
  return {ok:true,providerId:result.parentId,publicationEpoch:result.parentRevision,photoRevision:result.photoRevision,photos:result.photos};
 }});
}
