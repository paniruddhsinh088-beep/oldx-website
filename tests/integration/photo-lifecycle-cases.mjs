import {createStagingAuthenticatedMedia} from '../../scripts/staging-authenticated-media.mjs';
import assert from 'node:assert/strict';
import {createStagingMarketplaceMedia} from '../../scripts/staging-marketplace-media.mjs';
import {createStagingMarketplaceRepository} from '../../scripts/firebase-marketplace-repository.mjs';
import {createStagingMediaProviderRuntime} from '../../scripts/staging-media-provider-runtime.mjs';
import {mediaQuotaKeys} from '../../scripts/firebase-media-journal.mjs';
const bytes=new Uint8Array(Buffer.from('RIFF0000WEBPsynthetic'));
export async function exercisePhotoLifecycle({binding:b,seed,read,verifyFirebaseToken=async token=>({uid:token.startsWith('other.')?'other':'owner'}),ownerToken='owner.test.sig',otherToken='other.test.sig',emulatorTokenSyntax=false}){
 const c=b.collections,m=b.mediaCollections,j=b.journalCollections;let actor='owner',byteReads=0,rollback=false;
 for(const uid of ['owner','other'])await seed(c.actors,uid,{uid,canWrite:true,canPublish:true,suspended:false});
 await seed(c.generations,'current',{value:0});await seed(m.generations,'current',{value:0});
 await seed(m.permissions,'owner',{uid:'owner',canModerate:false,canRelease:true,suspended:false});await seed(m.permissions,'reviewer',{uid:'reviewer',canModerate:true,canRelease:false,suspended:false});
 const authenticate=async()=>({uid:actor}),media=createStagingMarketplaceMedia({enabled:true,binding:b,authenticate,consumePublicRateLimit:async()=>({allowed:true}),readApprovedDerivative:async r=>{byteReads++;return {derivativeId:r.derivativeId,version:r.version,contentType:'image/webp',bytes};}});
 const draftPhotos={...media.draftPhotos,prepare:async(...args)=>{const p=await media.draftPhotos.prepare(...args);return p.ok?{...p,commit(){p.commit();if(rollback)throw Error('Synthetic rollback after staged media');}}:p;}};
 const authenticated=createStagingAuthenticatedMedia({enabled:true,binding:b,verifyFirebaseToken,consumeRateLimit:async()=>({allowed:true}),emulatorTokenSyntax});
 const privateRequest=(body,token)=>({method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 const repo=createStagingMarketplaceRepository({enabled:true,binding:b,authenticate,publicationEnabled:true,photoPolicy:media.photoPolicy,atomicPhotos:media.atomicPhotos,draftPhotos});
 const provider=createStagingMediaProviderRuntime({enabled:true,binding:b,authenticate,processor:{decodeAndReencode:async data=>({bytes:data,contentType:'image/webp',width:10,height:10,metadataStripped:true,contentScanned:true})},createUploadProvider:({persistVerifiedUpload})=>({uploadProcessed:async input=>{
  const {createHash}=await import('node:crypto');const assetId='asset-'+input.publicId.split('/').at(-1);assert.equal(await persistVerifiedUpload({assetId,publicId:input.publicId,version:120,resourceType:'image',deliveryType:'authenticated',format:'webp',byteSize:bytes.length,width:10,height:10,digest:createHash('sha256').update(bytes).digest('hex')}),true);return {assetId};
 }}),destroy:async()=>({result:'ok'})});
 async function upload(kind,parentId,revision,key){const {createHash}=await import('node:crypto');const r=await provider.journal.reserve({requestId:key,kind,parentId,service:null,expectedParentRevision:revision,sourceDigest:createHash('sha256').update(bytes).digest('hex'),reservedBytes:1024});assert.equal(r.ok,true);await provider.journal.transition('attempt',{requestId:key,imageId:r.imageId,expectedRevision:0,proof:null});assert.equal((await provider.upload({requestId:key,imageId:r.imageId,expectedRevision:1},bytes)).ok,true);return r.imageId;}
 async function review(imageId){const asset=await read(m.assets,imageId);await seed(m.reviews,imageId,{imageId,ownerUid:'owner',moderatorUid:'reviewer',decision:'approved',assetRevision:asset.revision,processedDigest:asset.processedDigest,revision:1});}
 for(const kind of ['product','store']){
  const profile={...(kind==='product'?{title:'મૂળ हिन्दी',basePrice:100,isSold:false,storeId:null}:{name:'મૂળ हिन्दी'}),description:'Synthetic',category:'cars',locationLabel:'Sample',photos:[]};
  const created=await repo.save(kind,{requestId:kind+'-create',id:null,expectedRevision:0,publication:'draft',profile});assert.equal(created.ok,true);const id=created.id;
  for(const key of mediaQuotaKeys('owner',kind,id,null))await seed(j.quotas,key,{known:true,bytesReserved:0,imagesReserved:0,maxBytes:30000000,maxImages:10,reservationsUsed:0,maxReservations:20});
  const first=await upload(kind,id,1,kind+'-upload'),selected={...profile,photos:[{kind:'managed',imageId:first}]},save={requestId:kind+'-draft',id,expectedRevision:1,publication:'draft',profile:selected};
  rollback=true;assert.equal((await repo.save(kind,save)).ok,false);rollback=false;assert.equal((await read(c.privateRecords,kind+'_'+id)).revision,1);assert.equal((await read(m.assets,first)).revision,2);
  assert.equal((await repo.save(kind,save)).revision,2);assert.equal((await repo.save(kind,save)).status,'replayed');
  const ownerRequest={kind,parentId:id,expectedParentRevision:2};assert.deepEqual((await media.ownerPhotos(ownerRequest)).photos,selected.photos);assert.deepEqual((await authenticated.command('ownerPhotos',privateRequest(ownerRequest,ownerToken))).body.photos,selected.photos);assert.equal((await authenticated.command('ownerPhotos',privateRequest(ownerRequest,otherToken))).status,403);assert.equal((await authenticated.command('ownerPhotos',privateRequest(ownerRequest,null))).status,401);
  actor='other';assert.equal((await media.ownerPhotos(ownerRequest)).ok,false);actor='owner';
  assert.equal((await media.publicManifest(ownerRequest)).ok,false);
  const publish={...save,requestId:kind+'-publish',expectedRevision:2,publication:'publish'};assert.equal((await repo.save(kind,publish)).code,'PHOTOS_REQUIRED');
  await review(first);assert.equal((await repo.save(kind,publish)).revision,3);
  const request={kind,parentId:id,expectedParentRevision:3},manifest=await media.publicManifest(request);assert.equal(manifest.ok,true);
  const getBytes=(r,imageId=first)=>media.publicBytes.read({...r,expectedPhotoRevision:manifest.photoRevision,imageId});assert.equal((await getBytes(request)).ok,true);const resolved=await media.resolveApprovedDerivative({derivativeId:manifest.photos[0].derivativeId,version:manifest.photos[0].version},{});assert.equal(resolved.version,120);assert.equal(resolved.releaseVersion,manifest.photos[0].version);assert.equal((await media.publicBytes.read({...request,expectedPhotoRevision:manifest.photoRevision,imageId:'foreign_image_123456789012345'})).ok,false);
  // Private replacement must not switch or unpublish the old approved public image.
  const second=await upload(kind,id,3,kind+'-replacement'),replacement={...profile,photos:[{kind:'managed',imageId:second}]};
  assert.equal((await repo.save(kind,{...save,requestId:kind+'-replace-draft',expectedRevision:3,profile:replacement})).revision,4);
  assert.equal((await media.publicManifest(request)).photos[0].imageId,first);assert.equal((await getBytes(request)).ok,true);
  assert.equal((await media.ownerPhotos({...ownerRequest,expectedParentRevision:4})).photos[0].imageId,second);
  await review(second);assert.equal((await repo.save(kind,{...publish,requestId:kind+'-republish',expectedRevision:4,profile:replacement})).revision,5);
  const newRequest={...request,expectedParentRevision:5},fresh=await media.publicManifest(newRequest);assert.equal(fresh.photos[0].imageId,second);assert.equal((await getBytes(request)).ok,false);
  const ownedAsset=await read(m.assets,second);await seed(m.assets,second,{...ownedAsset,ownerUid:'other'});assert.equal((await media.publicManifest(newRequest)).ok,false);await seed(m.assets,second,ownedAsset);
  await seed(m.permissions,'reviewer',{uid:'reviewer',canModerate:true,canRelease:false,suspended:true});const reads=byteReads;assert.equal((await media.publicBytes.read({...newRequest,expectedPhotoRevision:fresh.photoRevision,imageId:second})).ok,false);assert.equal(byteReads,reads);await seed(m.permissions,'reviewer',{uid:'reviewer',canModerate:true,canRelease:false,suspended:false});
  assert.equal((await repo.save(kind,{...publish,requestId:kind+'-withdraw',expectedRevision:5,publication:'withdraw',profile:replacement})).revision,6);
  assert.equal((await media.publicManifest(newRequest)).ok,false);assert.equal((await media.publicBytes.read({...newRequest,expectedPhotoRevision:fresh.photoRevision,imageId:second})).ok,false);
  assert.equal((await media.ownerPhotos({...ownerRequest,expectedParentRevision:6})).photos[0].imageId,second);
  assert.equal((await provider.journal.transition('lease-delete',{requestId:kind+'-referenced-delete',imageId:second,expectedRevision:(await read(m.assets,second)).revision,proof:null})).ok,false);
  assert.equal((await repo.save(kind,{...save,requestId:kind+'-clear',expectedRevision:6,profile})).revision,7);
  const asset=await read(m.assets,second),lease=await provider.journal.transition('lease-delete',{requestId:kind+'-delete-lease',imageId:second,expectedRevision:asset.revision,proof:null});assert.equal(lease.ok,true);
  assert.equal((await provider.remove({requestId:kind+'-delete',imageId:second,expectedRevision:lease.revision})).ok,true);
 }
}
