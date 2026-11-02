import { sampleStores, sampleListings } from '../preview-fixtures.mjs';

// Test inputs and proposed expectations ONLY. Not deployed authorization logic,
// real identities, approved publication policy, or a browser role check.
export const ACTORS = Object.freeze(['guest', 'seller', 'other-seller', 'moderator']);
export const CHANGES = Object.freeze(['published', 'store-suspended', 'store-unpublished',
  'listing-withdrawn', 'seller-mismatch', 'removed-product', 'removed-store']);
export function publicationSequence(change = 'published') {
  if (!CHANGES.includes(change)) throw new TypeError('Unknown synthetic change');
  const scope = { storeUid: 'demo-shop', productId: 'sample-13' };
  const store = { ...sampleStores[0], sellerUid: scope.storeUid, publicationStatus: 'published', privateNote: 'PRIVATE STORE' };
  const listing = { ...sampleListings[12], publicationStatus: 'published', phone: 'PRIVATE PHONE', moderationNotes: 'PRIVATE ADMIN' };
  const before = { status: 'published', store: structuredClone(store), listing: structuredClone(listing) };
  const after = structuredClone(before);
  if (change === 'store-suspended') after.store.publicationStatus = 'suspended';
  if (change === 'store-unpublished') after.store.publicationStatus = 'unpublished';
  if (change === 'listing-withdrawn') after.listing.publicationStatus = 'unpublished';
  if (change === 'seller-mismatch') after.listing.sellerUid = 'demo-empty';
  if (change === 'removed-product') after.listing = null;
  if (change === 'removed-store') after.store = null;
  return { scope, before, after, // logical ordering, not real clock/freshness evidence
    timeline: ['catalogue', 'Store read', 'publication change', 'listing read', 'Store revalidation'],
    expected: change === 'published' ? 'ready' : change === 'seller-mismatch' ? 'invalid' : 'unavailable' };
}
export const PUBLIC_DETAIL_CASES = Object.freeze(ACTORS.flatMap(actor => CHANGES.map(change =>
  Object.freeze({ actor, change, expected: change === 'published' ? 'ready' : change === 'seller-mismatch' ? 'invalid' : 'unavailable' }))));
export const DENIED_SURFACE_CASES = Object.freeze(ACTORS.flatMap(actor =>
  ['private-seller', 'admin-moderation', 'legacy-products'].map(surface => Object.freeze({ actor, surface, expected: 'deny' }))));
