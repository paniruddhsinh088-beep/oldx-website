import { sampleStores, sampleListings } from './preview-fixtures.mjs';
import { planSyntheticDetailRead } from './preview-detail.mjs';

// OFFLINE mock only. No SDK, URL-selected adapter, network or persistence.
async function simulate(scope, signal) {
  if (scope.scenario === 'delayed') await new Promise((resolve, reject) => {
    const timer = setTimeout(done, 350);
    function done() { signal?.removeEventListener('abort', abort); resolve(); }
    function abort() { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  });
  if (scope.scenario === 'error') throw new Error('Synthetic read failed');
  if (scope.scenario === 'invalid') return { status: 'published', store: {}, records: [] };
  if (scope.scenario === 'revoked') return { status: 'revoked' };
  return null;
}

export async function readSyntheticStore(scope, { signal } = {}) {
  const terminal = await simulate(scope, signal);
  if (terminal) return terminal;
  return { status: 'published', store: sampleStores.find(store => store.id === scope.storeUid),
    records: sampleListings.filter(row => row.sellerUid === scope.storeUid).map(row => ({ ...row, publicationStatus: 'published' })) };
}


export async function readSyntheticDetail(scope, { signal } = {}) {
  const plan = planSyntheticDetailRead({ storeUid: scope.storeUid, productId: scope.productId });
  if (!plan.ok) throw new TypeError('Invalid synthetic detail scope');
  const terminal = await simulate(scope, signal);
  if (terminal) return terminal;
  const store = sampleStores.find(item => item.id === plan.scope.storeUid);
  const listing = sampleListings.find(item => item.id === plan.scope.productId);
  return { status: 'published', store: store ? { ...store, sellerUid: store.id, publicationStatus: 'published' } : null,
    listing: listing ? { ...listing, publicationStatus: 'published' } : null };
}
