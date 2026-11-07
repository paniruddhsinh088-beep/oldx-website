import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addPagesApiNotFound } from '../scripts/build-cloudflare-pages.mjs';

test('Cloudflare build adds only an API-scoped 404 without touching existing frontend', async () => {
  const output = await mkdtemp(join(tmpdir(), 'oldx-pages-'));
  try {
    await writeFile(join(output, 'index.html'), '<h1>OLDX</h1>');
    const path = await addPagesApiNotFound(output);
    const html = await readFile(path, 'utf8');
    assert.match(html, /<title>Not Found<\/title>/);
    assert.doesNotMatch(html, /OLDX_FIREBASE|secret|token/i);
    assert.deepEqual((await readdir(output)).sort(), ['api', 'index.html']);
    assert.deepEqual(await readdir(join(output, 'api')), ['404.html']);
    assert.equal(await readFile(join(output, 'index.html'), 'utf8'), '<h1>OLDX</h1>');
    await addPagesApiNotFound(output);
    assert.equal(await readFile(path, 'utf8'), html);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
