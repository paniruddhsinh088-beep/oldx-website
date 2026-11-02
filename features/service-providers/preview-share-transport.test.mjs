import test from 'node:test';
import assert from 'node:assert/strict';
import { shareProviderLink } from './provider-mobile-share.mjs';

const link = { title: 'OldX demo · કિરણ', text: 'Preview only',
  url: 'http://127.0.0.1:3000/service-preview.html#provider/p1' };

test('shares the prepared demo link and falls back to copy without inventing a live route', async () => {
  let sent;
  assert.deepEqual(await shareProviderLink(link, { share: async data => { sent = data; } }), { ok: true, method: 'native' });
  assert.deepEqual(sent, link);
  let copied;
  assert.deepEqual(await shareProviderLink(link, { share: async () => { throw new Error('unavailable'); },
    writeText: async text => { copied = text; } }), { ok: true, method: 'clipboard' });
  assert.equal(copied, link.url);
});

test('cancellation never silently copies and clipboard denial is reported honestly', async () => {
  let copied = false;
  const result = await shareProviderLink(link, { share: async () => { throw { name: 'AbortError' }; },
    writeText: async () => { copied = true; } });
  assert.equal(result.code, 'SHARE_CANCELLED');
  assert.equal(copied, false);
  assert.equal((await shareProviderLink(link, { writeText: async () => { throw new Error('denied'); } })).code, 'CLIPBOARD_UNAVAILABLE');
});

test('invalid share data cannot reach native or clipboard capabilities', async () => {
  let calls = 0;
  for (const input of [null, {}, { ...link, url: 'javascript:alert(1)' },
    { ...link, url: 'http://remote.example/service-preview.html' },
    { ...link, title: 'a'.repeat(301) }, { ...link, url: 'https://user:pass@example.com' }]) {
    assert.equal((await shareProviderLink(input, { share: async () => { calls++; } })).ok, false);
  }
  assert.equal(calls, 0);
});
