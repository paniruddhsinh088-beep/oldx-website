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
