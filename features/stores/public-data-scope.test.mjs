import test from 'node:test';
import assert from 'node:assert/strict';
import { planDraftPublicCatalogueRead, projectDraftPublicCataloguePage } from './public-data-contract.mjs';
const invalid = { ok: false, code: 'INVALID_PUBLIC_CATALOGUE_CONTRACT' };
const record = (id, seconds, extra = {}) => ({ id, sellerUid: 'sample-store', publicationStatus: 'published',
  createdAt: { seconds, nanoseconds: 10 }, title: 'નમૂનો', category: 'books', basePrice: 100, isSold: false, ...extra });
const scope = { storeUid: 'sample-store', category: 'books', availableOnly: true, sort: 'newest', pageSize: 1 };
const firstPage = () => projectDraftPublicCataloguePage({ ...scope, records: [record('a', 30), record('b', 20)] });

test('draft filter predicates run at the trusted query, not after client pagination', () => {
  const result = planDraftPublicCatalogueRead(scope);
  assert.equal(result.ok, true);
  assert.deepEqual(result.plan.where, [['sellerUid', '==', 'sample-store'], ['publicationStatus', '==', 'published'],
    ['category', '==', 'books'], ['isSold', '==', false]]);
  assert.equal(result.plan.limit, 2);
  for (const input of [{ category: 'unknown' }, { availableOnly: 'true' }, { sort: 'price-low' }, { query: 'secret' }]) {
    assert.deepEqual(planDraftPublicCatalogueRead({ ...scope, ...input }), invalid);
  }
});

test('lookahead cursor anchors the last returned card and binds store, filters and order', () => {
  const result = firstPage();
  assert.equal(result.ok, true);
  assert.equal(result.hasMore, true);
  assert.deepEqual(result.nextCursor, { version: 1, storeUid: 'sample-store', category: 'books', availableOnly: true,
    sort: 'newest', id: 'a', seconds: 30, nanoseconds: 10 });
  const next = planDraftPublicCatalogueRead({ ...scope, cursor: result.nextCursor });
  assert.equal(next.ok, true);
  assert.deepEqual(next.plan.startAfter, [{ seconds: 30, nanoseconds: 10 }, 'a']);
  for (const changed of [{ storeUid: 'other' }, { category: 'all' }, { availableOnly: false }, { sort: 'price-high' }]) {
    assert.deepEqual(planDraftPublicCatalogueRead({ ...scope, ...changed, cursor: result.nextCursor }), invalid);
  }
  for (const changed of [{ version: 2 }, { version: undefined }, { sort: 'name' }, { extra: 'private' }]) {
    assert.deepEqual(planDraftPublicCatalogueRead({ ...scope, cursor: { ...result.nextCursor, ...changed } }), invalid);
  }
  const final = projectDraftPublicCataloguePage({ ...scope, cursor: result.nextCursor, records: [record('b', 20)] });
  assert.equal(final.ok, true); assert.equal(final.hasMore, false); assert.equal(final.nextCursor, null);
});

test('response rejects nonmatching filters, unsorted records, replayed anchors and invalid cursors', () => {
  const cursor = firstPage().nextCursor;
  for (const records of [[record('b', 20, { category: 'mobiles' })], [record('b', 20, { isSold: true })],
    [record('b', 20), record('c', 25)], [record('a', 30)], [record('z', 40)]]) {
    assert.deepEqual(projectDraftPublicCataloguePage({ ...scope, cursor, records }), invalid);
  }
  assert.deepEqual(projectDraftPublicCataloguePage({ ...scope, cursor: { ...cursor, storeUid: 'other' }, records: [] }), invalid);
});

test('revocation between pages fails closed without cached cards, private fields or cursor', () => {
  const cursor = firstPage().nextCursor;
  for (const publicationStatus of ['pending_review', 'suspended', 'deleted', 'unpublished', null]) {
    const response = projectDraftPublicCataloguePage({ ...scope, cursor, records: [record('b', 20, { publicationStatus, phone: 'PRIVATE' })] });
    assert.deepEqual(response, invalid);
    assert.equal(JSON.stringify(response).includes('PRIVATE'), false);
  }
  const gone = projectDraftPublicCataloguePage({ ...scope, cursor, records: [] });
  assert.deepEqual(gone, { ok: true, items: [], hasMore: false, nextCursor: null });
});

test('cursor ordering preserves nanoseconds and ID ties without mutation', () => {
  const rows = [record('a', 20, { createdAt: { seconds: 20, nanoseconds: 900 } }),
    record('b', 20, { createdAt: { seconds: 20, nanoseconds: 900 } }),
    record('c', 20, { createdAt: { seconds: 20, nanoseconds: 100 } })];
  const snapshot = structuredClone(rows);
  const first = projectDraftPublicCataloguePage({ ...scope, records: rows.slice(0, 2) });
  const second = projectDraftPublicCataloguePage({ ...scope, cursor: first.nextCursor, records: rows.slice(1) });
  assert.equal(second.ok, true); assert.equal(second.items[0].id, 'b');
  assert.equal(second.nextCursor.id, 'b');
  const last = projectDraftPublicCataloguePage({ ...scope, cursor: second.nextCursor, records: rows.slice(2) });
  assert.equal(last.ok, true); assert.equal(last.items[0].id, 'c');
  assert.deepEqual(rows, snapshot);
});

test('invalid record IDs are rejected before cursor comparisons can coerce objects', () => {
  const cursor = firstPage().nextCursor;
  let calls = 0;
  const hostileId = { [Symbol.toPrimitive]() { calls++; throw new Error('must not coerce'); } };
  for (const id of [hostileId, '../private', '', 'a'.repeat(129), null]) {
    assert.deepEqual(projectDraftPublicCataloguePage({ ...scope, cursor, records: [record(id, 30)] }), invalid);
  }
  assert.equal(calls, 0);
});
