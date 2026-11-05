import test from 'node:test';import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';import {createStagingMarketplaceBinding} from '../../scripts/staging-marketplace-context.mjs';import {exercisePhotoLifecycle} from './photo-lifecycle-cases.mjs';
test('Product/Store atomic draft photos, public approval/replacement/withdrawal and delete lifecycle (SDK double)',async()=>{
 const f=fakeFirestoreSdk(),db={projectId:'oldx-staging',collection:n=>({doc:id=>f.sdk.doc(f.db,n,id)}),runTransaction:(fn,o)=>f.sdk.runTransaction(f.db,tx=>fn({get:async r=>{const s=await tx.get(r);return {exists:s.exists(),data:s.data};},set:(...a)=>tx.set(...a),delete:(...a)=>tx.delete(...a)}),o)};
 const binding=createStagingMarketplaceBinding({projectId:'oldx-staging',deploymentEnvironment:'preview',adminFirestore:db,FieldValue:{serverTimestamp:f.sdk.serverTimestamp}});await exercisePhotoLifecycle({binding,seed:async(...a)=>f.seed(...a),read:async(...a)=>f.get(...a)});
});
