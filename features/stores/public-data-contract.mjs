import { buildStoreCataloguePage, STORE_CATEGORY_IDS } from './store-catalogue.mjs';

// INACTIVE draft for future trusted-server review. Not imported by a browser,
// not an SDK query, authorization proof, approved schema or deployment artifact.
const MAX_TIMESTAMP_SECONDS = 253402300799;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const CATEGORIES = new Set(STORE_CATEGORY_IDS);
const CURSOR_KEYS = 'availableOnly,category,id,nanoseconds,seconds,sort,storeUid,version';
const READ_KEYS = ['storeUid', 'pageSize', 'cursor', 'category', 'availableOnly', 'sort'];
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const failure = () => ({ ok: false, code: 'INVALID_PUBLIC_CATALOGUE_CONTRACT' });
const timestampValid = value => plain(value) && Number.isSafeInteger(value.seconds) &&
  value.seconds >= 0 && value.seconds <= MAX_TIMESTAMP_SECONDS &&
  Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 && value.nanoseconds < 1e9;

function readScope(input, extraKeys = []) {
  if (!plain(input) || Object.keys(input).some(key => ![...READ_KEYS, ...extraKeys].includes(key))) return null;
  const { storeUid, pageSize = 12, cursor = null, category = 'all', availableOnly = false, sort = 'newest' } = input;
  // Only the candidate newest query is specified here. Other sort/search modes
  // require separately approved indexed fields and ordering/cursor contracts.
  if (typeof storeUid !== 'string' || !ID.test(storeUid) ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 24 ||
      (category !== 'all' && !CATEGORIES.has(category)) ||
      typeof availableOnly !== 'boolean' || sort !== 'newest') return null;
  if (cursor !== null && (!plain(cursor) || Object.keys(cursor).sort().join(',') !== CURSOR_KEYS ||
      cursor.version !== 1 || cursor.storeUid !== storeUid || cursor.category !== category ||
      cursor.availableOnly !== availableOnly || cursor.sort !== sort ||
      typeof cursor.id !== 'string' || !ID.test(cursor.id) || !timestampValid(cursor))) return null;
  return { storeUid, pageSize, cursor, category, availableOnly, sort };
}

export function planDraftPublicCatalogueRead(input) {
  const scope = readScope(input);
  if (!scope) return failure();
  const { storeUid, pageSize, cursor, category, availableOnly } = scope;
  const where = [['sellerUid', '==', storeUid], ['publicationStatus', '==', 'published']];
  if (category !== 'all') where.push(['category', '==', category]);
  if (availableOnly) where.push(['isSold', '==', false]);
  return { ok: true, plan: {
    collection: 'publicProducts', where,
    orderBy: [['createdAt', 'desc'], ['__name__', 'asc']],
    limit: pageSize + 1,
    startAfter: cursor === null ? null : [{ seconds: cursor.seconds, nanoseconds: cursor.nanoseconds }, cursor.id]
  } };
}

function compareRecords(a, b) {
  return b.createdAt.seconds - a.createdAt.seconds ||
    b.createdAt.nanoseconds - a.createdAt.nanoseconds ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// Defensive response projection after a trusted bounded read, never a reason
// to send private/legacy documents to an untrusted client for later filtering.
export function projectDraftPublicCataloguePage(input) {
  const scope = readScope(input, ['records']);
  if (!scope) return failure();
  const { storeUid, pageSize, cursor, category, availableOnly, sort } = scope;
  const { records } = input;
  if (!Array.isArray(records) || records.length > pageSize + 1 ||
      Array.from(records).some(record => !plain(record) ||
        typeof record.id !== 'string' || !ID.test(record.id) || record.publicationStatus !== 'published' ||
        record.sellerUid !== storeUid || !timestampValid(record.createdAt))) return failure();
  const anchor = cursor && { id: cursor.id, createdAt: cursor };
  for (let index = 0; index < records.length; index++) {
    // Reject stale/replayed or incorrectly ordered query responses, including
    // lookahead, rather than manufacturing a cursor that silently skips data.
    if ((anchor && compareRecords(records[index], anchor) <= 0) ||
        (index > 0 && compareRecords(records[index - 1], records[index]) >= 0)) return failure();
  }
  const projected = buildStoreCataloguePage({ storeUid, listings: records, pageSize: 24, category, availableOnly });
  if (!projected.ok || projected.skippedCount || projected.matchedCount !== records.length) return failure();
  const items = projected.items.slice(0, pageSize);
  const hasMore = records.length > pageSize;
  const last = hasMore && records[pageSize - 1];
  return { ok: true, items, hasMore, nextCursor: last ? {
    version: 1, storeUid, category, availableOnly, sort,
    id: last.id, seconds: last.createdAt.seconds, nanoseconds: last.createdAt.nanoseconds
  } : null };
}
