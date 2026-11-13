import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTOR_PATH, PRODUCT_PATH, offlinePayloads} from '../../scripts/phase-b-firestore-typed-fixture-preview.mjs';
import {validateMarketplaceProfile} from '../../scripts/firebase-marketplace-repository.mjs';

function untype(field) {
  if (Object.hasOwn(field, 'nullValue')) return null;
  if (Object.hasOwn(field, 'stringValue')) return field.stringValue;
  if (Object.hasOwn(field, 'booleanValue')) return field.booleanValue;
  if (Object.hasOwn(field, 'integerValue')) return Number(field.integerValue);
  if (Object.hasOwn(field, 'arrayValue')) return (field.arrayValue.values ?? []).map(untype);
  if (Object.hasOwn(field, 'mapValue')) return Object.fromEntries(
    Object.entries(field.mapValue.fields).map(([key, val]) => [key, untype(val)])
  );
  throw Error('Unexpected Firestore field type');
}

test('only exact authorized two Firestore documents are previewed', () => {
  const payloads = offlinePayloads();
  assert.deepEqual(Object.keys(payloads), [ACTOR_PATH, PRODUCT_PATH]);
  const actor = Object.fromEntries(Object.entries(payloads[ACTOR_PATH].fields).map(([k,v]) => [k,untype(v)]));
  assert.deepEqual(actor, {uid:'synthetic-seller-a',canWrite:true,suspended:false});
});

test('typed REST product document matches existing repository profile validation', () => {
  const raw = offlinePayloads()[PRODUCT_PATH].fields;
  const doc = Object.fromEntries(Object.entries(raw).map(([k,v]) => [k,untype(v)]));
  assert.equal(doc.kind, 'product');
  assert.equal(doc.ownerUid, 'synthetic-seller-a');
  assert.equal(doc.id, 'synthetic-phase-b-read-01');
  assert.equal(doc.revision, 1);
  assert.equal(doc.publicationRevision, 0);
  assert.equal(doc.published, false);
  assert.equal(doc.publicProfile, null);
  assert.equal(doc.profile.photos.length, 0);
  assert.deepEqual(validateMarketplaceProfile('product', doc.profile), doc.profile);
});

test('typed REST preview contains no credentials or network/external references', () => {
  const serialized = JSON.stringify(offlinePayloads());
  for (const fragment of ['password','Bearer ','@gmail.com','PRIVATE KEY','http:', 'https:', 'AIza']) {
    assert.equal(serialized.includes(fragment), false, fragment);
  }
  assert.equal(offlinePayloads()[PRODUCT_PATH].fields.profile.mapValue.fields.photos.arrayValue.values.length,0);
});
