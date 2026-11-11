import test from 'node:test';import assert from 'node:assert/strict';import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';import {atomicPhotoAcceptance,atomicPhotoFixture} from './atomic-photo-publication-acceptance.mjs';import {createIsolatedAtomicPhotoPublication} from '../../scripts/firebase-atomic-photo-publication.mjs';
test('atomic Product/Store approved publication rollback replacement withdrawal and replay',async()=>{const f=fakeFirestoreSdk();await atomicPhotoAcceptance({sdk:f.sdk,db:f.db,seed:f.seed,get:f.get});});
test('atomic media defaults disabled and refuses live schemas',async()=>{assert.equal((await createIsolatedAtomicPhotoPublication().prepare({})).code,'UNAVAILABLE');assert.throws(()=>createIsolatedAtomicPhotoPublication({enabled:true,firestore:{app:{options:{projectId:'oldx-1c983'}}},sdk:{}}),/Isolated SDK/);});

test('marketplace moderation command defaults off before token verification or SDK access',async()=>{
 const {createIsolatedMarketplaceMediaModerationHttp}=await import('../../scripts/marketplace-media-moderation-http.mjs');
 let verified=false;
 const command=createIsolatedMarketplaceMediaModerationHttp({verifyFirebaseToken:()=>{verified=true;}});
 const response=await command.handle('moderate',{method:'POST',headers:{authorization:'Bearer local.test.token','content-type':'application/json'},body:'{}'});
 assert.equal(response.status,503);
 assert.equal(response.body.error.code,'UNAVAILABLE');
 assert.equal(verified,false);
});

test('moderation queue paginates bounded candidate pages and rechecks authority before disclosure',async()=>{
 const data=fakeFirestoreSdk();
 const original=data.sdk.getDocsFromServer;
 let queries=0,revokeAfterQuery=false,queryLimit=null;
 data.sdk.getDocsFromServer=async query=>{
  queries++;
  queryLimit=query.constraints.find(part=>part.type==='limit').value;
  const result=await original(query);
  if(revokeAfterQuery)data.seed(f.c.permissions,'atomic-reviewer',{uid:'atomic-reviewer',canModerate:false,canRelease:false,suspended:false});
  return result;
 };
 const f=await atomicPhotoFixture(data);
 data.seed(f.c.permissions,'second-reviewer',{uid:'second-reviewer',canModerate:true,canRelease:false,suspended:false});
 const draft=await f.market.save('store',{requestId:'queue-draft',id:null,expectedRevision:0,publication:'draft',
  profile:{name:'Queue Store',description:'Fixture',category:'cars',locationLabel:'Ahmedabad',photos:[]}});
 const first='asset-a-1234567890123456',second='asset-b-1234567890123456',third='asset-c-1234567890123456';
 await f.attach('store',draft.id,1,first);
 const asset=data.get(f.c.assets,first);
 for(const imageId of [second,third])data.seed(f.c.assets,imageId,{...asset,imageId,state:'quarantined',references:[],privateUrl:'https://fixture.invalid'});
 const queue=(cursor=null,actor='atomic-reviewer',kind='store',limit=1)=>f.moderation.handle('queue',{
  method:'POST',headers:{authorization:'Bearer '+actor+'.fixture.token','content-type':'application/json'},
  body:JSON.stringify({kind,limit,cursor})
 });
 assert.equal((await queue(null,'foreign')).status,403);
 assert.equal((await queue(null,'atomic-reviewer','store',11)).status,400);
 assert.equal(queries,0);
 await f.approve(first,'already-reviewed');
 const skipped=await queue();
 assert.deepEqual(skipped.body.items,[]);
 assert.ok(skipped.body.nextCursor);
 assert.equal(queryLimit,2);
 for(const response of [await queue(skipped.body.nextCursor,'second-reviewer'),await queue(skipped.body.nextCursor,'atomic-reviewer','product')]){
  assert.equal(response.body.error.code,'CURSOR_INVALID');
 }
 const middle=await queue(skipped.body.nextCursor);
 assert.deepEqual(middle.body.items,[{kind:'store',parentId:draft.id,imageId:second,expectedAssetRevision:asset.revision,expectedReviewRevision:0}]);
 const last=await queue(middle.body.nextCursor);
 assert.equal(last.body.nextCursor,null);
 assert.deepEqual(last.body.items.map(item=>item.imageId),[third]);
 revokeAfterQuery=true;
 const revoked=await queue(skipped.body.nextCursor);
 assert.equal(revoked.status,403);
 assert.equal(Object.hasOwn(revoked.body,'items'),false);
});

test('legacy publication compatibility stays unchanged without atomic media opt-in',async()=>{const {createIsolatedMarketplaceRepository,MARKETPLACE_TEST_SCHEMA:m}=await import('../../scripts/firebase-marketplace-repository.mjs');const f=fakeFirestoreSdk();f.seed(m.actors,'owner',{uid:'owner',canWrite:true,canPublish:true,suspended:false});f.seed(m.generations,'current',{value:0});const market=createIsolatedMarketplaceRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema:m,authenticate:()=>({uid:'owner'}),allocateId:()=> 'legacy'}),profile={title:'મૂળ legacy',description:'Original text',category:'cars',locationLabel:'Ahmedabad',basePrice:10,isSold:false,storeId:null,photos:['data:image/jpeg;base64,YQ==']};assert.equal((await market.save('product',{requestId:'legacy',id:null,expectedRevision:0,publication:'publish',profile})).ok,true);assert.deepEqual(f.get(m.privateRecords,'product_legacy').profile.photos,profile.photos);});
