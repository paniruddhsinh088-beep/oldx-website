import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

let env;
before(async () => {
  const rules = await readFile(new URL('./service-providers-candidate.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({
    projectId: 'demo-oldx-service-providers',
    firestore: { rules }
  });
  await env.withSecurityRulesDisabled(async ({ firestore }) => {
    await setDoc(doc(firestore, 'serviceProviders/active'), { status: 'active', displayName: 'Sample' });
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

test('collection enumeration is denied to unauthenticated and authenticated clients', async () => {
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
