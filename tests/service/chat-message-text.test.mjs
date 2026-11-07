import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessageDraft } from '../../features/chat/message-text.mjs';

test('preserves Gujarati, Hindi, emoji and Indic joiners as authored plain text', () => {
  const authored = 'ગુજરાતી हिन्दी क्\u200dष 👩🏽‍💻';
  assert.equal(normalizeMessageDraft(authored), authored.normalize('NFC'));
});

test('normalizes NFC, trims edges and preserves ordinary internal newlines', () => {
  assert.equal(normalizeMessageDraft('  e\u0301 ગુજરાતી\nहिन्दी  '), 'é ગુજરાતી\nहिन्दी');
});

test('rejects empty, non-string, markup and forbidden C0/C1 controls', () => {
  for (const value of ['', ' \n\t ', null, undefined, 1, {}, [], '<img>', '1 > 0',
    'a\u0000b', 'a\u001fb', 'a\u0085b']) {
    assert.equal(normalizeMessageDraft(value), null);
  }
});

test('rejects visual direction override and isolate controls without rejecting Indic joiners', () => {
  for (const code of [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]) {
    assert.equal(normalizeMessageDraft('buyer' + String.fromCharCode(code) + 'seller'), null);
  }
  assert.equal(normalizeMessageDraft('क्\u200dष'), 'क्\u200dष');
  assert.equal(normalizeMessageDraft('क्\u200cष'), 'क्\u200cष');
});

test('rejects lone UTF-16 surrogates but accepts valid supplementary characters', () => {
  for (const value of ['\ud800', '\udc00', 'a\ud800b', 'a\udc00b', '\ud800x\udc00']) {
    assert.equal(normalizeMessageDraft(value), null);
  }
  assert.equal(normalizeMessageDraft('🙂'), '🙂');
  assert.equal(normalizeMessageDraft('a🙂b'), 'a🙂b');
});

test('enforces both pre-normalization and post-normalization 2000-code-unit bounds', () => {
  assert.equal(normalizeMessageDraft('x'.repeat(2000)), 'x'.repeat(2000));
  assert.equal(normalizeMessageDraft('x'.repeat(2001)), null);
  assert.equal(normalizeMessageDraft('\u0344'.repeat(1500)), null);
  assert.equal(normalizeMessageDraft('🙂'.repeat(1000)), '🙂'.repeat(1000));
  assert.equal(normalizeMessageDraft('🙂'.repeat(1001)), null);
});

test('does not coerce caller objects or execute custom conversion hooks', () => {
  let called = false;
  const hostile = {toString() {called = true; throw Error('not safe'); }};
  assert.equal(normalizeMessageDraft(hostile), null);
  assert.equal(called, false);
});

test('accepts plain URLs as text without attempting navigation or HTML rendering', () => {
  const value = 'https://example.invalid/?q=hello';
  assert.equal(normalizeMessageDraft(value), value);
});
