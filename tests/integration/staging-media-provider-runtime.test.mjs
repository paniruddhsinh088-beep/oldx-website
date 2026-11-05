import test from 'node:test';import assert from 'node:assert/strict';
import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';
import {createStagingMarketplaceBinding} from '../../scripts/staging-marketplace-context.mjs';
import {createStagingMediaProviderRuntime} from '../../scripts/staging-media-provider-runtime.mjs';
import {exerciseNativeMediaProofs} from './media-provider-runtime-cases.mjs';
test('durable native proof runtime: restarted receipts, one dispatch, reconciliation, owner/revision, delete leases and quotas (SDK double)',async()=>{
 const f=fakeFirestoreSdk(),db={projectId:'oldx-staging',collection:name=>({doc:id=>f.sdk.doc(f.db,name,id)}),runTransaction:(work,opts)=>f.sdk.runTransaction(f.db,tx=>work({get:async ref=>{const s=await tx.get(ref);return {exists:s.exists(),data:s.data};},set:(...args)=>tx.set(...args),delete:(...args)=>tx.delete(...args)}),opts)};
 const binding=createStagingMarketplaceBinding({projectId:'oldx-staging',deploymentEnvironment:'preview',adminFirestore:db,FieldValue:{serverTimestamp:f.sdk.serverTimestamp}});
 await exerciseNativeMediaProofs({binding,seed:async(...args)=>f.seed(...args),read:async(...args)=>f.get(...args)});
});
test('provider runtime default-off never authenticates or dispatches',async()=>{const r=createStagingMediaProviderRuntime({authenticate:()=>assert.fail('auth')});assert.equal((await r.upload({},new Uint8Array())).code,'UNAVAILABLE');});
