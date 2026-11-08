import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createStagingProviderMediaRuntime} from '../../scripts/staging-media-provider-runtime.mjs';
import {createStagingProviderPhotoReferenceRepository} from '../../scripts/firebase-photo-reference-repository.mjs';
import {mediaQuotaKeys} from '../../scripts/firebase-media-journal.mjs';
export async function exerciseProviderMedia({binding:b,seed,read,inputBytes,onPublished}){
 const c=b.providerCollections,j=b.journalCollections,parentId='media-provider',bytes=inputBytes??new Uint8Array(Buffer.from('RIFF0000WEBPfixture')),digest=createHash('sha256').update(bytes).digest('hex');let actor='media-owner',sends=0,loss=false,deletes=0,parentRevision=1;
 const profile={id:parentId,displayName:'મૂળ Media Provider',city:'Ahmedabad',serviceArea:'Sample area',services:['Repair','Plumber'],description:'Original',experienceYears:null,available:true,languages:['gu','hi','en']};
 await seed(c.actors,actor,{uid:actor,canWrite:true,suspended:false});await seed(c.identities,parentId,{providerId:parentId,ownerUid:actor});await seed(c.owners,actor,{providerId:parentId,ownerUid:actor,revision:1,status:'draft'});await seed(c.drafts,parentId,{providerId:parentId,ownerUid:actor,revision:1,profile});
 const quota={known:true,bytesReserved:0,imagesReserved:0,maxBytes:30000000,maxImages:20,reservationsUsed:0,maxReservations:50};for(const service of [null,'Repair','Plumber'])for(const key of mediaQuotaKeys(actor,'provider',parentId,service))await seed(j.quotas,key,quota);
 const {createStagingProviderMediaAuthorization}=await import('../../scripts/provider-media-authorization.mjs');const authorization=createStagingProviderMediaAuthorization({enabled:true,binding:b});
 const options={enabled:true,binding:b,authenticate:()=>({uid:actor}),processor:{decodeAndReencode:async source=>({bytes:source,contentType:'image/webp',width:10,height:10,metadataStripped:true,contentScanned:true})},createUploadProvider:({persistVerifiedUpload})=>({uploadProcessed:async input=>{sends++;assert.equal(await authorization.authorizeUpload({actorUid:actor,publicId:input.publicId,byteSize:bytes.length,digest},{signal:new AbortController().signal}),true);assert.equal(await authorization.authorizeUpload({actorUid:'foreign',publicId:input.publicId,byteSize:bytes.length,digest},{}),false);assert.equal(await authorization.authorizeUpload({actorUid:actor,publicId:input.publicId,byteSize:bytes.length,digest:'0'.repeat(64)},{}),false);assert.equal(input.deliveryType,'authenticated');assert.equal(input.overwrite,false);await persistVerifiedUpload({assetId:'provider-media-'+sends,publicId:input.publicId,version:sends,resourceType:'image',deliveryType:'authenticated',format:'webp',byteSize:bytes.length,width:10,height:10,digest});if(loss)throw Error('Lost ack');}}),destroy:async()=>{deletes++;return {result:'ok'};}};
 const runtime=createStagingProviderMediaRuntime(options),refs=createStagingProviderPhotoReferenceRepository({enabled:true,binding:b,authenticate:options.authenticate});
 async function upload(key,service){const reserve=await runtime.journal.reserve({requestId:key,kind:'provider',parentId,service,expectedParentRevision:1,sourceDigest:digest,reservedBytes:1024});assert.equal(reserve.ok,true,JSON.stringify(reserve));const attempt=await runtime.journal.transition('attempt',{requestId:key,imageId:reserve.imageId,expectedRevision:0,proof:null});assert.equal(attempt.ok,true);const input={requestId:key,imageId:reserve.imageId,expectedRevision:1};const result=await runtime.upload(input,bytes);return {input,result};}
 loss=true;const first=await upload('provider-profile',null);assert.equal(first.result.code,'OUTCOME_UNKNOWN');assert.equal(sends,1);loss=false;assert.equal((await createStagingProviderMediaRuntime(options).upload(first.input,bytes)).state,'quarantined');assert.equal(sends,1);
 const rejected=await runtime.journal.reserve({requestId:'rejected-photo',kind:'provider',parentId,service:null,expectedParentRevision:1,sourceDigest:digest,reservedBytes:1024});assert.equal(rejected.ok,true);await runtime.journal.transition('attempt',{requestId:'rejected-photo',imageId:rejected.imageId,expectedRevision:0,proof:null});const rejects=createStagingProviderMediaRuntime({...options,processor:{decodeAndReencode:async()=>{throw Error('Invalid raster');}}}),beforeRejected=sends;assert.equal((await rejects.upload({requestId:'rejected-photo',imageId:rejected.imageId,expectedRevision:1},bytes)).code,'IMAGE_REJECTED');assert.equal((await read(j.assets,rejected.imageId)).state,'cancelled');assert.equal(sends,beforeRejected);
 const apply=(key,service,imageIds,revision=0)=>refs.apply({requestId:key,kind:'provider',parentId,expectedParentRevision:parentRevision,expectedPhotoRevision:revision,service,imageIds});
 assert.equal((await apply('profile-ref',null,[first.input.imageId])).ok,true);assert.equal((await apply('profile-ref',null,[first.input.imageId])).status,'replayed');
 assert.equal((await runtime.journal.transition('lease-delete',{requestId:'attached-delete',imageId:first.input.imageId,expectedRevision:3,proof:null})).ok,false);
 const works=[];for(let i=0;i<6;i++){const work=await upload('work-'+i,'Repair');assert.equal(work.result.state,'quarantined');works.push(work.input.imageId);}assert.equal((await apply('work-six','Repair',works)).ok,true);
 const extra=await upload('work-extra','Plumber');assert.equal(extra.result.ok,true);assert.equal((await apply('over-limit','Plumber',[extra.input.imageId])).code,'LIMIT_REACHED');
 assert.equal((await apply('wrong-role',null,[works[0]],1)).ok,false);assert.equal((await apply('stale-ref','Repair',works,0)).code,'REVISION_CONFLICT');
 const {createStagingProviderMediaRelease}=await import('../../scripts/provider-media-release.mjs'),{createStagingFirebaseProviderRepository}=await import('../../scripts/firebase-provider-repository.mjs'),{createProviderV1Integration}=await import('../../scripts/provider-schema-v1.mjs'),{createApprovedProviderMediaByteDelivery}=await import('../../scripts/approved-media-byte-delivery.mjs');
 const release=createStagingProviderMediaRelease({enabled:true,binding:b});await seed(c.permissions,'media-owner',{uid:'media-owner',canPublish:true,canWithdraw:true,suspended:false});await seed(c.generations,'current',{value:0});
 const owner=createProviderV1Integration({enabled:true,repository:createStagingFirebaseProviderRepository({enabled:true,binding:b,mediaRelease:release}),catalog:{version:1,stateCode:'GJ',services:['Repair','Plumber'],localities:[{city:'Ahmedabad',serviceArea:'Sample area'}]},authenticate:options.authenticate,mandatoryPhotos:true});
 const {createStagingProviderPublicMedia}=await import('../../scripts/provider-public-media.mjs');
 const {createStagingProviderMediaHttp}=await import('../../scripts/provider-media-http.mjs');
 const scope={kind:'provider',parentId,expectedParentRevision:1};
 let beforeDerivativeReturn,derivativeReads=0;
 const publicMedia=createStagingProviderPublicMedia({enabled:true,binding:b,release,consumeRateLimit:()=>({allowed:true}),readApprovedDerivative:async ({derivativeId,version})=>{
  derivativeReads++;
  await beforeDerivativeReturn?.();
  return {derivativeId,version,contentType:'image/webp',bytes};
 }});
 const publicHttp=createStagingProviderMediaHttp({enabled:true,binding:b,publicMedia});
 const publicPhoto=(imageId,expectedPhotoRevision)=>publicHttp.command('photo',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({...scope,imageId,expectedPhotoRevision})
 });
 const draftPhoto=await publicPhoto(first.input.imageId,1);
 assert.equal(draftPhoto.status,503);assert.equal(draftPhoto.bytes,undefined);assert.equal(derivativeReads,0);
 const publish={requestId:'publish-media-provider',expectedRevision:1,expectedGeneration:0,action:'publish'};assert.equal((await owner.managePublication(publish)).ok,false);
 await seed(b.mediaCollections.permissions,'media-owner',{uid:'media-owner',canRelease:true,canModerate:true,suspended:false});await seed(b.mediaCollections.permissions,'reviewer',{uid:'reviewer',canModerate:true,suspended:false});
 const {createStagingProviderMediaModeration}=await import('../../scripts/provider-media-moderation.mjs');let moderator='media-owner';const moderation=createStagingProviderMediaModeration({enabled:true,binding:b,authenticate:()=>({uid:moderator})});
 for(const imageId of [first.input.imageId,...works]){const a=await read(j.assets,imageId),decision={requestId:'review-'+imageId,imageId,expectedAssetRevision:a.revision,expectedReviewRevision:0,decision:'approved'};moderator='media-owner';assert.equal((await moderation.decide(decision)).ok,false);moderator='reviewer';assert.equal((await moderation.decide(decision)).status,'reviewed');assert.equal((await moderation.decide(decision)).status,'replayed');}

 assert.equal((await owner.managePublication(publish)).ok,true);assert.equal((await owner.managePublication(publish)).status,'replayed');
 const manifest=await release.photos(scope);assert.equal(manifest.ok,true,JSON.stringify(manifest));assert.equal(manifest.photos.length,7);assert.equal(manifest.photos[0].imageId,first.input.imageId);
 const derivative=await release.resolveDerivative({derivativeId:manifest.photos[0].derivativeId,version:manifest.photos[0].version});assert.ok(derivative);assert.equal(derivative.releaseVersion,1);
 const gateway=createApprovedProviderMediaByteDelivery({enabled:true,contract:{publicPhotos:release.photos},consumeRateLimit:()=>({allowed:true}),readApprovedDerivative:async r=>({derivativeId:r.derivativeId,version:r.version,contentType:'image/webp',bytes})});
 assert.equal((await gateway.read({...scope,expectedPhotoRevision:manifest.photoRevision,imageId:first.input.imageId})).ok,true);
 const approvedPhoto=await publicPhoto(first.input.imageId,manifest.photoRevision);
 assert.equal(approvedPhoto.status,200);assert.equal(approvedPhoto.headers['Cache-Control'],'no-store');
 assert.equal(approvedPhoto.headers['Content-Type'],'image/webp');assert.deepEqual(approvedPhoto.bytes,bytes);
 const rejectedPhoto=await publicPhoto(rejected.imageId,manifest.photoRevision);
 assert.equal(rejectedPhoto.status,503);assert.equal(rejectedPhoto.bytes,undefined);assert.equal(derivativeReads,1);
 assert.equal((await publicMedia.manifest(scope)).ok,true);await onPublished?.({release,publicMedia,manifest,scope,parentId,bytes});
 await seed(b.mediaCollections.permissions,'reviewer',{uid:'reviewer',canModerate:true,suspended:true});assert.equal((await release.photos(scope)).ok,false);await seed(b.mediaCollections.permissions,'reviewer',{uid:'reviewer',canModerate:true,suspended:false});
 // Hold the provider response after authorization, then withdraw before bytes can leave the gateway.
 const reading=Promise.withResolvers(),finishRead=Promise.withResolvers();
 beforeDerivativeReturn=()=>{reading.resolve();return finishRead.promise;};
 const inFlight=publicPhoto(first.input.imageId,manifest.photoRevision);
 try{
  assert.equal(await Promise.race([reading.promise.then(()=>true),inFlight.then(()=>false)]),true);
  assert.equal((await owner.managePublication({requestId:'withdraw-media-provider',expectedRevision:1,expectedGeneration:1,action:'withdraw'})).ok,true);
 }finally{finishRead.resolve();}
 const revokedPhoto=await inFlight;
 assert.equal(revokedPhoto.status,503);assert.equal(revokedPhoto.bytes,undefined);
 assert.equal((await publicPhoto(first.input.imageId,manifest.photoRevision)).status,503);
 assert.equal((await release.photos(scope)).ok,false);assert.equal((await gateway.read({...scope,expectedPhotoRevision:manifest.photoRevision,imageId:first.input.imageId})).ok,false);
 assert.equal((await owner.managePublication(publish)).status,'replayed');assert.equal((await release.photos(scope)).ok,false);
 const currentProfileAsset=await read(j.assets,first.input.imageId);moderator='reviewer';assert.equal((await moderation.decide({requestId:'reject-profile-review',imageId:first.input.imageId,expectedAssetRevision:currentProfileAsset.revision,expectedReviewRevision:1,decision:'rejected'})).status,'reviewed');assert.equal((await moderation.decide({requestId:'review-'+first.input.imageId,imageId:first.input.imageId,expectedAssetRevision:3,expectedReviewRevision:0,decision:'approved'})).status,'replayed');assert.equal((await read(b.mediaCollections.reviews,first.input.imageId)).decision,'rejected');
 const {id:ignored,...editable}=profile;assert.equal((await owner.saveDraft({requestId:'edit-media-text',expectedRevision:1,profile:{...editable,description:'Edited original'}})).ok,true);parentRevision=2;
 assert.equal((await apply('rebind-profile',null,[first.input.imageId],1)).ok,true);assert.equal((await apply('rebind-work','Repair',works,1)).ok,true);assert.equal((await read(j.assets,first.input.imageId)).parentRevision,2);
 assert.equal((await owner.managePublication({requestId:'no-stale-review',expectedRevision:2,expectedGeneration:2,action:'publish'})).ok,false);
 actor='other';assert.equal((await apply('foreign-ref',null,[],1)).ok,false);assert.equal((await runtime.upload(first.input,bytes)).ok,false);actor='media-owner';
 assert.equal((await apply('profile-detach',null,[],2)).ok,true);const image=await read(j.assets,first.input.imageId);assert.equal(image.references.length,0);const lease=await runtime.journal.transition('lease-delete',{requestId:'delete-profile',imageId:image.imageId,expectedRevision:image.revision,proof:null});assert.equal(lease.ok,true);const del={requestId:'delete-profile',imageId:image.imageId,expectedRevision:lease.revision};assert.equal((await runtime.remove(del)).state,'deleted');assert.equal((await runtime.remove(del)).replayed,true);assert.equal(deletes,1);
 const privateAsset=await read(j.assets,works[0]);assert.equal(privateAsset.publicRelease,null);assert.equal(privateAsset.state,'attached');
 await seed(c.identities,parentId,{providerId:parentId,ownerUid:'foreign'});const before=sends;assert.equal((await runtime.journal.reserve({requestId:'identity-mismatch',kind:'provider',parentId,service:null,expectedParentRevision:parentRevision,sourceDigest:digest,reservedBytes:1024})).ok,false);assert.equal(sends,before);
 await seed(c.identities,parentId,{providerId:parentId,ownerUid:'media-owner'});await seed(c.actors,'media-owner',{uid:'media-owner',canWrite:true,suspended:true});assert.equal((await apply('suspended','Repair',[],1)).ok,false);
}
