import test from 'node:test';import assert from 'node:assert/strict';
import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';
import {enquiryAcceptance,marketplaceAcceptance,photoAcceptance} from './durable-acceptance.mjs';
import {createIsolatedMarketplaceRepository} from '../../scripts/firebase-marketplace-repository.mjs';
import {createIsolatedProviderEnquiryRepository} from '../../scripts/firebase-provider-enquiry-repository.mjs';
import {createIsolatedPhotoReferenceRepository} from '../../scripts/firebase-photo-reference-repository.mjs';
for(const [name,run] of [['durable enquiry',enquiryAcceptance],['marketplace split and pagination',marketplaceAcceptance],['parent-scoped photo references',photoAcceptance]])test(name+' SDK mock acceptance',async()=>{const f=fakeFirestoreSdk();await run({sdk:f.sdk,db:f.db,seed:(...args)=>f.seed(...args),get:(...args)=>f.get(...args)});});
test('new SDK repositories default off and reject non-isolated configuration',async()=>{
 assert.equal((await createIsolatedMarketplaceRepository().save()).code,'UNAVAILABLE');assert.equal((await createIsolatedPhotoReferenceRepository().apply()).code,'UNAVAILABLE');for(const create of [createIsolatedMarketplaceRepository,createIsolatedProviderEnquiryRepository,createIsolatedPhotoReferenceRepository])assert.throws(()=>create({enabled:true,firestore:{app:{options:{projectId:'oldx-production'}},_getSettings:()=>({host:'firestore.googleapis.com',ssl:true})},sdk:{}}));
});
