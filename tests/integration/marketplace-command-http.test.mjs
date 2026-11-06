import test from 'node:test';import assert from 'node:assert/strict';
import {createMarketplaceCommandHttp} from '../../scripts/marketplace-command-http.mjs';
import {createIsolatedMarketplaceRepository,MARKETPLACE_TEST_SCHEMA as m} from '../../scripts/firebase-marketplace-repository.mjs';
import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';
const profile={title:'મૂળ Cafe\u0301 हिन्दी',description:'Synthetic original',category:'cars',locationLabel:'Sample',basePrice:100,isSold:false,storeId:null,photos:[]};
const save={kind:'product',requestId:'save-1',id:null,expectedRevision:0,publication:'draft',profile};
const request=body=>({method:'POST',headers:{authorization:'Bearer fake.test.token','content-type':'application/json'},body:JSON.stringify(body)});
function fixture(options={}){
 const f=fakeFirestoreSdk();let uid='owner';f.seed(m.actors,'owner',{uid:'owner',canWrite:true,canPublish:true,suspended:false});f.seed(m.actors,'other',{uid:'other',canWrite:true,canPublish:true,suspended:false});f.seed(m.generations,'current',{value:0});
 const http=createMarketplaceCommandHttp({enabled:true,verifyFirebaseToken:(_token,ctx)=>{assert.equal(ctx.checkRevoked,true);return {uid};},consumeRateLimit:()=>({allowed:true}),createRepository:({authenticate,timeoutMs})=>createIsolatedMarketplaceRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema:m,authenticate,timeoutMs,allocateId:()=> 'product-1',mandatoryPhotos:true,photoPolicy:{check:async()=>false}}),...options});
 return {f,http,switch:()=>uid='other'};
}
test('verified private draft create, idempotent replay, owner recovery and cross-owner denial through actual repository port',async()=>{
 const {http,f,switch:other}=fixture();const first=await http.handle('save',request(save));assert.equal(first.status,200);assert.equal(first.body.status,'saved');assert.equal(f.get(m.privateRecords,'product_product-1').ownerUid,'owner');
 assert.equal((await http.handle('save',request(save))).body.status,'replayed');assert.equal(f.commits,1);
 const owner=await http.handle('owner',request({kind:'product',id:'product-1',requestId:'save-1'}));assert.equal(owner.status,200);assert.equal(owner.body.profile.title,profile.title);assert.equal(JSON.stringify(owner.body).includes('ownerUid'),false);assert.equal(owner.headers['Cache-Control'],'private, no-store');
 other();assert.equal((await http.handle('owner',request({kind:'product',id:'product-1',requestId:null}))).status,403);assert.equal((await http.handle('save',request({...save,id:'product-1',expectedRevision:1,requestId:'foreign'}))).status,403);
});
test('photo approval remains inside repository; stale revision and archive are not conflated with draft save',async()=>{
 const {http}=fixture();await http.handle('save',request(save));
 assert.equal((await http.handle('save',request({...save,id:'product-1',expectedRevision:1,requestId:'publish',publication:'publish'}))).body.error.code,'PHOTOS_REQUIRED');
 assert.equal((await http.handle('save',request({...save,id:'product-1',expectedRevision:0,requestId:'stale'}))).status,409);
 const a=await http.handle('archive',request({kind:'product',id:'product-1',expectedRevision:1,requestId:'archive'}));assert.equal(a.status,200);assert.equal(a.body.status,'archived');
});
test('disabled/auth/rate/malformed/method boundaries fail closed with no caller role or owner accepted',async()=>{
 assert.equal((await createMarketplaceCommandHttp().handle('save',request(save))).status,503);
 const {http}=fixture();assert.equal((await http.handle('save',{...request(save),headers:{'content-type':'application/json'}})).status,401);
 for(const body of [{...save,ownerUid:'forged'},{...save,kind:'__proto__'},{...save,profile:{...profile,role:'admin'}},{...save,profile:{...profile,description:'x'.repeat(17000)}}])assert.ok([400,413].includes((await http.handle('save',request(body))).status));
 assert.equal((await fixture({consumeRateLimit:null}).http.handle('save',request(save))).status,503);assert.equal((await fixture({consumeRateLimit:()=>({allowed:false})}).http.handle('save',request(save))).status,429);
 assert.equal((await http.handle('save',{...request(save),method:'GET'})).status,405);
});
test('unconfirmed mutation timeout returns retry-same-request; private response contamination is rejected',async()=>{
 const h=fixture({timeoutMs:50,createRepository:()=>({save:()=>new Promise(()=>{})})}).http;const r=await h.handle('save',request(save));assert.equal(r.status,202);assert.equal(r.body.retrySameRequest,true);
 const polluted=fixture({createRepository:()=>({save:async()=>({ok:true,status:'saved',id:'product-1',revision:1,generation:0,apiSecret:'private'})})}).http;const p=await polluted.handle('save',request(save));assert.equal(p.status,503);assert.equal(JSON.stringify(p.body).includes('private'),false);assert.equal(JSON.stringify(p.body).includes('apiSecret'),false);
});

test('Store drafts reuse the same verified owner binding without Product-specific fields',async()=>{
 const {http}=fixture();const store={name:'મૂળ Store',description:'Synthetic',category:'cars',locationLabel:'Sample',photos:[]};
 const saved=await http.handle('save',request({...save,kind:'store',profile:store}));assert.equal(saved.status,200);
 const owner=await http.handle('owner',request({kind:'store',id:null,requestId:null}));assert.equal(owner.status,200);assert.equal(owner.body.profile.name,store.name);assert.equal('title' in owner.body.profile,false);
});

test('existing Product controller drives verified HTTP draft recovery/edit/archive without a new page',async()=>{
 const {createProductIntegration}=await import('../../features/marketplace/product-integration.mjs');const {http,f}=fixture();let n=0;
 const ports=Object.fromEntries(['save','owner','archive'].map(op=>[op,async(body,ctx)=>{const response=await http.handle(op,request({...body,kind:'product'}),ctx);return response.body.ok?response.body:{ok:false,code:response.body.error.code};}]));
 const ui=createProductIntegration({enabled:true,ports,makeRequestId:()=> 'ui-'+(++n)});ui.setSession({uid:'owner',sessionId:'session-1'});
 await ui.save(profile);assert.equal(ui.snapshot().owner.id,'product-1');
 await ui.loadOwner('product-1');assert.equal(ui.snapshot().statuses.owner,'ready');
 await ui.save({...profile,title:'Authored ગુજરાતી हिन्दी update'});assert.equal(f.get(m.privateRecords,'product_product-1').revision,2);
 await ui.save({...profile,title:'Authored ગુજરાતી हिन्दी update'},'publish');assert.equal(f.get(m.privateRecords,'product_product-1').published,false);
 await ui.archive();assert.equal(f.get(m.privateRecords,'product_product-1').archived,true);ui.setSession(null);assert.equal(ui.snapshot().owner,null);
});

test('bounded HTTP body accommodates valid Gujarati/Hindi text and six managed references, rejects oversized bodies',async()=>{
 const {http}=fixture();const large={...profile,title:'અ'.repeat(120),description:'अ'.repeat(5000),locationLabel:'અ'.repeat(160),photos:Array.from({length:6},(_,i)=>({kind:'managed',imageId:'image_'+'a'.repeat(73)+i}))};
 const body={...save,profile:large};assert.ok(Buffer.byteLength(JSON.stringify(body))>16384);assert.equal((await http.handle('save',request(body))).status,200);
 assert.equal((await http.handle('save',request({...save,profile:{...profile,description:'x'.repeat(33000)}}))).status,413);
});

test('real HTTP default never accepts an unsigned Emulator token',async()=>{
 const {http}=fixture();const r=request(save);r.headers.authorization='Bearer fake.test.';assert.equal((await http.handle('save',r)).status,401);
});

test('authenticated command bridge drives existing Product UI and repository; lost acknowledgement reuses request',async()=>{
 const {createAuthenticatedMarketplaceCommands}=await import('../../features/marketplace/authenticated-command-client.mjs');
 const {createProductIntegration}=await import('../../features/marketplace/product-integration.mjs');
 const {http,f}=fixture();const calls=[];let lose=true;
 const ports=createAuthenticatedMarketplaceCommands({enabled:true,getToken:scope=>({...scope,token:'fake.test.token'}),sendCommand:async(op,body,auth)=>{
  calls.push(structuredClone(body));const response=await http.handle(op,{...request(body),headers:{...request(body).headers,authorization:'Bearer '+auth.credential}},{signal:auth.signal});
  if(lose&&op==='save'){lose=false;throw Error('lost acknowledgement');}return response;
 }});
 const ui=createProductIntegration({enabled:true,ports,makeRequestId:()=> 'bridge-key'});ui.setSession({uid:'owner',sessionId:'session'});
 await ui.save(profile);assert.equal(ui.snapshot().command.status,'unknown');assert.equal(f.commits,1);
 await ui.retry();assert.deepEqual(calls[0],calls[1]);assert.equal(f.commits,1);assert.equal(ui.snapshot().command.status,'saved');
 await ui.loadOwner('product-1');assert.equal(ui.snapshot().statuses.owner,'ready');
 assert.equal(f.get(m.privateRecords,'product_product-1').profile.title,profile.title);
 ui.setSession(null);assert.equal(ui.snapshot().owner,null);
});

test('command bridge defaults off, rejects foreign token and caller ownership without dispatch',async()=>{
 const {createAuthenticatedMarketplaceCommands:make}=await import('../../features/marketplace/authenticated-command-client.mjs');let sent=0;
 const context={session:{uid:'owner',sessionId:'session'}};const body={...save};delete body.kind;
 assert.equal((await make().save(body,context)).code,'UNAVAILABLE');
 const client=make({enabled:true,getToken:()=>({uid:'foreign',sessionId:'session',token:'fake.test.token'}),sendCommand:()=>{sent++;}});
 assert.equal((await client.save(body,context)).code,'AUTH_REQUIRED');assert.equal((await client.save({...body,ownerUid:'forged'},context)).code,'INVALID_REQUEST');assert.equal(sent,0);
});

test('token acquisition cancellation and late session responses never populate Product state',async()=>{
 const {createAuthenticatedMarketplaceCommands:make}=await import('../../features/marketplace/authenticated-command-client.mjs');
 const {createProductIntegration}=await import('../../features/marketplace/product-integration.mjs');let release,sent=0;
 const ports=make({enabled:true,getToken:s=>new Promise(r=>release=()=>r({...s,token:'fake.test.token'})),sendCommand:()=>{sent++;}});
 const ui=createProductIntegration({enabled:true,ports,makeRequestId:()=> 'cancel-key'});ui.setSession({uid:'owner',sessionId:'one'});
 const pending=ui.save(profile);await Promise.resolve();ui.setSession({uid:'other',sessionId:'two'});release();await pending;
 assert.equal(sent,0);assert.equal(ui.snapshot().owner,null);
});

test('bridge maps safe errors and rejects contaminated acknowledgements without leaking details',async()=>{
 const {createAuthenticatedMarketplaceCommands:make}=await import('../../features/marketplace/authenticated-command-client.mjs');
 const context={session:{uid:'owner',sessionId:'session'}};const body={...save};delete body.kind;
 for(const [response,code] of [[{status:403,body:{ok:false,error:{code:'DENIED',secret:'hidden'}}},'DENIED'],[{status:202,body:{}},'OUTCOME_UNKNOWN'],[{status:200,body:{ok:true,status:'saved',id:'p',revision:1,generation:0,secret:'hidden'}},'OUTCOME_UNKNOWN']]){
  const client=make({enabled:true,getToken:s=>({...s,token:'fake.test.token'}),sendCommand:()=>response});assert.deepEqual(await client.save(body,context),{ok:false,code});
 }
});

test('Product and Store trusted commands reject private/privileged legacy fields before domain writes',async()=>{
 const store={name:'Store',description:'Original',category:'cars',locationLabel:'Locality',photos:[]};
 for(const kind of ['product','store'])for(const field of ['userIp','phone','mobile','whatsapp','coords','ownerUid','sellerUid','isFeatured','isShopVerified','role']){
  const {http,f}=fixture();const original=kind==='product'?profile:store;const r=await http.handle('save',request({...save,kind,profile:{...original,[field]:field.startsWith('is')?true:'private'}}));assert.equal(r.status,400,kind+':'+field);assert.equal(f.commits,0);
 }
});
