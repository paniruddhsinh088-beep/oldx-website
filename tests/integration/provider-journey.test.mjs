import test from 'node:test';import {fakeFirestoreSdk} from './fake-firestore-sdk.mjs';import {providerJourneyAcceptance} from './provider-journey-acceptance.mjs';
test('Provider existing owner/public/buyer/private inbox reply journey through SDK and verified HTTP',async()=>{const f=fakeFirestoreSdk();await providerJourneyAcceptance({sdk:f.sdk,db:f.db,seed:(...a)=>f.seed(...a)});});
