import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink, rename, lstat } from 'node:fs/promises';
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
    for (const page of ['service-preview.html', 'store-preview.html', 'service-inbox-preview.html', 'service-buyer-preview.html', 'service-conversation-preview.html', 'service-discovery-preview.html']) {
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

test('missing config fails before replacing any existing output', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'public', 'previous.html'), 'previous');
    await rm(join(root, 'firebase-env.js'));
    await assert.rejects(buildStaticAssets(root));
    assert.deepEqual(await files(join(root, 'public')), ['previous.html']);
    assert.equal(await readFile(join(root, 'public', 'previous.html'), 'utf8'), 'previous');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('linked asset ancestor is rejected before replacing output, including Windows junctions', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'public', 'previous.html'), 'previous');
    const target = join(root, 'private-tree');
    await rename(join(root, 'features'), target);
    await writeFile(join(target, 'private-secret.json'), 'synthetic private material');
    // Directory junctions need no Windows file-symlink privilege. Both forms are
    // real filesystem links; exercise ancestor traversal, not a mocked stat.
    await symlink(target, join(root, 'features'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal((await lstat(join(root, 'features'))).isSymbolicLink(), true);
    assert.equal(await readFile(join(root, 'features', 'private-secret.json'), 'utf8'), 'synthetic private material');
    await assert.rejects(buildStaticAssets(root), /Expected regular browser asset: features\//);
    assert.deepEqual(await files(join(root, 'public')), ['previous.html']);
    assert.equal(await readFile(join(root, 'public', 'previous.html'), 'utf8'), 'previous');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// Exercise leaf-link rejection on every platform without privileged file links.
test('linked config cannot package private file bytes', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'public', 'previous.html'), 'previous');
    await rm(join(root, 'firebase-env.js'));
    if (process.platform === 'win32') {
      const target = join(root, 'private-config');
      await mkdir(target);
      await writeFile(join(target, 'private.json'), 'synthetic private material');
      await symlink(target, join(root, 'firebase-env.js'), 'junction');
      assert.equal(await readFile(join(root, 'firebase-env.js', 'private.json'), 'utf8'), 'synthetic private material');
    } else {
      await writeFile(join(root, 'private.json'), 'synthetic private material');
      await symlink(join(root, 'private.json'), join(root, 'firebase-env.js'));
      assert.equal(await readFile(join(root, 'firebase-env.js'), 'utf8'), 'synthetic private material');
    }
    assert.equal((await lstat(join(root, 'firebase-env.js'))).isSymbolicLink(), true);
    await assert.rejects(buildStaticAssets(root), /regular browser asset/);
    assert.deepEqual(await files(join(root, 'public')), ['previous.html']);
    assert.equal(await readFile(join(root, 'public', 'previous.html'), 'utf8'), 'previous');
  } finally { await rm(root, { recursive: true, force: true }); }
});
