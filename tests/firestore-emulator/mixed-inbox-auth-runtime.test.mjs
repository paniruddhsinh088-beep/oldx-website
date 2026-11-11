import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp as webApp, deleteApp as deleteWebApp } from 'firebase/app';
import { connectAuthEmulator, getAuth as webAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as sdk from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createEmulatorMarketplaceEnforcement } from '../../scripts/provider-enforcement-adapters.mjs';
import { mixedInboxHandlersAcceptance } from '../integration/mixed-inbox-handlers-cases.mjs';

test('REAL mixed Inbox: pagination, deletion, signed reads and privacy reconciliation', { timeout: 90_000 }, async () => {
  const projectId = 'demo-oldx-admin-runtime';
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9098');
  const env = await initializeTestEnvironment({ projectId });
  const admin = initializeApp({ projectId }, 'mixed-inbox-admin');
  const client = webApp({ projectId, apiKey: 'fake-key' }, 'mixed-inbox-client');
  try {
    const auth = webAuth(client), adminAuth = getAuth(admin);
    connectAuthEmulator(auth, 'http://127.0.0.1:9098', { disableWarnings: true });
    const credentials = new Map(), password = 'isolated-inbox-password';
    for (const uid of ['journey-buyer', 'seller', 'journey-provider', 'mixed-outsider']) {
      const email = uid + '@mixed-inbox.example.test';
      await adminAuth.createUser({ uid, email, password });
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      credentials.set(uid, await user.getIdToken());
    }
    const { verifyFirebaseToken } = createEmulatorMarketplaceEnforcement({ enabled: true, adminAuth });
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()._delegate;
      await mixedInboxHandlersAcceptance({ sdk, db, credentials, verifyFirebaseToken,
        seed: (collection, id, value) => sdk.setDoc(sdk.doc(db, collection, id), value) });
    });
  } finally {
    await Promise.all([deleteWebApp(client), deleteApp(admin), env.cleanup()]);
  }
});
