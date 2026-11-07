import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addPagesApiNotFound, buildCloudflarePages } from '../../scripts/build-cloudflare-pages.mjs';

test('Cloudflare build adds only an API-scoped 404 without touching existing frontend', async () => {
  const output = await mkdtemp(join(tmpdir(), 'oldx-pages-'));
  try {
    await writeFile(join(output, 'index.html'), '<h1>OLDX</h1>');
    const path = await addPagesApiNotFound(output);
    const html = await readFile(path, 'utf8');
    assert.match(html, /<title>Not Found<\/title>/);
    assert.doesNotMatch(html, /OLDX_FIREBASE|secret|token/i);
    assert.deepEqual((await readdir(output)).sort(), ['_redirects', 'api', 'index.html']);
    assert.deepEqual(await readdir(join(output, 'api')), ['404.html']);
    assert.equal(await readFile(join(output, 'index.html'), 'utf8'), '<h1>OLDX</h1>');
    assert.equal(await readFile(join(output, '_redirects'), 'utf8'), '/api /api/unavailable 308\n');
    await addPagesApiNotFound(output);
    assert.equal(await readFile(path, 'utf8'), html);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('Pages rejects production or mixed Firebase config before rebuilding static output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oldx-pages-config-'));
  try {
    for (const config of [
      {environment:'production',projectId:'oldx-1c983',authDomain:'oldx-1c983.firebaseapp.com'},
      {environment:'staging',projectId:'oldx-staging',authDomain:'oldx-1c983.firebaseapp.com'}
    ]) {
      const generated = {apiKey:'synthetic',appId:'synthetic',storageBucket:'oldx-staging.appspot.com',messagingSenderId:'123',...config};
      await writeFile(join(root, 'firebase-env.js'), '"use strict";\nwindow.OLDX_FIREBASE_CONFIG = Object.freeze('+JSON.stringify(generated)+');\n');
      await assert.rejects(buildCloudflarePages(root), /requires generated staging/);
      assert.deepEqual(await readdir(root), ['firebase-env.js']);
    }
  } finally {
    await rm(root, {recursive:true,force:true});
  }
});
