import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';

const projectId = 'demo-oldx-storage';
const bucket = projectId + '.firebasestorage.app';
const rules = await readFile(new URL('./candidate.rules', import.meta.url), 'utf8');
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    storage: { rules, host: '127.0.0.1', port: 9199 }
  });
});

after(async () => {
  if (env) await env.cleanup();
});

function imageBlob(type = 'image/jpeg', size = 128) {
  return new Blob([new Uint8Array(size)], { type });
}

function upload(context, path, type = 'image/jpeg', size = 128, status = 'pending') {
  return context.storage().ref(path).put(imageBlob(type, size), {
    contentType: type,
    customMetadata: { moderationStatus: status }
  });
}

test('anonymous users cannot upload product photos', async () => {
  const anonymous = env.unauthenticatedContext();
  await assertFails(upload(anonymous, 'product-media/seller-a/product-1/photo.jpg'));
});

test('seller can upload a valid pending photo only to their own UID path', async () => {
  const seller = env.authenticatedContext('seller-a');
  await assertSucceeds(upload(seller, 'product-media/seller-a/product-1/photo.jpg'));
  await assertFails(upload(seller, 'product-media/seller-b/product-1/photo.jpg'));
});

test('uploads reject unsupported MIME types and files over the provisional size ceiling', async () => {
  const seller = env.authenticatedContext('seller-a');
  await assertFails(upload(seller, 'product-media/seller-a/product-1/photo.gif', 'image/gif'));
  await assertFails(upload(seller, 'product-media/seller-a/product-1/large.jpg', 'image/jpeg', 10 * 1024 * 1024));
});

test('pending photos cannot be read, while approved photos can be read', async () => {
  const seller = env.authenticatedContext('seller-a');
  await assertSucceeds(upload(seller, 'product-media/seller-a/product-2/pending.jpg'));
  await assertFails(seller.storage().ref('product-media/seller-a/product-2/pending.jpg').getDownloadURL());

  await env.withSecurityRulesDisabled(async context => {
    await context.storage().ref('product-media/seller-a/product-2/approved.jpg').put(imageBlob(), {
      contentType: 'image/jpeg',
      customMetadata: { moderationStatus: 'approved' }
    });
  });
  const anonymous = env.unauthenticatedContext();
  await assertSucceeds(anonymous.storage().ref('product-media/seller-a/product-2/approved.jpg').getDownloadURL());
});

test('seller can delete own pending photo but cannot delete approved or another seller photo', async () => {
  const seller = env.authenticatedContext('seller-a');
  await assertSucceeds(upload(seller, 'product-media/seller-a/product-3/pending.jpg'));
  await assertSucceeds(seller.storage().ref('product-media/seller-a/product-3/pending.jpg').delete());

  await env.withSecurityRulesDisabled(async context => {
    await context.storage().ref('product-media/seller-a/product-3/approved.jpg').put(imageBlob(), {
      contentType: 'image/jpeg',
      customMetadata: { moderationStatus: 'approved' }
    });
    await context.storage().ref('product-media/seller-b/product-3/pending.jpg').put(imageBlob(), {
      contentType: 'image/jpeg',
      customMetadata: { moderationStatus: 'pending' }
    });
  });
  await assertFails(seller.storage().ref('product-media/seller-a/product-3/approved.jpg').delete());
  await assertFails(seller.storage().ref('product-media/seller-b/product-3/pending.jpg').delete());
});

test('clients cannot overwrite an existing pending photo or approve it by changing metadata', async () => {
  const seller = env.authenticatedContext('seller-a');
  const path = 'product-media/seller-a/product-4/photo.jpg';
  await assertSucceeds(upload(seller, path));
  await assertFails(seller.storage().ref(path).put(imageBlob(), {
    contentType: 'image/jpeg',
    customMetadata: { moderationStatus: 'approved' }
  }));
  await assertFails(seller.storage().ref(path).updateMetadata({
    customMetadata: { moderationStatus: 'approved' }
  }));
});
