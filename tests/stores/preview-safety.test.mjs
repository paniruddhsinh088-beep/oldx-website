import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BROWSER_ASSETS } from '../../scripts/build-static-assets.mjs';
const html = await readFile(new URL('../../store-preview.html', import.meta.url), 'utf8');
const controller = await readFile(new URL('../../features/stores/store-preview.mjs', import.meta.url), 'utf8');
const modules = await Promise.all(BROWSER_ASSETS.filter(path => path.startsWith('features/')).map(path => readFile(new URL('../../' + path, import.meta.url), 'utf8')));
const source = [html, ...modules].join('\n');
test('Store preview is visibly synthetic and restricts active browser capabilities', () => {
  assert.match(html, /Synthetic preview only/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /object-src 'none'/);
  assert.doesNotMatch(html, /https?:\/\/|firebase-env|firebase-config/);
});
test('Store display modules cannot read live data, submit, persist records or render HTML', () => {
  assert.doesNotMatch(source, /firebase-app|firebase-firestore|firebase-storage|initializeApp\s*\(|getFirestore\s*\(|\bfetch\s*\(|XMLHttpRequest|WebSocket\s*\(|sendBeacon|indexedDB|sessionStorage|\.innerHTML\s*=|\.submit\s*\(/);
  assert.doesNotMatch(controller, /\.setItem\s*\(/);
  assert.match(controller, /buildStoreCataloguePage/);
  assert.match(controller, /writeLocalePreference\(storage\(\), translator.locale\)/);
});
test('static allowlist packages the preview and its stylesheet but no future server contracts', () => {
  assert.ok(BROWSER_ASSETS.includes('store-preview.html'));
  assert.ok(BROWSER_ASSETS.includes('features/stores/store-preview.css'));
  assert.equal(BROWSER_ASSETS.some(path => path.includes('public-data-contract')), false);
});
