import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../service-preview.html', import.meta.url), 'utf8');
const modules = await Promise.all(['service-preview', 'preview-fixtures', 'preview-draft', 'provider-profile', 'service-selections']
  .map(name => readFile(new URL('../../features/service-providers/' + name + '.mjs', import.meta.url), 'utf8')));
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
  assert.match(html, /<button class="btn contact-demo" disabled>📞 કૉલ કરો<\/button>/);
  assert.match(html, /<button class="btn contact-demo" disabled>WhatsApp<\/button>/);
  assert.match(html, /<button class="btn contact-demo" disabled>OldX પર મેસેજ<\/button>/);
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

test('Local form validation is modular and has no persistence or publication path', () => {
  assert.match(html, /type="module" src="\.\/features\/service-providers\/service-preview\.mjs"/);
  assert.match(source, /inspectProviderPreviewDraft/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|sendBeacon|\.submit\s*\(/);
  assert.match(html, /id="providerForm" novalidate/);
  assert.match(html, /id="validationStatus" role="status"/);
});
