import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BROWSER_ASSETS } from '../../scripts/build-static-assets.mjs';

const html = await readFile(new URL('../../service-preview.html', import.meta.url), 'utf8');
const modules = await Promise.all(BROWSER_ASSETS.filter(path => path.startsWith('features/'))
  .map(path => readFile(new URL('../../' + path, import.meta.url), 'utf8')));
const controller = modules[0];
const source = [html, ...modules].join('\n');

test('Service preview is prominently identified as demo-only', () => {
  assert.match(html, /UI PREVIEW ONLY/);
  assert.match(html, /કોઈ વાસ્તવિક પ્રોફાઇલ, ફોન નંબર, મેસેજ કે ડેટાબેઝ જોડાયેલ નથી/);
  assert.match(html, /No live Firestore reads\/writes/);
});

test('Service preview does not connect to Firebase or remote APIs', () => {
  assert.doesNotMatch(source, /firebase-app|firebase-firestore|firebase-storage|getFirestore\s*\(|getStorage\s*\(|initializeApp\s*\(/i);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket\s*\(/);
});

test('Contact actions remain disabled in the demo', () => {
  for (const key of ['callAction', 'whatsappAction', 'messageAction']) {
    assert.match(html, new RegExp('<button class="btn contact-demo" disabled[^>]*data-i18n="' + key + '"'));
  }
});

test('Public phone and WhatsApp consent default to off', () => {
  assert.match(html, /id="allowPhone" type="checkbox"(?![^>]*\bchecked\b)/);
  assert.match(html, /id="allowWhatsapp" type="checkbox"(?![^>]*\bchecked\b)/);
});

test('Dynamic profile text and service labels use safe DOM text APIs', () => {
  assert.match(source, /tag\.textContent\s*=\s*service/);
  assert.match(source, /\$\("pServices"\)\.replaceChildren\(\.\.\.serviceTags\)/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});

test('Local form has no persistence/publication path; only the separate locale preference is stored', () => {
  assert.match(html, /type="module" src="\.\/features\/service-providers\/service-preview\.mjs"/);
  assert.match(source, /inspectProviderPreviewDraft/);
  assert.doesNotMatch(source, /sessionStorage|indexedDB|sendBeacon|\.submit\s*\(/);
  assert.doesNotMatch(controller, /\.setItem\s*\(/);
  assert.match(controller, /writeLocalePreference\(preferenceStorage\(\), translator\.locale\)/);
  assert.match(html, /id="providerForm" novalidate/);
  assert.match(html, /id="validationStatus" role="status"/);
});
