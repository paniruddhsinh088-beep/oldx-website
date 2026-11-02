import { sampleStores, sampleListings } from './preview-fixtures.mjs';

// OFFLINE mock only. No SDK, URL-selected adapter, network or persistence.
export async function readSyntheticStore(scope, { signal } = {}) {
  if (scope.scenario === 'delayed') await new Promise((resolve, reject) => {
    const timer = setTimeout(done, 350);
    function done() { signal?.removeEventListener('abort', abort); resolve(); }
    function abort() { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  });
  if (scope.scenario === 'error') throw new Error('Synthetic read failed');
  if (scope.scenario === 'invalid') return { status: 'published', store: {}, records: [] };
  if (scope.scenario === 'revoked') return { status: 'revoked' };
  return { status: 'published', store: sampleStores.find(store => store.id === scope.storeUid),
    records: sampleListings.filter(row => row.sellerUid === scope.storeUid).map(row => ({ ...row, publicationStatus: 'published' })) };
}
