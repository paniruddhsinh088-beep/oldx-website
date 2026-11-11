import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createIsolatedAtomicPhotoPublication} from '../../scripts/firebase-atomic-photo-publication.mjs';
import {createIsolatedMarketplaceRepository,MARKETPLACE_TEST_SCHEMA} from '../../scripts/firebase-marketplace-repository.mjs';
import {MEDIA_RELEASE_TEST_SCHEMA,createIsolatedMediaRelease} from '../../scripts/firebase-media-release.mjs';
import {createIsolatedPhotoReferenceRepository} from '../../scripts/firebase-photo-reference-repository.mjs';
import {createIsolatedPublicMediaRead} from '../../scripts/firebase-media-delivery-read.mjs';
import {createMediaDeliveryContract} from '../../scripts/media-delivery-contract.mjs';
import {createIsolatedMarketplaceMediaModerationHttp} from '../../scripts/marketplace-media-moderation-http.mjs';
export async function atomicPhotoFixture({sdk,db,seed,get,now=Date.now,queueCursorKey=new Uint8Array(32).fill(37),namespace='Atomic'}){
 let uid='atomic-owner',fail=false,lost=false;const c=Object.fromEntries(Object.keys(MEDIA_RELEASE_TEST_SCHEMA).map(k=>[k,'testOldx'+namespace+'Photo'+k])),m=Object.fromEntries(Object.keys(MARKETPLACE_TEST_SCHEMA).map(k=>[k,'testOldx'+namespace+'Market'+k]));
 const wrapper={...sdk,runTransaction:async(db,work,options)=>{const result=await sdk.runTransaction(db,async raw=>{let writes=0;return work({get:r=>raw.get(r),delete:r=>raw.delete(r),set:(r,v)=>{raw.set(r,v);if(fail&&++writes===3)throw new Error('Isolated staged-write failure');}});},options);if(lost&&result?.status==='saved'){lost=false;throw new Error('Isolated lost acknowledgement');}return result;}};
 const atomicPhotos=createIsolatedAtomicPhotoPublication({enabled:true,firestore:db,sdk:wrapper,schema:c,marketplaceSchema:m}),market=createIsolatedMarketplaceRepository({enabled:true,firestore:db,sdk:wrapper,schema:m,atomicPhotos,authenticate:()=>({uid}),allocateId:()=> 'atomic-parent'});
 await seed(m.actors,uid,{uid,canWrite:true,canPublish:true,suspended:false});await seed(m.actors,'foreign',{uid:'foreign',canWrite:true,canPublish:true,suspended:false});await seed(m.generations,'current',{value:0});await seed(c.generations,'current',{value:0});await seed(c.permissions,uid,{uid,canModerate:false,canRelease:true,suspended:false});await seed(c.permissions,'atomic-reviewer',{uid:'atomic-reviewer',canModerate:true,canRelease:false,suspended:false});
 const parentCollections={product:m.privateRecords,store:m.privateRecords,provider:'testProviderAtomicDrafts'},actorCollections={product:m.actors,store:m.actors,provider:'testProviderAtomicActors'},publicCollections={product:m.publicViews,store:m.publicViews},photoSchema={assets:c.assets,associations:c.associations,receipts:'testOldxAtomicRefReceipts',audits:'testOldxAtomicRefAudits'};
 const refs=createIsolatedPhotoReferenceRepository({enabled:true,firestore:db,sdk:wrapper,schema:photoSchema,parentCollections,actorCollections,authenticate:()=>({uid})}),releases=createIsolatedMediaRelease({enabled:true,firestore:db,sdk:wrapper,schema:c,parentCollections,actorCollections,publicCollections,authenticate:()=>({uid})});
 const moderation=createIsolatedMarketplaceMediaModerationHttp({
  enabled:true,firestore:db,sdk:wrapper,schema:c,parentCollections,actorCollections,publicCollections,
  now,queueCursorKey,
  verifyFirebaseToken:(token,{checkRevoked})=>{
   const actor=['atomic-owner','atomic-reviewer','second-reviewer','foreign'].find(id=>token===id+'.fixture.token');
   return checkRevoked&&actor?{uid:actor}:null;
  },consumeRateLimit:()=>({allowed:true})
 });
 const delivery=createMediaDeliveryContract({enabled:true,readPublicSnapshot:createIsolatedPublicMediaRead({enabled:true,firestore:db,sdk:wrapper,schema:photoSchema,releaseSchema:c,parentCollections:{product:m.privateRecords,store:m.privateRecords},actorCollections:{product:m.actors,store:m.actors},publicCollections})});
 async function attach(kind,id,parentRevision,imageId,photoRevision=0){await seed(c.assets,imageId,{imageId,ownerUid:uid,kind,parentId:id,service:null,parentRevision,revision:1,state:'quarantined',references:[],processedDigest:'a'.repeat(64),processed:{metadataStripped:true,contentScanned:true,contentType:'image/webp',byteSize:100,width:10,height:10}});const result=await refs.apply({requestId:'attach-'+imageId,kind,parentId:id,service:null,expectedParentRevision:parentRevision,expectedPhotoRevision:photoRevision,imageIds:[imageId]});assert.equal(result.ok,true);return result.photoRevision;}
 async function approve(imageId,requestId){const old=uid;uid='atomic-reviewer';const a=await get(c.assets,imageId),r=await get(c.reviews,imageId);const result=await releases.moderate({requestId,imageId,expectedAssetRevision:a.revision,expectedReviewRevision:r?.revision??0,decision:'approved'});uid=old;assert.equal(result.ok,true);}
 return {c,m,market,refs,releases,delivery,attach,approve,moderation,uid:v=>uid=v,fail:v=>fail=v,loseAck:()=>lost=true};
}

async function moderateBeforePublication({f,seed,get,hash,kind,id,imageId,request,photoRevision}){
 const reviewer='atomic-reviewer',asset=await get(f.c.assets,imageId);
 const base={imageId,expectedAssetRevision:asset.revision,expectedReviewRevision:0,decision:'approved'};
 const call=(body,actor=reviewer)=>f.moderation.handle('moderate',{
  method:'POST',headers:{'content-type':'application/json',...(actor?{authorization:'Bearer '+actor+'.fixture.token'}:{})},
  body:JSON.stringify(body)
 });
 const approve={...base,requestId:'approve-'+kind};
 const pending={...base,requestId:'pending-'+kind,decision:'pending'};
 const reject={...base,requestId:'reject-'+kind,expectedReviewRevision:1,decision:'rejected'};
 const unavailable=async()=>{
  assert.equal((await f.market.save(kind,request)).code,'PHOTOS_REQUIRED');
  assert.equal(await get(f.m.publicViews,kind+'_'+id),null);
  assert.equal((await f.delivery.publicPhotos({kind,parentId:id,expectedParentRevision:2,expectedPhotoRevision:photoRevision})).ok,false);
 };
 const queue=async()=>{
  const response=await f.moderation.handle('queue',{method:'POST',headers:{
   authorization:'Bearer atomic-reviewer.fixture.token','content-type':'application/json'
  },body:JSON.stringify({kind,limit:10,cursor:null})});
  assert.equal(response.status,200);
  return response.body.items;
 };
 assert.deepEqual(await queue(),[{kind,parentId:id,imageId,expectedAssetRevision:asset.revision,expectedReviewRevision:0}]);
 const parentKey=kind+'_'+id,parent=await get(f.m.privateRecords,parentKey);
 await seed(f.m.privateRecords,parentKey,{...parent,revision:parent.revision+1});
 assert.deepEqual(await queue(),[]);
 for(const decision of ['approved','rejected']){
  const requestId='stale-parent-'+kind+'-'+decision;
  assert.equal((await call({...base,requestId,decision})).body.error?.code,'REVISION_CONFLICT');
  const key=hash([reviewer,'moderate',requestId]);
  assert.equal(await get(f.c.reviews,imageId),null);
  assert.equal(await get(f.c.receipts,key),null);
  assert.equal(await get(f.c.audits,key),null);
  assert.equal(await get(f.c.publications,hash([kind,id,null])),null);
  assert.equal(await get(f.m.publicViews,parentKey),null);
 }
 await seed(f.m.privateRecords,parentKey,parent);
 assert.equal((await call(approve,null)).status,401);
 for(const actor of ['atomic-owner','foreign'])assert.equal((await call(approve,actor)).status,403);
 assert.equal((await call({...approve,moderatorUid:reviewer})).status,400);
 assert.equal((await call({...approve,expectedAssetRevision:asset.revision-1})).body.error.code,'REVISION_CONFLICT');
 assert.equal((await call(pending)).body.status,'moderated');
 assert.equal((await queue())[0].expectedReviewRevision,1);
 await unavailable();
 assert.equal((await call(reject)).body.status,'moderated');
 assert.deepEqual(await queue(),[]);
 await unavailable();
 assert.equal((await call(pending)).body.error.code,'IDEMPOTENCY_CONFLICT');
 assert.equal((await call({...reject,decision:'approved'})).body.error.code,'IDEMPOTENCY_CONFLICT');

 const currentApproval={...approve,expectedReviewRevision:2};
 const auditId=hash([reviewer,'moderate',approve.requestId]);
 f.fail(true);
 try{assert.equal((await call(currentApproval)).status,202);}finally{f.fail(false);}
 assert.equal((await get(f.c.reviews,imageId)).decision,'rejected');
 assert.equal(await get(f.c.audits,auditId),null);
 assert.equal(await get(f.c.receipts,auditId),null);
 const duplicate=await Promise.all([call(currentApproval),call(currentApproval)]);
 assert.deepEqual(duplicate.map(response=>response.body.status).sort(),['moderated','replayed']);
 await seed(f.m.privateRecords,parentKey,{...parent,revision:parent.revision+1});
 assert.equal((await call(currentApproval)).body.status,'replayed');
 await seed(f.m.privateRecords,parentKey,parent);
 assert.deepEqual(await queue(),[]);
 const audit=await get(f.c.audits,auditId);
 assert.equal(audit.assetRevision,asset.revision);
 assert.equal(audit.processedDigest,asset.processedDigest);
 assert.equal(audit.actorUid,reviewer);

 // The same image ID with a different asset revision requires a fresh decision.
 await seed(f.c.assets,imageId,{...asset,revision:asset.revision+1});
 assert.equal((await call(currentApproval)).body.error.code,'IDEMPOTENCY_CONFLICT');
 assert.deepEqual(await queue(),[{kind,parentId:id,imageId,expectedAssetRevision:asset.revision+1,expectedReviewRevision:3}]);
 await unavailable();
 await seed(f.c.assets,imageId,{...asset,revision:asset.revision+1,processedDigest:'b'.repeat(64)});
 assert.equal((await call({...currentApproval,requestId:'approve-current-'+kind,
  expectedAssetRevision:asset.revision+1,expectedReviewRevision:3})).body.status,'moderated');
}
export async function atomicPhotoAcceptance(options){
 const f=await atomicPhotoFixture(options);const {seed,get}=options,hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 for(const kind of ['product','store']){
  const profile=kind==='product'?{title:'મૂળ Cafe\u0301',description:'Seller original हिन्दी',category:'cars',locationLabel:'Ahmedabad',basePrice:10,isSold:false,storeId:null,photos:[]}:{name:'મૂળ Store',description:'Store original',category:'cars',locationLabel:'Ahmedabad',photos:[]};
  const draft=await f.market.save(kind,{requestId:'draft-'+kind,id:null,expectedRevision:0,publication:'draft',profile});assert.equal(draft.ok,true);assert.equal((await f.market.save(kind,{requestId:'draft-'+kind,id:null,expectedRevision:0,publication:'draft',profile})).status,'replayed');const id=draft.id,scope=hash([kind,id,null]),imageId='atomic_'+kind+'_image_123456789012',request={requestId:'publish-'+kind,id,expectedRevision:1,publication:'publish',profile};
  assert.equal((await f.market.save(kind,request)).code,'PHOTOS_REQUIRED');assert.equal(await get(f.m.publicViews,kind+'_'+id),null);const photoRevision=await f.attach(kind,id,1,imageId);profile.photos=[{kind:'managed',imageId}];assert.equal((await f.market.save(kind,request)).code,'PHOTOS_REQUIRED');await moderateBeforePublication({f,seed,get,hash,kind,id,imageId,request,photoRevision});
  f.uid('foreign');assert.equal((await f.market.save(kind,request)).code,'DENIED');f.uid('atomic-owner');
  await seed(f.c.permissions,'atomic-owner',{uid:'atomic-owner',canModerate:false,canRelease:false,suspended:false});assert.equal((await f.market.save(kind,request)).code,'DENIED');await seed(f.c.permissions,'atomic-owner',{uid:'atomic-owner',canModerate:false,canRelease:true,suspended:false});const reviewed=await get(f.c.reviews,imageId);await seed(f.c.assets,imageId,{...(await get(f.c.assets,imageId)),processed:{metadataStripped:true,contentScanned:false,contentType:'image/webp',byteSize:100,width:10,height:10}});assert.equal((await f.market.save(kind,request)).code,'PHOTOS_REQUIRED');await seed(f.c.assets,imageId,{...(await get(f.c.assets,imageId)),processed:{metadataStripped:true,contentScanned:true,contentType:'image/webp',byteSize:100,width:10,height:10}});
  const publishedRequest=structuredClone(request);const beforeParent=await get(f.m.privateRecords,kind+'_'+id),beforeAsset=await get(f.c.assets,imageId);f.fail(true);assert.equal((await f.market.save(kind,request)).code,'OUTCOME_UNKNOWN');f.fail(false);assert.deepEqual(await get(f.m.privateRecords,kind+'_'+id),beforeParent);assert.deepEqual(await get(f.c.assets,imageId),beforeAsset);assert.equal(await get(f.c.publications,scope),null);assert.equal(await get(f.m.publicViews,kind+'_'+id),null);
  f.loseAck();assert.equal((await f.market.save(kind,request)).code,'OUTCOME_UNKNOWN');assert.equal((await f.market.save(kind,request)).status,'replayed');const publication=await get(f.c.publications,scope);assert.equal(publication.parentRevision,2);assert.equal(publication.revision,1);assert.equal(publication.published,true);assert.deepEqual(await get(f.c.reviews,imageId),reviewed);assert.equal((await get(f.c.associations,scope)).parentRevision,2);const visible=await f.delivery.publicPhotos({kind,parentId:id,expectedParentRevision:2,expectedPhotoRevision:photoRevision});assert.equal(visible.ok,true);assert.equal(visible.photos[0].imageId,imageId);assert.equal(JSON.stringify(visible).includes('ownerUid'),false);assert.equal(JSON.stringify(visible).includes('url'),false);if(kind==='product')assert.equal((await get(f.m.publicViews,kind+'_'+id)).title,profile.title);
  assert.equal((await f.market.save(kind,{...request,requestId:'stale'})).code,'REVISION_CONFLICT');await seed(f.c.permissions,'atomic-reviewer',{uid:'atomic-reviewer',canModerate:true,canRelease:false,suspended:true});assert.equal((await f.delivery.publicPhotos({kind,parentId:id,expectedParentRevision:2,expectedPhotoRevision:photoRevision})).ok,false);await seed(f.c.permissions,'atomic-reviewer',{uid:'atomic-reviewer',canModerate:true,canRelease:false,suspended:false});
  assert.equal((await f.market.save(kind,{requestId:'edit-'+kind,id,expectedRevision:2,publication:'draft',profile})).ok,true);const replacement='atomic_'+kind+'_replacement_1234567890',nextPhoto=await f.attach(kind,id,3,replacement,photoRevision);assert.equal((await f.delivery.publicPhotos({kind,parentId:id,expectedParentRevision:2,expectedPhotoRevision:photoRevision})).ok,true);await f.approve(replacement,'replacement-review-'+kind);assert.equal((await f.market.save(kind,{requestId:'mismatched-photos-'+kind,id,expectedRevision:3,publication:'publish',profile})).code,'PHOTOS_REQUIRED');profile.photos=[{kind:'managed',imageId:replacement}];assert.equal((await f.market.save(kind,{requestId:'replace-'+kind,id,expectedRevision:3,publication:'publish',profile})).ok,true);const replaced=await f.delivery.publicPhotos({kind,parentId:id,expectedParentRevision:4,expectedPhotoRevision:nextPhoto});assert.equal(replaced.ok,true);assert.equal(replaced.photos[0].imageId,replacement);assert.equal((await get(f.c.assets,imageId)).publicRelease,null);assert.equal((await get(f.c.assets,imageId)).references.length,0);
  assert.equal((await f.market.save(kind,{requestId:'withdraw-'+kind,id,expectedRevision:4,publication:'withdraw',profile})).ok,true);assert.equal((await get(f.c.publications,scope)).published,false);assert.equal((await get(f.c.publications,scope)).photos.length,0);assert.equal((await f.delivery.publicPhotos({kind,parentId:id,expectedParentRevision:4,expectedPhotoRevision:nextPhoto})).ok,false);assert.equal((await f.market.save(kind,publishedRequest)).status,'replayed');assert.equal((await get(f.c.publications,scope)).published,false);assert.equal((await f.market.archive(kind,{requestId:'archive-'+kind,id,expectedRevision:5})).ok,true);assert.equal((await f.market.archive(kind,{requestId:'archive-'+kind,id,expectedRevision:5})).status,'replayed');assert.equal((await get(f.m.privateRecords,kind+'_'+id)).archived,true);assert.equal((await get(f.c.publications,scope)).parentRevision,6);assert.equal((await get(f.c.publications,scope)).published,false);
 }
}

export async function photoModerationRaceAcceptance({sdk,db,seed,get,actualTransactions=false}){
 let hold;
 const wrapped={...sdk,runTransaction:(db,work,options)=>sdk.runTransaction(db,async raw=>{
  const result=await work(raw);
  if(hold&&result.status===hold.status){
   const pending=hold;
   hold=null;
   pending.staged();
   await pending.resume;
  }
  return result;
 },options)};
 const f=await atomicPhotoFixture({sdk:wrapped,db,seed,get,namespace:'Race'});
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const moderate=(body,actor='atomic-reviewer')=>f.moderation.handle('moderate',{
  method:'POST',headers:{authorization:'Bearer '+actor+'.fixture.token','content-type':'application/json'},
  body:JSON.stringify(body)
 }).then(response=>response.body.status??response.body.error.code);
 async function race(status,loser,winner){
  if(!actualTransactions){const first=await winner();return [await loser(),first];}
  let staged,resume;
  const ready=new Promise(resolve=>{staged=resolve;});
  hold={status,staged,resume:new Promise(resolve=>{resume=resolve;})};
  const attempt=loser();
  try{
   await Promise.race([ready,attempt.then(()=>{throw new Error('Expected staged Firestore writes');})]);
   const result=await winner();
   resume();
   return [await attempt,result];
  }finally{hold=null;resume();await attempt;}
 }
 async function noDecision(actor,requestId){
  const key=hash([actor,'moderate',requestId]);
  assert.equal(await get(f.c.receipts,key),null);
  assert.equal(await get(f.c.audits,key),null);
 }
 await seed(f.c.permissions,'second-reviewer',{uid:'second-reviewer',canModerate:true,canRelease:false,suspended:false});
 for(const kind of ['product','store']){
  const profile=kind==='product'?{title:'Race Product',description:'Fixture',category:'cars',locationLabel:'Ahmedabad',basePrice:10,isSold:false,storeId:null,photos:[]}
   :{name:'Race Store',description:'Fixture',category:'cars',locationLabel:'Ahmedabad',photos:[]};
  const draft=await f.market.save(kind,{requestId:'race-draft-'+kind,id:null,expectedRevision:0,publication:'draft',profile});
  assert.equal(draft.ok,true);
  const id=draft.id,scope=hash([kind,id,null]),oldImage='race_old_'+kind+'_123456789012';
  const photoRevision=await f.attach(kind,id,1,oldImage);
  const stale={requestId:'race-edit-'+kind,imageId:oldImage,expectedAssetRevision:2,expectedReviewRevision:0,decision:kind==='product'?'approved':'rejected'};
  const [staleResult,edit]=await race('moderated',()=>moderate(stale),()=>f.market.save(kind,{
   requestId:'race-parent-'+kind,id,expectedRevision:1,publication:'draft',profile
  }));
  assert.equal(edit.status,'saved');
  assert.equal(staleResult,'REVISION_CONFLICT');
  await noDecision('atomic-reviewer',stale.requestId);
  assert.equal(await get(f.c.reviews,oldImage),null);
  assert.equal(await get(f.c.publications,scope),null);

  const imageId='race_current_'+kind+'_123456789012';
  const currentPhotos=await f.attach(kind,id,2,imageId,photoRevision);
  const approval={...stale,requestId:'race-approve-'+kind,imageId,decision:'approved'};
  const rejection={...approval,requestId:'race-reject-'+kind,decision:'rejected'};
  assert.equal(await moderate(approval,'foreign'),'DENIED');
  const [conflict,approved]=await race('moderated',()=>moderate(rejection,'second-reviewer'),()=>moderate(approval));
  assert.equal(approved,'moderated');
  assert.equal(conflict,'REVISION_CONFLICT');
  await noDecision('second-reviewer',rejection.requestId);
  assert.equal(await moderate(approval),'replayed');
  assert.equal((await get(f.c.reviews,imageId)).revision,1);

  profile.photos=[{kind:'managed',imageId}];
  const publish={requestId:'race-publish-'+kind,id,expectedRevision:2,publication:'publish',profile};
  assert.equal((await f.market.save(kind,publish)).status,'saved');
  const publication=await get(f.c.publications,scope),generation=(await get(f.c.generations,'current')).value;
  const query={kind,parentId:id,expectedParentRevision:3,expectedPhotoRevision:currentPhotos};
  const withdraw={...publish,requestId:'race-withdraw-'+kind,expectedRevision:3,publication:'withdraw'};
  const asset=await get(f.c.assets,imageId);
  const revoke={...rejection,requestId:'race-revoke-'+kind,expectedAssetRevision:asset.revision,expectedReviewRevision:1,
   decision:kind==='product'?'rejected':'pending'};
  f.fail(true);
  try{assert.equal(await moderate(revoke),'OUTCOME_UNKNOWN');}finally{f.fail(false);}
  await noDecision('atomic-reviewer',revoke.requestId);
  assert.deepEqual(await get(f.c.assets,imageId),asset);
  assert.deepEqual(await get(f.c.publications,scope),publication);
  assert.equal((await get(f.c.generations,'current')).value,generation);
  const [revoked,withdrawn]=await race('moderated',()=>moderate(revoke),async()=>{
   assert.equal((await f.delivery.publicPhotos(query)).ok,true);
   return f.market.save(kind,withdraw);
  });
  assert.equal(withdrawn.status,'saved');
  assert.equal(revoked,'REVISION_CONFLICT');
  await noDecision('atomic-reviewer',revoke.requestId);
  assert.equal((await get(f.c.reviews,imageId)).decision,'approved');
  assert.equal((await f.market.save(kind,{...publish,requestId:'stale-republish-'+kind,expectedRevision:3})).code,'REVISION_CONFLICT');
  assert.equal((await f.market.save(kind,publish)).status,'replayed');
  assert.equal((await f.market.save(kind,withdraw)).status,'replayed');
  assert.equal((await get(f.c.generations,'current')).value,generation+1);
  const final=await get(f.c.publications,scope);
  assert.deepEqual([final.published,final.photos,final.generation],[false,[],generation+1]);
  assert.equal((await get(f.c.assets,imageId)).references.includes(publication.referenceId),false);
  assert.equal(await get(f.m.publicViews,kind+'_'+id),null);
  assert.equal((await f.delivery.publicPhotos(query)).ok,false);

  const replacement='race_republish_'+kind+'_123456789012';
  const replacementPhotos=await f.attach(kind,id,4,replacement,currentPhotos);
  await f.approve(replacement,'race-review-replacement-'+kind);
  const republish={...publish,requestId:'race-republish-'+kind,expectedRevision:4,
   profile:{...profile,photos:[{kind:'managed',imageId:replacement}]}};
  const futureQuery={kind,parentId:id,expectedParentRevision:5,expectedPhotoRevision:replacementPhotos};
  const [lostPublish,secondWithdrawal]=await race('saved',()=>f.market.save(kind,republish),async()=>{
   assert.equal((await f.delivery.publicPhotos(futureQuery)).ok,false);
   return f.market.save(kind,{...republish,requestId:'race-second-withdraw-'+kind,publication:'withdraw'});
  });
  assert.equal(secondWithdrawal.status,'saved');
  assert.equal(lostPublish.code,'REVISION_CONFLICT');
  assert.equal((await get(f.c.generations,'current')).value,generation+2);
  assert.equal((await get(f.c.publications,scope)).published,false);
  assert.equal((await get(f.c.assets,replacement)).publicRelease,null);
  assert.equal((await f.delivery.publicPhotos(futureQuery)).ok,false);
  const requestKey=hash(['atomic-owner',kind,republish.requestId]);
  const mediaKey=hash(['atomic-parent-media','atomic-owner',kind,id,requestKey]);
  assert.equal(await get(f.c.receipts,mediaKey),null);
  assert.equal(await get(f.c.audits,mediaKey),null);
 }
 const providerId='race-provider',providerImage='race_provider_123456789012';
 const parent={providerId,ownerUid:'atomic-owner',revision:1,profile:{services:['Plumber']}};
 await seed('testProviderAtomicActors','atomic-owner',{uid:'atomic-owner',canWrite:true,suspended:false});
 await seed('testProviderAtomicDrafts',providerId,parent);
 await seed(f.c.assets,providerImage,{imageId:providerImage,kind:'provider',parentId:providerId,ownerUid:'atomic-owner',
  service:'Plumber',parentRevision:1,revision:1,state:'quarantined',references:[],processedDigest:'a'.repeat(64),
  processed:{metadataStripped:true,contentScanned:true,contentType:'image/webp',byteSize:100,width:10,height:10}});
 const providerApproval={requestId:'provider-race',imageId:providerImage,expectedAssetRevision:1,expectedReviewRevision:0,decision:'approved'};
 assert.equal(await moderate(providerApproval),'DENIED');
 f.uid('atomic-reviewer');
 const [providerStale]=await race('moderated',()=>f.releases.moderate(providerApproval),
  ()=>seed('testProviderAtomicDrafts',providerId,{...parent,revision:2}));
 assert.equal(providerStale.code,'REVISION_CONFLICT');
 assert.equal(await get(f.c.reviews,providerImage),null);
 await noDecision('atomic-reviewer',providerApproval.requestId);
}
