import test from 'node:test';import assert from 'node:assert/strict';
import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';
import {createStagingMarketplaceRuntime} from '../../functions/staging-marketplace/runtime.mjs';
import {createStagingMarketplaceBinding,STAGING_MARKETPLACE_COLLECTIONS as c,STAGING_RATE_COLLECTION} from '../../scripts/staging-marketplace-context.mjs';
import {createStagingMarketplaceRepository,createIsolatedMarketplaceRepository} from '../../scripts/firebase-marketplace-repository.mjs';
const profile={title:'મૂળ हिन्दी',description:'Synthetic',category:'cars',locationLabel:'Sample',basePrice:100,isSold:false,storeId:null,photos:[]};
const save={kind:'product',requestId:'first',id:null,expectedRevision:0,publication:'draft',profile};
const request=body=>({method:'POST',headers:{authorization:'Bearer fake.test.token','content-type':'application/json'},body:JSON.stringify(body)});
function fixture(overrides={}){
 const f=fakeFirestoreSdk(),clock=Date.now();let uid='owner',revoked=false,verified=0,failDomain=false;
 // Native Admin-shaped TEST DOUBLE; does not initialize Firebase or use credentials.
 const adminFirestore={projectId:'oldx-staging',collection:name=>({doc:id=>f.sdk.doc(f.db,name,id)}),runTransaction:(work,opts)=>f.sdk.runTransaction(f.db,async tx=>{let domain=false;const result=await work({get:async ref=>{const s=await tx.get(ref);return {exists:s.exists(),data:s.data};},set:(ref,value)=>{if(ref.path.startsWith(c.privateRecords+'/'))domain=true;tx.set(ref,value);},delete:(...args)=>tx.delete(...args)});if(domain&&failDomain)throw Error('Simulated domain commit failure');return result;},opts)};
 const adminAuth={app:{options:{projectId:'oldx-staging'}},verifyIdToken:async(_token,checkRevoked)=>{verified++;assert.equal(checkRevoked,true);if(revoked)throw Error('private token detail');const now=Math.floor(Date.now()/1000);return {uid,sub:uid,aud:'oldx-staging',iss:'https://securetoken.google.com/oldx-staging',iat:now,exp:now+3600};}};
 for(const actor of ['owner','other'])f.seed(c.actors,actor,{uid:actor,canWrite:true,canPublish:true,suspended:false});f.seed(c.generations,'current',{value:0});
 const options={now:()=>clock,enabled:true,projectId:'oldx-staging',deploymentEnvironment:'preview',adminFirestore,adminAuth,FieldValue:{serverTimestamp:f.sdk.serverTimestamp},ratePolicy:{windowMs:60000,actorLimit:20,globalLimit:100},...overrides};
 return {f,options,failDomain:()=>failDomain=true,create:()=>createStagingMarketplaceRuntime(options),other:()=>uid='other',revoke:()=>revoked=true,get verified(){return verified;}};
}
test('staging-native binding executes verified owner draft/create/retry/edit/owner recovery with atomic audit',async()=>{
 const f=fixture(),runtime=f.create();let r=await runtime.handle('/api/staging/marketplace/save',request(save));assert.equal(r.status,200);const id=r.body.id;
 assert.equal(f.f.get(c.privateRecords,'product_'+id).ownerUid,'owner');assert.equal((await runtime.handle('/api/staging/marketplace/save',request(save))).body.status,'replayed');
 r=await runtime.handle('/api/staging/marketplace/save',request({...save,id,expectedRevision:1,requestId:'edit',profile:{...profile,title:'મૂળ update'}}));assert.equal(r.body.revision,2);
 r=await runtime.handle('/api/staging/marketplace/owner',request({kind:'product',id,requestId:'edit'}));assert.equal(r.status,200);assert.equal(r.body.profile.title,'મૂળ update');assert.equal('ownerUid' in r.body,false);
 assert.equal([...f.f.snapshot().keys()].some(k=>k.startsWith(STAGING_RATE_COLLECTION+'/')),true);
});
test('other owner, guest and revoked token cannot read/write original owner records',async()=>{
 const f=fixture(),runtime=f.create(),saved=await runtime.handle('/api/staging/marketplace/save',request(save)),id=saved.body.id;f.other();
 assert.equal((await runtime.handle('/api/staging/marketplace/owner',request({kind:'product',id,requestId:null}))).status,403);
 assert.equal((await runtime.handle('/api/staging/marketplace/save',request({...save,id,expectedRevision:1,requestId:'foreign'}))).status,403);
 assert.equal((await runtime.handle('/api/staging/marketplace/save',{...request(save),headers:{'content-type':'application/json'}})).status,401);
 f.revoke();const before=f.f.calls;assert.equal((await runtime.handle('/api/staging/marketplace/save',request(save))).status,401);assert.equal(f.f.calls,before);
});
test('publication and media-less withdrawal remain gated even for an eligible owner',async()=>{
 const f=fixture(),runtime=f.create(),id=(await runtime.handle('/api/staging/marketplace/save',request(save))).body.id;
 for(const publication of ['publish','withdraw'])assert.equal((await runtime.handle('/api/staging/marketplace/save',request({...save,id,expectedRevision:1,requestId:publication,publication}))).status,503);
 assert.equal(f.f.get(c.privateRecords,'product_'+id).published,false);
});
test('withdrawal uses required atomic interface in the SAME native transaction; replay and rollback safe',async()=>{
 const f=fixture({createMediaBindings:b=>({photoPolicy:{check:async()=>false},atomicPhotos:{marketplaceCollections:b.collections,prepare:async(tx,claims)=>({ok:true,commit(){tx.set(b.sdk.doc(b.db,c.audits,'media_'+claims.requestKey),{operation:claims.action,parentId:claims.next.id});}}),verifyReplay:async(tx,claims)=>{const r=await tx.get(b.sdk.doc(b.db,c.audits,'media_'+claims.requestKey));return r.exists()&&r.data().operation===claims.action;}}})});
 const runtime=f.create(),id=(await runtime.handle('/api/staging/marketplace/save',request(save))).body.id,withdraw={...save,id,expectedRevision:1,requestId:'withdraw',publication:'withdraw'};
 assert.equal((await runtime.handle('/api/staging/marketplace/save',request(withdraw))).status,200);assert.equal((await runtime.handle('/api/staging/marketplace/save',request(withdraw))).body.status,'replayed');
 const domain=()=>new Map([...f.f.snapshot()].filter(([path])=>!path.startsWith(STAGING_RATE_COLLECTION+'/')));const before=domain();f.failDomain();const failed=await runtime.handle('/api/staging/marketplace/save',request({...withdraw,requestId:'rollback',expectedRevision:2}));assert.equal(failed.status,202);assert.equal(failed.body.retrySameRequest,true);assert.deepEqual(domain(),before);
});
test('production/wrong project/forged context and non-approved routes are denied without SDK access',async()=>{
 for(const patch of [{enabled:false},{deploymentEnvironment:'production'},{projectId:'oldx-1c983'},{adminAuth:{app:{options:{projectId:'oldx-1c983'}}}},{ratePolicy:null}]){const f=fixture(patch);assert.equal((await f.create().handle('/api/staging/marketplace/save',request(save))).status,503);assert.equal(f.f.calls,0);}
 const f=fixture();assert.equal((await f.create().handle('/api/production/save',request(save))).status,404);
 assert.throws(()=>createStagingMarketplaceRepository({enabled:true,binding:{}}));assert.throws(()=>createIsolatedMarketplaceRepository({enabled:true,firestore:f.options.adminFirestore,sdk:f.f.sdk,schema:c}));
 const b=createStagingMarketplaceBinding(f.options);assert.throws(()=>b.sdk.doc(b.db,'products','legacy'));
 f.options.adminFirestore.projectId='oldx-1c983';assert.throws(()=>b.sdk.doc(b.db,c.actors,'owner'));
});
test('native atomic global/actor rate limits fail closed before Product mutation',async()=>{
 const f=fixture({ratePolicy:{windowMs:60000,actorLimit:1,globalLimit:1}}),runtime=f.create();assert.equal((await runtime.handle('/api/staging/marketplace/save',request(save))).status,200);
 assert.equal((await runtime.handle('/api/staging/marketplace/save',request({...save,requestId:'rate-blocked'}))).status,429);assert.equal([...f.f.snapshot().keys()].filter(k=>k.startsWith(c.privateRecords+'/')).length,1);
});

test('binding namespaces match owner target and foreign/expired verified claims fail before transactions',async()=>{
 const {readFile}=await import('node:fs/promises');const proposal=JSON.parse(await readFile(new URL('../../docs/proposals/product-staging-activation-review.json',import.meta.url),'utf8'));assert.deepEqual(c,proposal.proposedMarketplaceCollections);
 for(const patch of [{aud:'oldx-1c983'},{iss:'https://securetoken.google.com/oldx-1c983'},{exp:1}]){
  const f=fixture();f.options.adminAuth.verifyIdToken=async()=>({uid:'owner',sub:'owner',aud:'oldx-staging',iss:'https://securetoken.google.com/oldx-staging',iat:1,exp:9999999999,...patch});
  assert.equal((await f.create().handle('/api/staging/marketplace/save',request(save))).status,401);assert.equal(f.f.calls,0);
 }
});

test('only explicitly enabled Preview staging environment can produce runtime options',async()=>{
 const {stagingMarketplaceOptionsFromEnvironment:parse}=await import('../../functions/staging-marketplace/runtime.mjs');
 const env={OLDX_STAGING_COMMANDS_ENABLED:'true',VERCEL_ENV:'preview',OLDX_FIREBASE_ENV:'staging',OLDX_FIREBASE_PROJECT_ID:'oldx-staging',OLDX_RATE_WINDOW_MS:'60000',OLDX_RATE_ACTOR_LIMIT:'10',OLDX_RATE_GLOBAL_LIMIT:'60'};
 assert.equal(parse().enabled,false);assert.equal(parse(env).enabled,true);assert.equal(parse(env).publicationEnabled,false);
 for(const patch of [{VERCEL_ENV:'production'},{OLDX_FIREBASE_PROJECT_ID:'oldx-1c983'},{OLDX_RATE_ACTOR_LIMIT:'1e3'},{OLDX_RATE_WINDOW_MS:'0'},{OLDX_STAGING_COMMANDS_ENABLED:'false'},{OLDX_STAGING_PUBLICATION_ENABLED:'yes'}])assert.equal(parse({...env,...patch}).enabled,false);
});

test('native namespace media policy/reference/atomic/delivery reuse the trusted pipeline',async()=>{
 const {createStagingMarketplaceMedia}=await import('../../scripts/staging-marketplace-media.mjs');
 const f=fixture({publicationEnabled:true,createMediaBindings:b=>createStagingMarketplaceMedia({enabled:true,binding:b})}),runtime=f.create();
 const id=(await runtime.handle('/api/staging/marketplace/save',request(save))).body.id,b=createStagingMarketplaceBinding(f.options),m=b.mediaCollections;
 const media=createStagingMarketplaceMedia({enabled:true,binding:b,authenticate:()=>({uid:'owner'})}),imageId='native_photo_12345678901234567890',digest='b'.repeat(64);
 f.f.seed(m.assets,imageId,{imageId,kind:'product',parentId:id,ownerUid:'owner',service:null,parentRevision:1,revision:0,state:'quarantined',references:[],processedDigest:digest,processed:{contentType:'image/webp',byteSize:100,width:10,height:10,metadataStripped:true,contentScanned:true}});
 assert.equal((await media.references.apply({requestId:'ref',kind:'product',parentId:id,expectedParentRevision:1,expectedPhotoRevision:0,imageIds:[imageId],service:null})).ok,true);
 f.f.seed(m.generations,'current',{value:0});f.f.seed(m.permissions,'owner',{uid:'owner',canModerate:false,canRelease:true,suspended:false});f.f.seed(m.permissions,'reviewer',{uid:'reviewer',canModerate:true,canRelease:false,suspended:false});
 const publish={...save,id,expectedRevision:1,requestId:'pub',publication:'publish',profile:{...profile,photos:[{kind:'managed',imageId}]}};
 assert.equal((await runtime.handle('/api/staging/marketplace/save',request(publish))).body.error.code,'PHOTOS_REQUIRED');
 f.f.seed(m.reviews,imageId,{imageId,ownerUid:'owner',moderatorUid:'reviewer',decision:'approved',assetRevision:1,processedDigest:digest,revision:1});
 assert.equal((await runtime.handle('/api/staging/marketplace/save',request(publish))).status,200);
 const photoRequest={kind:'product',parentId:id,expectedParentRevision:2,expectedPhotoRevision:1};assert.equal((await media.delivery.publicPhotos(photoRequest)).ok,true);
 assert.equal((await runtime.handle('/api/staging/marketplace/save',request({...publish,expectedRevision:2,requestId:'withdraw-native-media',publication:'withdraw'}))).status,200);
 assert.equal((await media.delivery.publicPhotos(photoRequest)).ok,false);
});
