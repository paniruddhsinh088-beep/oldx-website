// Routes select local synthetic fixtures only; never a collection/query path.
const ID = '[A-Za-z0-9_-]{1,128}';
const routePattern = new RegExp('^#store/(' + ID + ')(?:/product/(' + ID + '))?$');
export function parseStorePreviewRoute(hash) {
  if (hash === '' || hash === '#') return { view: 'catalogue', storeId: 'demo-shop' };
  if (typeof hash !== 'string' || hash.length > 280) return { view: 'not-found' };
  const match = routePattern.exec(hash);
  return match ? { view: match[2] ? 'product' : 'catalogue', storeId: match[1], productId: match[2] ?? null }
    : { view: 'not-found' };
}
