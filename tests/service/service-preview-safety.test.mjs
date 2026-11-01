import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../service-preview.html', import.meta.url), 'utf8');

test('Service preview is prominently identified as demo-only', () => {
  assert.match(html, /UI PREVIEW ONLY/);
  assert.match(html, /કોઈ વાસ્તવિક પ્રોફાઇલ, ફોન નંબર, મેસેજ કે ડેટાબેઝ જોડાયેલ નથી/);
  assert.match(html, /No live Firestore reads\/writes/);
});

test('Service preview does not connect to Firebase or remote APIs', () => {
  assert.doesNotMatch(html, /firebase-app|firebase-firestore|firebase-storage|getFirestore\s*\(|getStorage\s*\(|initializeApp\s*\(/i);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|WebSocket\s*\(/);
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
  assert.match(html, /tag\.textContent=service/);
  assert.match(html, /\$\("pServices"\)\.replaceChildren\(\.\.\.serviceTags\)/);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
});
