import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, posix } from 'node:path';
import { buildStaticAssets, BROWSER_ASSETS } from './build-static-assets.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'oldx-static-test-'));
  for (const asset of BROWSER_ASSETS) {
    await mkdir(dirname(join(root, asset)), { recursive: true });
    if (asset === 'firebase-env.js') {
      await writeFile(join(root, asset), 'window.OLDX_FIREBASE_CONFIG = Object.freeze({ environment: "staging", projectId: "synthetic" });');
    } else await copyFile(new URL('../' + asset, import.meta.url), join(root, asset));
  }
  return root;
}
async function files(root, prefix = '') {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(root, prefix + entry.name + '/') : prefix + entry.name))).flat().sort();
}

test('homepage preview link and all transitive module imports exist in the static package', async () => {
  const root = await fixture();
  try {
    const output = await buildStaticAssets(root);
    const packaged = await files(output);
    assert.deepEqual(packaged, [...BROWSER_ASSETS].sort());
    assert.match(await readFile(join(output, 'index.html'), 'utf8'), /href="\.\/service-preview\.html"/);
    for (const page of ['service-preview.html', 'store-preview.html']) {
      const html = await readFile(join(output, page), 'utf8');
      for (const [, linked] of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) {
        assert.equal(packaged.includes(linked), true, `unpackaged ${page} dependency: ${linked}`);
      }
    }
    for (const asset of packaged.filter(name => name.endsWith('.mjs'))) {
      const source = await readFile(join(output, asset), 'utf8');
      for (const [, imported] of source.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
        assert.match(imported, /^\.{1,2}\//, 'preview modules must not import remote packages');
        assert.equal(packaged.includes(posix.normalize(posix.join(posix.dirname(asset), imported))), true, imported);
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rebuild removes stale private output and never copies server modules or private files', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'public', 'private-secret.json'), 'synthetic private material');
    await writeFile(join(root, '.env'), 'synthetic private environment');
    const output = await buildStaticAssets(root);
    assert.deepEqual(await files(output), [...BROWSER_ASSETS].sort());
    assert.equal(BROWSER_ASSETS.some(file => file.startsWith('functions/') || file.includes('moderation')), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing config or symlinked asset fails before replacing any existing output', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'public', 'previous.html'), 'previous');
    await rm(join(root, 'firebase-env.js'));
    await assert.rejects(buildStaticAssets(root));
    assert.equal(await readFile(join(root, 'public', 'previous.html'), 'utf8'), 'previous');
    await writeFile(join(root, 'private.json'), 'synthetic private material');
    await symlink(join(root, 'private.json'), join(root, 'firebase-env.js'));
    await assert.rejects(buildStaticAssets(root), /regular browser asset/);
    assert.equal(await readFile(join(root, 'public', 'previous.html'), 'utf8'), 'previous');
  } finally { await rm(root, { recursive: true, force: true }); }
});
