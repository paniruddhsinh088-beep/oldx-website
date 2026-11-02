import { projectPreviewSnapshot } from './preview-load.mjs';
import { buildStoreCataloguePage } from './store-catalogue.mjs';

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const unavailable = () => Object.freeze({ status: 'unavailable' });
const withdrawn = new Set(['pending_review', 'draft', 'unpublished', 'suspended', 'deleted']);

// Inactive synthetic contract: no SDK/path/provider selection, publication grant
// or approved schema. Two logical document reads per future trusted attempt;
// never search a catalogue page or scan collections to find a detail record.
export function planSyntheticDetailRead(input) {
  if (!plain(input) || Object.keys(input).sort().join(',') !== 'productId,storeUid' ||
      typeof input.storeUid !== 'string' || !ID.test(input.storeUid) ||
      typeof input.productId !== 'string' || !ID.test(input.productId)) return { ok: false, code: 'INVALID_DETAIL_SCOPE' };
  return { ok: true, scope: Object.freeze({ storeUid: input.storeUid, productId: input.productId }),
    maxStoreDocuments: 1, maxListingDocuments: 1 };
}

export function projectSyntheticDetail(response, request) {
  const plan = planSyntheticDetailRead(request);
  if (!plan.ok || !plain(response)) return null;
  if (response.status === 'revoked') return unavailable();
  if (response.status !== 'published') return null;
  const { store, listing } = response;
  if (store === null) return unavailable();
  if (!plain(store) || store.id !== request.storeUid || store.sellerUid !== request.storeUid) return null;
  if (withdrawn.has(store.publicationStatus)) return unavailable();
  if (store.publicationStatus !== 'published') return null;
  if (listing === null) return unavailable();
  if (!plain(listing) || listing.id !== request.productId || listing.sellerUid !== store.sellerUid) return null;
  if (withdrawn.has(listing.publicationStatus)) return unavailable();
  if (listing.publicationStatus !== 'published') return null;
  const projected = projectPreviewSnapshot({ status: 'published', store, records: [listing] }, request.storeUid);
  if (!projected || projected.status !== 'ready') return null;
  const page = buildStoreCataloguePage({ storeUid: request.storeUid, listings: [listing], pageSize: 1 });
  if (!page.ok || page.skippedCount || page.items.length !== 1) return null;
  return Object.freeze({ status: 'ready', store: projected.store, product: Object.freeze(page.items[0]) });
}
