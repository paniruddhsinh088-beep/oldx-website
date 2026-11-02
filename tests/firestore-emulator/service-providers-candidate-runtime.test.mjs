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
  const profile={displayName:'SDK sample',city:'Sample City',serviceArea:'Sample area',services:['Plumber'],available:true,experienceYears:2,description:'Sample only',languages:['en']};
  const input={requestId:'sdk-draft',expectedRevision:0,profile};
  const results=await Promise.all([draft.save(input),draft.save(input)]);assert.equal(results.filter(r=>r.status==='saved').length,1);assert.equal(results.filter(r=>r.status==='replayed').length,1);
  const privateDoc=await sdk.getDoc(sdk.doc(db,schema.drafts,'sdk-provider'));assert.equal(privateDoc.data().revision,1);assert.ok(privateDoc.data().committedAt);
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
