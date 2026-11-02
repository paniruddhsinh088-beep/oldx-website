import test from 'node:test';
import assert from 'node:assert/strict';
import { planDraftPublicCatalogueRead, projectDraftPublicCataloguePage } from './public-data-contract.mjs';
const invalid = { ok: false, code: 'INVALID_PUBLIC_CATALOGUE_CONTRACT' };
const record = (id, extra = {}) => ({ id, sellerUid: 'sample-store', publicationStatus: 'published',
  createdAt: { seconds: 1700000000, nanoseconds: 10 }, title: 'નમૂનો', category: 'books', basePrice: 100, isSold: false, ...extra });
test('draft read plan requires exact seller/publication predicates, stable cursor order and limit+1', () => {
  const cursor = { storeUid: 'sample-store', id: 'p1', seconds: 1700000000, nanoseconds: 10 };
  const result = planDraftPublicCatalogueRead({ storeUid: 'sample-store', pageSize: 24, cursor });
  assert.deepEqual(result, { ok: true, plan: { collection: 'publicProducts',
    where: [['sellerUid', '==', 'sample-store'], ['publicationStatus', '==', 'published']],
    orderBy: [['createdAt', 'desc'], ['__name__', 'asc']], limit: 25,
    startAfter: [{ seconds: 1700000000, nanoseconds: 10 }, 'p1'] } });
  result.plan.startAfter[0].seconds = 0;
  assert.equal(cursor.seconds, 1700000000);
});
test('draft read plan rejects unsafe collection overrides, unbounded queries and cross-store cursors', () => {
  for (const input of [null, [], { storeUid: '../legacy' }, { storeUid: 'sample-store', pageSize: 25 },
    { storeUid: 'sample-store', collection: 'products' }, { storeUid: 'sample-store', publicationStatus: 'pending_review' },
    { storeUid: 'sample-store', cursor: { storeUid: 'other', id: 'p1', seconds: 1, nanoseconds: 0 } },
    { storeUid: 'sample-store', cursor: { storeUid: 'sample-store', id: 'p1', seconds: 1, nanoseconds: 1e9 } }]) {
    assert.deepEqual(planDraftPublicCatalogueRead(input), invalid);
  }
});
test('draft response uses a strict public card allowlist and bounded lookahead without private fields', () => {
  const result = projectDraftPublicCataloguePage({ storeUid: 'sample-store', pageSize: 1, records: [
    record('a', { phone: 'PRIVATE', userIp: 'PRIVATE', images: ['PRIVATE'], coords: { lat: 1 }, isShopVerified: true }), record('b') ] });
  assert.equal(result.ok, true); assert.equal(result.hasMore, true);
  assert.deepEqual(result.items, [{ id: 'a', title: 'નમૂનો', category: 'books', price: 100, priceLabel: '₹100', available: true }]);
});
test('draft response fails closed for unpublished, mixed-seller, sparse, duplicate or malformed batches', () => {
  for (const records of [[record('a', { publicationStatus: 'pending_review' })], [record('a', { publicationStatus: 'suspended' })],
    [record('a', { sellerUid: 'other' })], [record('a'), record('a')], Array(1), [record('a', { createdAt: null })],
    [record('a', { title: '<img>' })], [record('a', { createdAt: { seconds: Number.MAX_SAFE_INTEGER, nanoseconds: 0 } })], Array.from({ length: 14 }, (_, i) => record('p' + i))]) {
    assert.deepEqual(projectDraftPublicCataloguePage({ storeUid: 'sample-store', records }), invalid);
  }
  assert.deepEqual(projectDraftPublicCataloguePage({ storeUid: 'sample-store', records: [], collection: 'products' }), invalid);
  assert.deepEqual(projectDraftPublicCataloguePage({ storeUid: 'sample-store', records: [] }), { ok: true, items: [], hasMore: false });
});
