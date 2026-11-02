import { buildStoreCataloguePage } from './store-catalogue.mjs';

// INACTIVE draft for future trusted-server review. Not imported by a browser,
// not an SDK query, authorization proof, approved schema or deployment artifact.
const MAX_TIMESTAMP_SECONDS = 253402300799;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const failure = () => ({ ok: false, code: 'INVALID_PUBLIC_CATALOGUE_CONTRACT' });
const limitValid = value => Number.isInteger(value) && value >= 1 && value <= 24;
export function planDraftPublicCatalogueRead(input) {
  if (!plain(input) || Object.keys(input).some(key => !['storeUid', 'pageSize', 'cursor'].includes(key))) return failure();
  const { storeUid, pageSize = 12, cursor = null } = input;
  if (typeof storeUid !== 'string' || !ID.test(storeUid) || !limitValid(pageSize)) return failure();
  if (cursor !== null && (!plain(cursor) ||
      Object.keys(cursor).sort().join(',') !== 'id,nanoseconds,seconds,storeUid' ||
      cursor.storeUid !== storeUid || typeof cursor.id !== 'string' || !ID.test(cursor.id) ||
      !Number.isSafeInteger(cursor.seconds) || cursor.seconds < 0 || cursor.seconds > MAX_TIMESTAMP_SECONDS ||
      !Number.isInteger(cursor.nanoseconds) || cursor.nanoseconds < 0 || cursor.nanoseconds >= 1e9)) return failure();
  return { ok: true, plan: {
    collection: 'publicProducts',
    where: [['sellerUid', '==', storeUid], ['publicationStatus', '==', 'published']],
    orderBy: [['createdAt', 'desc'], ['__name__', 'asc']],
    limit: pageSize + 1,
    startAfter: cursor === null ? null : [{ seconds: cursor.seconds, nanoseconds: cursor.nanoseconds }, cursor.id]
  } };
}

// Defensive response projection after a trusted bounded read, never a reason
// to send private/legacy documents to an untrusted client for later filtering.
export function projectDraftPublicCataloguePage(input) {
  if (!plain(input) || Object.keys(input).some(key => !['storeUid', 'records', 'pageSize'].includes(key))) return failure();
  const { storeUid, records, pageSize = 12 } = input;
  if (!limitValid(pageSize) || !Array.isArray(records) || records.length > pageSize + 1 ||
      Array.from(records).some(record => !plain(record) || record.publicationStatus !== 'published' ||
        record.sellerUid !== storeUid || !plain(record.createdAt) ||
        !Number.isSafeInteger(record.createdAt.seconds) || record.createdAt.seconds < 0 || record.createdAt.seconds > MAX_TIMESTAMP_SECONDS ||
        !Number.isInteger(record.createdAt.nanoseconds) || record.createdAt.nanoseconds < 0 || record.createdAt.nanoseconds >= 1e9)) return failure();
  const projected = buildStoreCataloguePage({ storeUid, listings: records, pageSize: 24 });
  if (!projected.ok || projected.skippedCount || projected.matchedCount !== records.length) return failure();
  const items = projected.items.slice(0, pageSize);
  return { ok: true, items, hasMore: records.length > pageSize };
}
