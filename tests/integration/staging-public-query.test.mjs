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
