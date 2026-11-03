import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp, updateDoc, query, where, limit } from 'firebase/firestore';

let env;
before(async () => {
  const rules = await readFile(new URL('./service-providers-candidate.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({
    projectId: 'demo-oldx-service-providers',
    firestore: { rules }
  });
  await env.withSecurityRulesDisabled(async context => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, 'serviceProviders/active'), { status: 'active', displayName: 'Sample', cityId: 'ahmedabad', serviceIds: ['carpentry', 'repairs'] });
    await setDoc(doc(firestore, 'serviceProviders/pending'), { status: 'pending' });
    await setDoc(doc(firestore, 'serviceProviderReviews/published'), { status: 'published', rating: 5 });
    await setDoc(doc(firestore, 'serviceProviderReviews/hidden'), { status: 'hidden', rating: 1 });
    await setDoc(doc(firestore, 'serviceProviderPrivate/active'), { phoneE164: '+911234567890' });
    await setDoc(doc(firestore, 'serviceProviderAudit/event'), { action: 'review' });
  });
});
after(async () => { await env?.cleanup(); });

test('public may get only active provider and published review', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'serviceProviders/active')));
  await assertFails(getDoc(doc(db, 'serviceProviders/pending')));
  await assertSucceeds(getDoc(doc(db, 'serviceProviderReviews/published')));
  await assertFails(getDoc(doc(db, 'serviceProviderReviews/hidden')));
});
test('private contact and audit data stay inaccessible even to owner-like client', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('active').firestore()]) {
    await assertFails(getDoc(doc(db, 'serviceProviderPrivate/active')));
    await assertFails(getDoc(doc(db, 'serviceProviderAudit/event')));
  }
});
test('no client can self-approve profiles or publish reviews', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('active', { admin: true }).firestore()]) {
    await assertFails(setDoc(doc(db, 'serviceProviders/active'), { status: 'active', ratingCount: 999 }));
    await assertFails(setDoc(doc(db, 'serviceProviderReviews/new'), { status: 'published', rating: 5 }));
  }
});
test('legacy product access remains denied in isolated candidate', async () => {
  const db = env.authenticatedContext('seller').firestore();
  await assertFails(getDoc(doc(db, 'products/old')));
});

test('unfiltered collection enumeration is denied to unauthenticated and authenticated clients', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('active').firestore()]) {
    await assertFails(getDocs(collection(db, 'serviceProviders')));
    await assertFails(getDocs(collection(db, 'serviceProviderReviews')));
  }
});
test('client cannot delete public profile or review', async () => {
  const db = env.authenticatedContext('active').firestore();
  await assertFails(deleteDoc(doc(db, 'serviceProviders/active')));
  await assertFails(deleteDoc(doc(db, 'serviceProviderReviews/published')));
});

test('client cannot create or overwrite private contact and audit records', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('active').firestore()]) {
    await assertFails(setDoc(doc(db, 'serviceProviderPrivate/active'), {
      phoneE164: '+911234567890', allowPublicPhone: true
    }));
    await assertFails(setDoc(doc(db, 'serviceProviderAudit/new'), { action: 'forged' }));
  }
});
test('client cannot change moderation state on existing review', async () => {
  const db = env.authenticatedContext('active', { admin: true }).firestore();
  await assertFails(setDoc(doc(db, 'serviceProviderReviews/hidden'), {
    status: 'published', rating: 5
  }));
});

test('authenticated provider may create only their own pending profile', async () => {
  const db = env.authenticatedContext('new-provider').firestore();
  await assertSucceeds(setDoc(doc(db, 'serviceProviders/new-provider'), {
    ownerUid: 'new-provider', displayName: 'Local Painter',
    serviceIds: ['painting', 'repairs'], cityId: 'ahmedabad',
    status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(db, 'serviceProviders/someone-else'), {
    ownerUid: 'someone-else', displayName: 'Imposter',
    serviceIds: ['painting'], cityId: 'ahmedabad',
    status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
});
test('provider may edit own public draft but not approval status', async () => {
  const db = env.authenticatedContext('new-provider').firestore();
  await assertSucceeds(updateDoc(doc(db, 'serviceProviders/new-provider'), {
    displayName: 'Local Painter Updated', updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(doc(db, 'serviceProviders/new-provider'), {
    status: 'active', updatedAt: serverTimestamp()
  }));
});

test('pending profile is visible to owner but not to other authenticated users', async () => {
  await assertSucceeds(getDoc(doc(env.authenticatedContext('new-provider').firestore(), 'serviceProviders/new-provider')));
  await assertFails(getDoc(doc(env.authenticatedContext('stranger').firestore(), 'serviceProviders/new-provider')));
});
test('other users cannot edit provider draft', async () => {
  const db = env.authenticatedContext('stranger').firestore();
  await assertFails(updateDoc(doc(db, 'serviceProviders/new-provider'), {
    displayName: 'Tampered', updatedAt: serverTimestamp()
  }));
});
test('provider cannot change ownership or add privileged fields', async () => {
  const db = env.authenticatedContext('new-provider').firestore();
  await assertFails(updateDoc(doc(db, 'serviceProviders/new-provider'), {
    ownerUid: 'stranger', updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(doc(db, 'serviceProviders/new-provider'), {
    ratingCount: 500, updatedAt: serverTimestamp()
  }));
});
test('profile creation rejects excessive and duplicate service selections', async () => {
  const db = env.authenticatedContext('invalid-provider').firestore();
  const base = {
    ownerUid: 'invalid-provider', displayName: 'Invalid Services',
    cityId: 'ahmedabad', status: 'pending',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  };
  await assertFails(setDoc(doc(db, 'serviceProviders/invalid-provider'), {
    ...base, serviceIds: ['painting', 'painting']
  }));
  await assertFails(setDoc(doc(db, 'serviceProviders/invalid-provider'), {
    ...base, serviceIds: Array.from({ length: 9 }, (_, i) => 'service' + i)
  }));
});

test('new profile must use server timestamps and pending status', async () => {
  const db = env.authenticatedContext('timestamp-check').firestore();
  const base = {
    ownerUid: 'timestamp-check', displayName: 'Repair Service',
    serviceIds: ['repairs'], cityId: 'ahmedabad'
  };
  await assertFails(setDoc(doc(db, 'serviceProviders/timestamp-check'), {
    ...base, status: 'active',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(db, 'serviceProviders/timestamp-check'), {
    ...base, status: 'pending',
    createdAt: new Date('2020-01-01'), updatedAt: serverTimestamp()
  }));
});
test('provider cannot alter creation timestamp or delete their profile', async () => {
  const db = env.authenticatedContext('new-provider').firestore();
  await assertFails(updateDoc(doc(db, 'serviceProviders/new-provider'), {
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertFails(deleteDoc(doc(db, 'serviceProviders/new-provider')));
});

test('public discovery permits only bounded active-provider queries', async () => {
  const db = env.unauthenticatedContext().firestore();
  const providers = collection(db, 'serviceProviders');
  const active = await assertSucceeds(getDocs(query(providers, where('status', '==', 'active'), limit(20))));
  assert.equal(active.size, 1);
  await assertFails(getDocs(query(providers, where('status', '==', 'pending'), limit(20))));
  await assertFails(getDocs(query(providers, where('status', '==', 'active'), limit(21))));
  await assertFails(getDocs(query(providers, where('status', '==', 'active'))));
});

test('city and service filtering stays restricted to active providers', async () => {
  const db = env.unauthenticatedContext().firestore();
  const providers = collection(db, 'serviceProviders');
  const city = await assertSucceeds(getDocs(query(providers,
    where('status', '==', 'active'), where('cityId', '==', 'ahmedabad'), limit(20))));
  assert.equal(city.size, 1);
  const service = await assertSucceeds(getDocs(query(providers,
    where('status', '==', 'active'), where('serviceIds', 'array-contains', 'carpentry'), limit(20))));
  assert.equal(service.size, 1);
  await assertFails(getDocs(query(providers,
    where('cityId', '==', 'ahmedabad'), limit(20))));
  await assertFails(getDocs(query(providers,
    where('status', '==', 'pending'), where('cityId', '==', 'ahmedabad'), limit(20))));
});

test('profile rejects non-text service IDs', async () => {
  const db = env.authenticatedContext('typed-service-check').firestore();
  const base = {
    ownerUid: 'typed-service-check', displayName: 'Local Service',
    cityId: 'ahmedabad', status: 'pending',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  };
  await assertFails(setDoc(doc(db, 'serviceProviders/typed-service-check'), {
    ...base, serviceIds: ['painting', 123]
  }));
  await assertFails(setDoc(doc(db, 'serviceProviders/typed-service-check'), {
    ...base, serviceIds: [{ category: 'painting' }]
  }));
});

test('provider profile rejects invalid service and city identifiers', async () => {
  const db = env.authenticatedContext('identifier-check').firestore();
  const base = {
    ownerUid: 'identifier-check', displayName: 'Repair Shop',
    status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  };
  await assertFails(setDoc(doc(db, 'serviceProviders/identifier-check'), {
    ...base, cityId: 'ahmedabad', serviceIds: ['Invalid Service']
  }));
  await assertFails(setDoc(doc(db, 'serviceProviders/identifier-check'), {
    ...base, cityId: 'Ahmedabad City', serviceIds: ['repairs']
  }));
});

// Actual modular SDK transactions against the existing isolated demo emulator.
// Candidate collection names below are test fixtures, not an approved schema.
test('isolated SDK Provider draft/publication transactions persist atomically without enabling client access',async()=>{
 const sdk=await import('firebase/firestore');
 const {createIsolatedFirebaseProviderRepository}=await import('../../scripts/firebase-provider-repository.mjs');
 const {createProviderDraftTransaction}=await import('../../scripts/provider-draft-transaction.mjs');
 const {createProviderPublicationTransaction}=await import('../../scripts/provider-publication-transaction.mjs');
 const schema=Object.fromEntries(['actors','owners','identities','drafts','receipts','audits','permissions','publications','publicViews','generations'].map(k=>[k,'testProvider'+k[0].toUpperCase()+k.slice(1)]));
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await sdk.setDoc(sdk.doc(db,schema.actors,'sdk-owner'),{uid:'sdk-owner',canWrite:true,suspended:false});
  await sdk.setDoc(sdk.doc(db,schema.permissions,'sdk-owner'),{uid:'sdk-owner',canPublish:true,canWithdraw:true,suspended:false});
  await sdk.setDoc(sdk.doc(db,schema.generations,'current'),{value:0});
  const repository=createIsolatedFirebaseProviderRepository({enabled:true,firestore:db,sdk,schema});
  const authenticate=()=>({uid:'sdk-owner'}),draft=createProviderDraftTransaction({enabled:true,authenticate,repository,providerIdForActor:()=> 'sdk-provider'});
  const profile={displayName:'SDK sample',city:'Sample City',serviceArea:'Sample area',services:['Plumber'],available:true,experienceYears:null,description:'Sample only',languages:['en']};
  const input={requestId:'sdk-draft',expectedRevision:0,profile};
  const results=await Promise.all([draft.save(input),draft.save(input)]);assert.equal(results.filter(r=>r.status==='saved').length,1);assert.equal(results.filter(r=>r.status==='replayed').length,1);
  const privateDoc=await sdk.getDoc(sdk.doc(db,schema.drafts,'sdk-provider'));assert.equal(privateDoc.data().revision,1);assert.equal(privateDoc.data().profile.experienceYears,null);assert.ok(privateDoc.data().committedAt);
  const publication=createProviderPublicationTransaction({enabled:true,authenticate,repository,catalog:{services:['Plumber'],localities:[{city:'Sample City',serviceArea:'Sample area'}]}});
  const publish={requestId:'sdk-publish',expectedRevision:1,expectedGeneration:0,action:'publish'};
  assert.equal((await publication.execute(publish)).generation,1);
  const view=await sdk.getDoc(sdk.doc(db,schema.publicViews,'sdk-provider'));assert.equal(view.data().displayName,'SDK sample');assert.equal(Object.hasOwn(view.data(),'ownerUid'),false);assert.equal(Object.hasOwn(view.data(),'committedAt'),false);
  assert.equal((await publication.execute(publish)).status,'replayed');
  assert.equal((await publication.execute({requestId:'sdk-withdraw',expectedRevision:1,expectedGeneration:1,action:'withdraw'})).generation,2);
  assert.equal((await sdk.getDoc(sdk.doc(db,schema.publicViews,'sdk-provider'))).exists(),false);
  assert.equal((await sdk.getDoc(sdk.doc(db,schema.generations,'current'))).data().value,2);
  assert.equal((await sdk.getDocs(sdk.collection(db,schema.audits))).size,3);
 });
 const guest=env.unauthenticatedContext().firestore();await assertFails(sdk.getDoc(sdk.doc(guest,schema.drafts,'sdk-provider')));await assertFails(sdk.getDoc(sdk.doc(guest,schema.publicViews,'sdk-provider')));
});

test('actual SDK public read barrier bridges row versions, pagination, HTTP composition and withdrawal',async()=>{
 const sdk=await import('firebase/firestore');const {createIsolatedFirebaseProviderRepository}=await import('../../scripts/firebase-provider-repository.mjs');const {createIsolatedProviderPublicRead}=await import('../../scripts/firebase-provider-public-read.mjs');const {createProviderHttpComposition}=await import('../../scripts/provider-http-composition.mjs');const {createPublicProviderRepository}=await import('../../features/service-providers/provider-discovery.mjs');
 const schema=Object.fromEntries(['actors','owners','identities','drafts','receipts','audits','permissions','publications','publicViews','generations'].map(k=>[k,'testProvider'+k[0].toUpperCase()+k.slice(1)+'Read']));const catalog={services:['Plumber'],localities:[{city:'Sample City',serviceArea:'Sample area'}]};
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await sdk.setDoc(sdk.doc(db,schema.generations,'current'),{value:0});const repository=createIsolatedFirebaseProviderRepository({enabled:true,firestore:db,sdk,schema});const commands={};
  for(const [uid,providerId,generation] of [['read-one','read-p1',0],['read-two','read-p2',1]]){
   await sdk.setDoc(sdk.doc(db,schema.actors,uid),{uid,canWrite:true,suspended:false});await sdk.setDoc(sdk.doc(db,schema.permissions,uid),{uid,canPublish:true,canWithdraw:true,suspended:false});
   commands[uid]=createProviderHttpComposition({enabled:true,verifyFirebaseToken:()=>({uid}),resolveProviderRole:()=>({uid,role:'provider',active:true}),consumeRateLimit:()=>({allowed:true,retryAfterSeconds:0}),draft:{repository,providerIdForActor:()=>providerId},publication:{repository,catalog}});
   const request=body=>({method:'POST',headers:{authorization:'Bearer isolated.test.token','content-type':'application/json'},body:JSON.stringify(body)});commands[uid]={http:commands[uid],request};
   assert.equal((await commands[uid].http.handle('draft.save',request({requestId:'draft',expectedRevision:0,profile:{displayName:providerId,city:'Sample City',serviceArea:'Sample area',services:['Plumber'],description:'Sample only',available:true,experienceYears:2,languages:['en']}}))).status,200);
   assert.equal((await commands[uid].http.handle('publication.manage',request({requestId:'publish',expectedRevision:1,expectedGeneration:generation,action:'publish'}))).status,200);
  }
  const bridge=createIsolatedProviderPublicRead({enabled:true,firestore:db,sdk,schema,catalog}),tokens=new Map();let sequence=0;const read=createPublicProviderRepository({enabled:true,catalog,...bridge,readCursor:t=>tokens.get(t),issueCursor:s=>{const token='isolated_'+(++sequence);tokens.set(token,s);return token;}}),filter={category:'',locality:'',limit:1,cursor:null};
  const first=await read.discover(filter);assert.equal(first.ok,true);assert.deepEqual(first.items.map(p=>p.id),['read-p1']);assert.equal(first.publicationEpoch,2);const second=await read.discover({...filter,cursor:first.nextCursor});assert.deepEqual(second.items.map(p=>p.id),['read-p2']);assert.equal((await read.detail({providerId:'read-p1',expectedGeneration:2})).ok,true);
  const response=await commands['read-one'].http.handle('publication.manage',commands['read-one'].request({requestId:'withdraw',expectedRevision:1,expectedGeneration:2,action:'withdraw'}));assert.equal(response.status,200);assert.equal((await read.discover({...filter,cursor:first.nextCursor})).ok,false);const fresh=await read.discover(filter);assert.equal(fresh.ok,true);assert.deepEqual(fresh.items.map(p=>p.id),['read-p2']);assert.equal(fresh.publicationEpoch,3);assert.equal((await read.detail({providerId:'read-p1',expectedGeneration:null})).ok,false);
 });
});

test('versioned owner bootstrap reconciles actual SDK private writes and historical publication receipts',async()=>{
 const sdk=await import('firebase/firestore');const {createIsolatedFirebaseProviderRepository}=await import('../../scripts/firebase-provider-repository.mjs');const {createProviderV1Integration,PROVIDER_V1_TEST_SCHEMA:schema}=await import('../../scripts/provider-schema-v1.mjs');
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore(),uid='bootstrap-owner';await sdk.setDoc(sdk.doc(db,schema.actors,uid),{uid,canWrite:true,suspended:false});await sdk.setDoc(sdk.doc(db,schema.permissions,uid),{uid,canPublish:true,canWithdraw:true,suspended:false});await sdk.setDoc(sdk.doc(db,schema.generations,'current'),{value:0});
  const repository=createIsolatedFirebaseProviderRepository({enabled:true,firestore:db,sdk,schema});let allocated=0;const owner=createProviderV1Integration({enabled:true,authenticate:()=>({uid}),repository,catalog:{version:1,stateCode:'GJ',services:['Plumber','Repair'],localities:[{city:'Ahmedabad',serviceArea:'Sample area'}]},randomId:()=> 'sdk-candidate-'+(++allocated)});
  const initial=await owner.bootstrap({operation:null,requestId:null});assert.equal(initial.exists,false);assert.equal(allocated,0);
  const profile={displayName:'SDK bootstrap sample',city:'Ahmedabad',serviceArea:'Sample area',services:['Plumber','Repair'],description:'Owner-private draft',experienceYears:null,available:true,languages:['gu','hi','en']},request={requestId:'create',expectedRevision:0,profile};
  const outcomes=await Promise.all([owner.saveDraft(request),owner.saveDraft(request)]);assert.equal(outcomes.filter(r=>r.status==='saved').length,1);assert.equal(outcomes.filter(r=>r.status==='replayed').length,1);assert.equal(outcomes[0].providerId,outcomes[1].providerId);assert.equal((await owner.saveDraft({...request,requestId:'update',expectedRevision:1})).revision,2);
  const recovered=await owner.bootstrap({operation:'draft.save',requestId:'create'});assert.equal(recovered.revision,2);assert.equal(recovered.receipt.revision,1);assert.equal(recovered.receipt.status,'committed');assert.deepEqual(recovered.draft.services,['Plumber','Repair']);assert.equal(Object.hasOwn(recovered,'ownerUid'),false);assert.equal(JSON.stringify(recovered).includes('fingerprint'),false);
  assert.equal((await owner.managePublication({requestId:'publish',expectedRevision:2,expectedGeneration:0,action:'publish'})).ok,true);assert.equal((await owner.managePublication({requestId:'withdraw',expectedRevision:2,expectedGeneration:1,action:'withdraw'})).ok,true);
  const withdrawn=await owner.bootstrap({operation:'publication.manage',requestId:'publish'});assert.equal(withdrawn.published,false);assert.equal(withdrawn.receipt.action,'publish');assert.equal(withdrawn.receipt.status,'committed');assert.equal(withdrawn.generation,2);assert.equal((await owner.bootstrap({operation:'draft.save',requestId:'not-present'})).receipt.status,'unknown');
  assert.equal((await sdk.getDoc(sdk.doc(db,schema.publicViews,withdrawn.providerId))).exists(),false);assert.equal((await sdk.getDocs(sdk.collection(db,schema.owners))).size,1);
  const {createProviderHttpComposition}=await import('../../scripts/provider-http-composition.mjs');
  const http=createProviderHttpComposition({enabled:true,verifyFirebaseToken:()=>({uid}),resolveProviderRole:()=>({uid,role:'provider',active:true}),consumeRateLimit:()=>({allowed:true,retryAfterSeconds:0}),bootstrap:{repository}});
  const response=await http.handle('owner.bootstrap',{method:'POST',headers:{authorization:'Bearer isolated.test.token','content-type':'application/json'},body:JSON.stringify({operation:'draft.save',requestId:'create'})});
  assert.equal(response.status,200);assert.match(response.headers['Cache-Control'],/no-store/);assert.equal(response.body.draft.description,'Owner-private draft');assert.equal(response.body.receipt.revision,1);assert.equal(response.body.revision,2);assert.equal(response.body.published,false);assert.equal(Object.hasOwn(response.body,'ownerUid'),false);

 });
 const guest=env.unauthenticatedContext().firestore();await assertFails(sdk.getDoc(sdk.doc(guest,schema.owners,'bootstrap-owner')));
});

for (const [name,exportName] of [['durable enquiry authorization and cancellation','enquiryAcceptance'],['trusted Product Store writes and pagination','marketplaceAcceptance'],['durable private photo parent references','photoAcceptance']]) {
 test('actual Firestore SDK '+name,async()=>{
  const sdk=await import('firebase/firestore'),scenarios=await import('../integration/durable-acceptance.mjs');
  await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await scenarios[exportName]({sdk,db,actualTransactions:true,seed:(collection,id,value)=>sdk.setDoc(sdk.doc(db,collection,id),value),get:async(collection,id)=>{const snapshot=await sdk.getDoc(sdk.doc(db,collection,id));return snapshot.exists()?snapshot.data():null;}});});
  const guest=env.unauthenticatedContext().firestore();
  for(const [collection,id] of [['testOldxEnquiryEnquiries','durable-enquiry'],['testOldxMarketPrivateRecords','store_market-1'],['testOldxPhotoAssets','photo-image-1234567890123'],['testOldxMarketPublicViews','product_market-2']])await assertFails(sdk.getDoc(sdk.doc(guest,collection,id)));
 });
}

test('actual SDK durable media journal quota retry reconciliation and trusted public projection',async()=>{
 const sdk=await import('firebase/firestore');const {durableMediaAcceptance}=await import('../integration/durable-media-acceptance.mjs');
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await durableMediaAcceptance({sdk,db,seed:(collection,id,value)=>sdk.setDoc(sdk.doc(db,collection,id),value),get:async(collection,id)=>{const snapshot=await sdk.getDoc(sdk.doc(db,collection,id));return snapshot.exists()?snapshot.data():null;}});});
 const guest=env.unauthenticatedContext().firestore();await assertFails(sdk.getDoc(sdk.doc(guest,'testOldxMediaQuotas','global')));
});

test('actual SDK independent media moderation atomic publish private replacement revoke and withdrawal',async()=>{
 const sdk=await import('firebase/firestore'),{mediaReleaseAcceptance}=await import('../integration/media-release-acceptance.mjs');
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await mediaReleaseAcceptance({sdk,db,seed:(collection,id,value)=>sdk.setDoc(sdk.doc(db,collection,id),value),get:async(collection,id)=>{const snapshot=await sdk.getDoc(sdk.doc(db,collection,id));return snapshot.exists()?snapshot.data():null;}});});
 const guest=env.unauthenticatedContext().firestore();await assertFails(sdk.getDoc(sdk.doc(guest,'testOldxMediaReleasePermissions','release-moderator')));
});

 test('actual SDK Product create publish discover private enquiry seller response and withdrawal',async()=>{
 const sdk=await import('firebase/firestore'),{productConversationAcceptance}=await import('../integration/product-conversation-acceptance.mjs');
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await productConversationAcceptance({sdk,db,seed:(collection,id,value)=>sdk.setDoc(sdk.doc(db,collection,id),value),get:async(collection,id)=>{const s=await sdk.getDoc(sdk.doc(db,collection,id));return s.exists()?s.data():null;}});});
 const guest=env.unauthenticatedContext().firestore();for(const collection of ['testOldxProductChatThreads','testOldxProductChatMessages','testOldxProductChatReceipts','testOldxProductJourneyPrivateRecords'])await assertFails(sdk.getDoc(sdk.doc(guest,collection,'sample')));
 });

test('repeat forced-overlap Service enquiry transaction concurrency in independent namespaces',async()=>{
 const sdk=await import('firebase/firestore'),{enquiryAcceptance}=await import('../integration/durable-acceptance.mjs');
 for(const namespace of ['RaceOne','RaceTwo','RaceTri'])await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await enquiryAcceptance({sdk,db,actualTransactions:true,namespace,seed:(c,id,v)=>sdk.setDoc(sdk.doc(db,c,id),v),get:async(c,id)=>{const s=await sdk.getDoc(sdk.doc(db,c,id));return s.exists()?s.data():null;}});});
});

test('actual SDK Product owner recovery receipt snapshots scoped inbox and private history restoration',async()=>{
 const sdk=await import('firebase/firestore'),{productRecoveryAcceptance}=await import('../integration/product-recovery-acceptance.mjs');
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await productRecoveryAcceptance({sdk,db,seed:(c,id,v)=>sdk.setDoc(sdk.doc(db,c,id),v),get:async(c,id)=>{const s=await sdk.getDoc(sdk.doc(db,c,id));return s.exists()?s.data():null;}});});
 const guest=env.unauthenticatedContext().firestore();await assertFails(sdk.getDoc(sdk.doc(guest,'testOldxRecoveryMarketprivateRecords','product_recover-1')));
});

test('actual SDK Store existing-UI owner recovery publication catalogue and withdrawal',async()=>{
 const sdk=await import('firebase/firestore'),{storeUiAcceptance}=await import('../integration/store-ui-acceptance.mjs');
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await storeUiAcceptance({sdk,db,seed:(c,id,v)=>sdk.setDoc(sdk.doc(db,c,id),v)});});
});

test('actual SDK Provider owner multi-service discovery buyer enquiry inbox reply and private history',async()=>{
 const sdk=await import('firebase/firestore'),{providerJourneyAcceptance}=await import('../integration/provider-journey-acceptance.mjs');await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await providerJourneyAcceptance({sdk,db,seed:(c,id,v)=>sdk.setDoc(sdk.doc(db,c,id),v)});});const guest=env.unauthenticatedContext().firestore();await assertFails(sdk.getDoc(sdk.doc(guest,'testOldxProviderJourneyhistory','private-event')));
});

test('actual SDK Service two-way messages unknown acknowledgement replay participants and withdrawal',async()=>{const sdk=await import('firebase/firestore'),{serviceConversationAcceptance}=await import('../integration/service-conversation-acceptance.mjs');await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await serviceConversationAcceptance({sdk,db,seed:(c,id,v)=>sdk.setDoc(sdk.doc(db,c,id),v)});});const guest=env.unauthenticatedContext().firestore();for(const c of ['Threads','Messages','Receipts','Audits'])await assertFails(sdk.getDoc(sdk.doc(guest,'testOldxServiceChat'+c,'private-message')));});

test('repeat forced-overlap Service message duplicate sends in independent namespaces',async()=>{const sdk=await import('firebase/firestore'),{serviceConversationAcceptance}=await import('../integration/service-conversation-acceptance.mjs');for(let n=0;n<3;n++)await env.withSecurityRulesDisabled(async context=>{const db=context.firestore(),conversationSchema=Object.fromEntries(['threads','messages','receipts','audits'].map(k=>[k,'testOldxServiceRace'+n+k]));await serviceConversationAcceptance({sdk,db,forceOverlap:true,namespace:'ChatRace'+n,conversationSchema,seed:(c,id,v)=>sdk.setDoc(sdk.doc(db,c,id),v)});});});
