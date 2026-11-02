import test from 'node:test';
import assert from 'node:assert/strict';
import { parseServicePreviewRoute, buildServicePreviewLink } from './preview-route.mjs';

test('parses only bounded local preview routes', () => {
  assert.deepEqual(parseServicePreviewRoute(''), { view: 'browse' });
  assert.deepEqual(parseServicePreviewRoute('#services'), { view: 'browse' });
  assert.deepEqual(parseServicePreviewRoute('#my-services'), { view: 'provider' });
  assert.deepEqual(parseServicePreviewRoute('#provider/p1'), { view: 'profile', providerId: 'p1' });
  for (const hash of ['#provider/', '#provider/../private', '#provider/%2f', '#provider/p1?owner=secret',
    '#provider/' + 'a'.repeat(101), '#unknown', null, '#provider/<img>']) {
    assert.deepEqual(parseServicePreviewRoute(hash), { view: 'not-found' });
  }
});

test('builds a same-origin preview link without forwarding query or stale hash data', () => {
  const result = buildServicePreviewLink({ origin: 'http://127.0.0.1:3000',
    pageUrl: 'http://127.0.0.1:3000/service-preview.html?privateToken=secret#my-services', providerId: 'p1' });
  assert.deepEqual(result, { ok: true, url: 'http://127.0.0.1:3000/service-preview.html#provider/p1' });
  assert.deepEqual(parseServicePreviewRoute(new URL(result.url).hash), { view: 'profile', providerId: 'p1' });
});

test('refuses cross-origin, credential, non-preview and insecure remote links', () => {
  for (const pageUrl of ['https://evil.example/service-preview.html', 'https://user:pass@oldx.example/service-preview.html',
    'https://oldx.example/index.html', 'javascript:alert(1)', 'http://oldx.example/service-preview.html']) {
    assert.equal(buildServicePreviewLink({ origin: 'https://oldx.example', pageUrl, providerId: 'p1' }).ok, false);
  }
  assert.equal(buildServicePreviewLink({ origin: 'https://oldx.example', pageUrl: 'https://oldx.example/service-preview.html', providerId: '../private' }).ok, false);
});
