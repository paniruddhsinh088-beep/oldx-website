import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStorePreviewRoute } from './preview-route.mjs';
test('Store routes select bounded sample IDs without decoding paths or query content', () => {
  assert.equal(parseStorePreviewRoute('').storeId, 'demo-shop');
  assert.deepEqual(parseStorePreviewRoute('#store/demo-shop/product/sample-1'), { view: 'product', storeId: 'demo-shop', productId: 'sample-1' });
  assert.equal(parseStorePreviewRoute('#store/demo-empty').view, 'catalogue');
  for (const hash of [null, {}, '#store/../private', '#store/demo/product/%2Fprivate', '#store/demo?token=secret', '#store/' + 'a'.repeat(129), '#store/demo/product/x/extra']) {
    assert.deepEqual(parseStorePreviewRoute(hash), { view: 'not-found' });
  }
});
