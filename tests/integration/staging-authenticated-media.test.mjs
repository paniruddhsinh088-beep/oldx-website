import test from 'node:test';import assert from 'node:assert/strict';
import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';
import {createStagingMarketplaceBinding} from '../../scripts/staging-marketplace-context.mjs';
import {createStagingAuthenticatedMedia} from '../../scripts/staging-authenticated-media.mjs';
import {exerciseAuthenticatedMedia} from './authenticated-media-cases.mjs';
test('verified media preflight composes native reserve/attempt/proof, rate, retry and leased delete (SDK double)',async()=>{
 const f=fakeFirestoreSdk(),db={projectId:'oldx-staging',collection:name=>({doc:id=>f.sdk.doc(f.db,name,id)}),runTransaction:(work,opts)=>f.sdk.runTransaction(f.db,tx=>work({get:async ref=>{const s=await tx.get(ref);return {exists:s.exists(),data:s.data};},set:(...args)=>tx.set(...args),delete:(...args)=>tx.delete(...args)}),opts)};
 const binding=createStagingMarketplaceBinding({projectId:'oldx-staging',deploymentEnvironment:'preview',adminFirestore:db,FieldValue:{serverTimestamp:f.sdk.serverTimestamp}});
 await exerciseAuthenticatedMedia({binding,seed:async(...args)=>f.seed(...args),read:async(...args)=>f.get(...args),verifyFirebaseToken:async(token,ctx)=>{assert.equal(ctx.checkRevoked,true);return {uid:token.startsWith('owner.')?'owner':'other'};}});
});
test('authenticated media composition defaults off before reading any binding or credential',async()=>{
 const port=createStagingAuthenticatedMedia({verifyFirebaseToken:()=>assert.fail('auth')});assert.equal((await port.upload({},new Uint8Array())).status,503);assert.equal((await port.command('remove',{})).status,503);
});
