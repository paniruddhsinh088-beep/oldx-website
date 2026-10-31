import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('Product image compression rejects invalid, unreadable, and unsupported images instead of hanging', () => {
  const block = section('function compressImage(file)', 'async function handleFinalAdSubmit(e)');
  assert.match(block, /return new Promise\(\(resolve, reject\) =>/);
  assert.match(block, /file\.type\.startsWith\('image\/'\)/);
  assert.match(block, /reader\.onerror\s*=/);
  assert.match(block, /img\.onerror\s*=/);
  assert.match(block, /if \(!ctx\)/);
  assert.match(block, /catch \(error\)\s*\{\s*reject\(error\)/);
});

test('New product Firestore save is awaited so failures reach the submit catch and restore the button', () => {
  const block = section('async function handleFinalAdSubmit(e)', 'function closeSuccessModalAndGoHome()');
  assert.match(block, /await db\.collection\('products'\)\.add\(adData\)/);
  assert.match(block, /catch \(err\)/);
  assert.match(block, /btn\.disabled = false/);
  assert.doesNotMatch(block, /db\.collection\('products'\)\.add\(adData\)\.then/);
});
