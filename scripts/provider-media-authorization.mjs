import {createHash} from 'node:crypto';
import {requireStagingMarketplaceBinding} from './staging-marketplace-context.mjs';
import {runVerifiedOperation} from './verified-operation.mjs';
import {safeId} from './isolated-firestore-context.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Trusted signer/transport callbacks. No browser role/UID is an authority here:
// caller MUST be the verified HTTP/coordinator context. No public signing route.
export function createStagingProviderMediaAuthorization({enabled=false,binding,release}={}){
 if(enabled!==true)return Object.freeze({authorizeUpload:async()=>false,authorizeAsset:async()=>false});const b=requireStagingMarketplaceBinding(binding),{sdk,db}=b,c=b.providerCollections,j=b.journalCollections;
 async function check(input,context,upload){if(!safeId(input?.actorUid??context?.actorUid)||!/^oldx\/quarantine\/[A-Za-z0-9_-]{20,80}$/.test(input?.publicId??''))return false;const uid=input.actorUid??context.actorUid,id=input.publicId.split('/').at(-1);
  const result=await runVerifiedOperation({authenticate:()=>({uid}),signal:context?.signal,timeoutMs:1500,run:scope=>sdk.runTransaction(db,async tx=>{const get=async(collection,key)=>{scope.checkpoint();const s=await tx.get(sdk.doc(db,collection,key));return s.exists()?s.data():null;},asset=await get(j.assets,id);
   if(asset?.imageId!==id||asset.kind!=='provider'||asset.publicId!==input.publicId)return {ok:true,allowed:false};
   if(!upload&&['inspect','deliver'].includes(input.action)&&asset.publicRelease?.approved===true&&asset.assetId===input.assetId&&typeof release?.photos==='function')return {ok:true,allowed:false,publicScope:{kind:'provider',parentId:asset.parentId,expectedParentRevision:asset.publicRelease.parentRevision,expectedPhotoRevision:asset.publicRelease.photoRevision},imageId:id};
   if(asset.ownerUid!==uid)return {ok:true,allowed:false};const actor=await get(c.actors,uid),parent=await get(c.drafts,asset.parentId),identity=await get(c.identities,asset.parentId),owner=await get(c.owners,uid);
   if(actor?.uid!==uid||actor.canWrite!==true||actor.suspended!==false||parent?.providerId!==asset.parentId||parent.ownerUid!==uid||identity?.providerId!==asset.parentId||identity.ownerUid!==uid||owner?.providerId!==asset.parentId||owner.ownerUid!==uid||owner.revision!==parent.revision||!['draft','published'].includes(owner.status))return {ok:true,allowed:false};
   if(upload){if(asset.state!=='uploading'||asset.parentRevision!==parent.revision||!safeId(asset.attemptNonce)||asset.service!==null&&!parent.profile?.services?.includes(asset.service))return {ok:true,allowed:false};const key='providerproof_'+hash([uid,'upload',id,asset.attemptNonce,asset.revision]),row=await get(j.operations,key);return {ok:true,allowed:row?.ownerUid===uid&&row.phase==='attempting'&&row.processed?.digest===input.digest&&row.processed?.byteSize===input.byteSize&&input.byteSize<=asset.reservedBytes};}
   return {ok:true,allowed:input.action==='delete'?asset.state==='deleting'&&asset.assetId===input.assetId&&Array.isArray(asset.references)&&asset.references.length===0:input.action==='inspect'&&['uploading','quarantined','attached','deleting'].includes(asset.state)};
  },{maxAttempts:3})});
  if(!result?.ok)return false;if(result.publicScope){const current=await release.photos(result.publicScope,{signal:context?.signal});return current?.ok===true&&current.photos.some(p=>p.imageId===result.imageId);}return result.allowed===true;
 }
 return Object.freeze({authorizeUpload:(r,c)=>check(r,c,true),authorizeAsset:(r,c)=>check(r,c,false)});
}
