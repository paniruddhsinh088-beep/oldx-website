import test from 'node:test';import assert from 'node:assert/strict';
import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';
import {createStagingMarketplaceBinding} from '../../scripts/staging-marketplace-context.mjs';
import {createStagingPublicQuerySdk} from '../../scripts/staging-public-query-sdk.mjs';
import {createStagingMarketplacePublicRepository} from '../../scripts/firebase-marketplace-repository.mjs';
test('native public query planner requires exact public namespace, kind, projection and bounded query',async()=>{
 const f=fakeFirestoreSdk(),db={projectId:'oldx-staging',collection:name=>({doc:id=>f.sdk.doc(f.db,name,id)}),runTransaction:()=>assert.fail('no query dispatch for malformed scope')};
 const b=createStagingMarketplaceBinding({projectId:'oldx-staging',deploymentEnvironment:'preview',adminFirestore:db,FieldValue:{serverTimestamp:f.sdk.serverTimestamp}}),s=createStagingPublicQuerySdk({binding:b});
 assert.throws(()=>s.collection(db,b.collections.privateRecords));assert.throws(()=>s.where('ownerUid','==','owner'));assert.throws(()=>s.limit(26));assert.throws(()=>s.orderBy('createdAt','desc'));await assert.rejects(s.getDocsFromServer({}));
 const c=s.collection(db,b.collections.publicViews);assert.throws(()=>s.query(c,s.limit(2),s.orderBy('id','asc')));assert.throws(()=>s.query(c,s.where('kind','==','product'),s.orderBy('id','asc')));
 assert.equal((await createStagingMarketplacePublicRepository().list({})).ok,false);
});
test('public projection field ordering does not change publication identity',async()=>{
 const {createIsolatedMarketplaceRepository,MARKETPLACE_TEST_SCHEMA:c}=await import('../../scripts/firebase-marketplace-repository.mjs');
 const f=fakeFirestoreSdk(),row={id:'synthetic-order',kind:'product',revision:1,title:'Sample',description:'Synthetic',category:'cars',locationLabel:'Sample',basePrice:1,isSold:false,storeId:null};
 f.seed(c.actors,'owner',{uid:'owner',canWrite:true,suspended:false});f.seed(c.generations,'current',{value:0});f.seed(c.privateRecords,'product_'+row.id,{...row,ownerUid:'owner',published:true,publicationRevision:1,publicProfile:row});f.seed(c.publicViews,'product_'+row.id,Object.fromEntries(Object.entries(row).reverse()));
 const repo=createIsolatedMarketplaceRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema:c,readCursor:async()=>null,issueCursor:async()=>null});
 const page=await repo.list({kind:'product',limit:1,category:'cars',storeId:null,cursor:null});assert.equal(page.ok,true,JSON.stringify(page));assert.equal(page.items[0].id,row.id);f.seed(c.privateRecords,'product_'+row.id,{...row,ownerUid:'owner',published:true,publicationRevision:1,publicProfile:{...row,title:'Different published content'}});assert.equal((await repo.list({kind:'product',limit:1,category:'cars',storeId:null,cursor:null})).ok,false);
});

test('guest HTTP/client composes existing repository: bounded pagination, withdrawal and foreign cursors',async()=>{
 const {createMarketplacePublicHttp}=await import('../../scripts/marketplace-public-http.mjs');
 const {createMarketplacePublicClient}=await import('../../features/marketplace/public-read-client.mjs');
 const {createIsolatedMarketplaceRepository,MARKETPLACE_TEST_SCHEMA:c}=await import('../../scripts/firebase-marketplace-repository.mjs');
 const f=fakeFirestoreSdk(),tokens=new Map();f.seed(c.actors,'owner',{uid:'owner',canWrite:true,suspended:false});f.seed(c.generations,'current',{value:1});
 for(const id of ['a','b']){const row={id,kind:'product',revision:1,title:'મૂળ हिन्दी Cafe\u0301',description:'Sample',category:'cars',locationLabel:'Sample',basePrice:1,isSold:false,storeId:null};f.seed(c.publicViews,'product_'+id,row);f.seed(c.privateRecords,'product_'+id,{id,kind:'product',ownerUid:'owner',published:true,publicationRevision:1,publicProfile:row,privateContact:'secret'});}
 const repo=createIsolatedMarketplaceRepository({enabled:true,firestore:f.db,sdk:f.sdk,schema:c,readCursor:key=>tokens.get(key),issueCursor:v=>{const k='cursor-'+tokens.size;tokens.set(k,v);return k;}});
 const http=createMarketplacePublicHttp({enabled:true,repository:repo,consumeRateLimit:()=>({allowed:true})});
 const client=createMarketplacePublicClient({enabled:true,sendRead:(op,body,ctx)=>http.handle(op,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},ctx)});
 const input={kind:'product',limit:1,category:'cars',storeId:null,cursor:null};const first=await client.list(input);assert.equal(first.ok,true);assert.equal(first.items[0].title,'મૂળ हिन्दी Cafe\u0301');assert.equal(JSON.stringify(first).includes('secret'),false);
 assert.equal((await client.list({...input,cursor:first.nextCursor})).items[0].id,'b');assert.equal((await client.list({...input,category:'',cursor:first.nextCursor})).code,'CURSOR_INVALID');
 assert.equal((await client.detail({kind:'product',id:'a'})).ok,true);f.seed(c.privateRecords,'product_a',{id:'a',kind:'product',ownerUid:'owner',published:false});assert.equal((await client.detail({kind:'product',id:'a'})).ok,false);
 f.seed(c.generations,'current',{value:2});assert.equal((await client.list({...input,cursor:first.nextCursor})).code,'CURSOR_INVALID');
});

test('public HTTP fails closed for rate enforcement, malformed scope, private fields and deadlines',async()=>{
 const {createMarketplacePublicHttp:make}=await import('../../scripts/marketplace-public-http.mjs');let reads=0;
 const input={kind:'store',limit:12,category:'',storeId:null,cursor:null},request=body=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),repository={list:()=>{reads++;return {ok:true,items:[],nextCursor:null,publicationEpoch:0};}};
 assert.equal((await make().handle('list',request(input))).status,503);
 assert.equal((await make({enabled:true,repository}).handle('list',request(input))).status,503);
 const options={enabled:true,repository,consumeRateLimit:()=>({allowed:false})};assert.equal((await make(options).handle('list',request(input))).status,429);assert.equal(reads,0);
 const http=make({...options,consumeRateLimit:()=>({allowed:true})});
 for(const bad of [{...input,limit:25},{...input,ownerUid:'private'},{...input,storeId:'foreign'},{...input,cursor:'x'.repeat(1025)}])assert.equal((await http.handle('list',request(bad))).status,400);
 assert.equal((await http.handle('list',{...request(input),method:'GET'})).status,405);assert.equal((await http.handle('list',request({large:'x'.repeat(4100)}))).status,413);
 assert.equal((await make({...options,consumeRateLimit:()=>({allowed:true}),repository:{list:()=>({ok:true,items:[],nextCursor:null,publicationEpoch:0,private:'secret'})}}).handle('list',request(input))).status,503);
 const result=await make({...options,timeoutMs:10,consumeRateLimit:()=>new Promise(()=>{})}).handle('list',request(input));assert.equal(result.status,504);
});

test('public client rejects contaminated DTO and late responses across existing Product session scope',async()=>{
 const {createMarketplacePublicClient:make}=await import('../../features/marketplace/public-read-client.mjs');const {createProductIntegration}=await import('../../features/marketplace/product-integration.mjs');
 const input={kind:'product',limit:12,category:'',storeId:null,cursor:null};assert.equal((await make().list(input)).ok,false);
 assert.equal((await make({enabled:true,sendRead:()=>({status:200,body:{ok:true,items:[],nextCursor:null,publicationEpoch:0,private:'secret'}})}).list(input)).ok,false);
 let release;const ports=make({enabled:true,sendRead:()=>new Promise(r=>release=r)}),ui=createProductIntegration({enabled:true,ports});ui.setSession({uid:'one',sessionId:'one'});const pending=ui.discover();await Promise.resolve();ui.setSession({uid:'two',sessionId:'two'});release({status:200,body:{ok:true,items:[],nextCursor:null,publicationEpoch:1}});await pending;assert.deepEqual(ui.snapshot().items,[]);assert.equal(ui.snapshot().statuses.list,undefined);
});
