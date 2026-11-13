// OLDX Phase B — offline, schema-only Firestore REST typed document preview.
// No network/credentials/imports that can touch Firebase. This is not a seeder.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

export const ACTOR_PATH = 'marketplaceActors_v1/synthetic-seller-a';
export const PRODUCT_PATH = 'marketplacePrivate_v1/product_synthetic-phase-b-read-01';

export const actor = Object.freeze({
  uid: 'synthetic-seller-a',
  canWrite: true,
  suspended: false,
});

export const privateProduct = Object.freeze({
  id: 'synthetic-phase-b-read-01',
  kind: 'product',
  ownerUid: 'synthetic-seller-a',
  revision: 1,
  archived: false,
  published: false,
  publicationRevision: 0,
  publicProfile: null,
  profile: {
    title: 'Synthetic Product',
    description: 'Fictional staging-only listing',
    category: 'cars',
    locationLabel: 'Synthetic location',
    basePrice: 100,
    isSold: false,
    storeId: null,
    photos: [],
  },
});

function typed(value) {
  if (value === null) return {nullValue: null};
  if (typeof value === 'string') return {stringValue: value};
  if (typeof value === 'boolean') return {booleanValue: value};
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('Noninteger numeric field blocked');
    return {integerValue: String(value)};
  }
  if (Array.isArray(value)) return {arrayValue: {values: value.map(typed)}};
  if (value && typeof value === 'object') return {mapValue: {fields: fields(value)}};
  throw new Error('Unsupported Firestore field type');
}
function fields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, typed(value)]));
}

export function offlinePayloads() {
  assert.equal(actor.uid, 'synthetic-seller-a');
  assert.equal(privateProduct.ownerUid, actor.uid);
  assert.equal(privateProduct.kind, 'product');
  assert.equal(privateProduct.id, 'synthetic-phase-b-read-01');
  assert.equal(privateProduct.revision, 1);
  assert.equal(privateProduct.publicationRevision, 0);
  assert.equal(privateProduct.profile.photos.length, 0);
  return {
    [ACTOR_PATH]: {fields: fields(actor)},
    [PRODUCT_PATH]: {fields: fields(privateProduct)},
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) {
    console.error('No execution flags supported; offline preview only');
    process.exitCode = 2;
  } else {
    const preview = offlinePayloads();
    assert.equal(Object.keys(preview).length, 2);
    console.log('OLDX PHASE B — OFFLINE FIRESTORE SCHEMA PREVIEW');
    console.log(JSON.stringify(preview, null, 2));
    console.log('NO NETWORK; NO FIREBASE WRITES; NO RESOURCES CREATED.');
  }
}
