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

test('Search autocomplete renders product text through textContent and validates image URLs', () => {
  const block = section('function handleSearchInput()', 'document.addEventListener(\'click\', (e) =>');
  assert.match(block, /title\.textContent\s*=\s*String\(m\.title/);
  assert.match(block, /price\.textContent\s*=\s*String\(m\.finalPriceStr/);
  assert.match(block, /\^https\?:/);
  assert.doesNotMatch(block, /\$\{m\.title\}|\$\{m\.finalPriceStr\}|\$\{m\.images/);
});

test('Public Store category filters use data attributes and event listeners', () => {
  const block = section('function renderStorePublicContent(data, isOwner)', 'function filterStoreProducts(categoryId)');
  assert.match(block, /data-store-category/);
  assert.match(block, /addEventListener\('click',[\s\S]*?filterStoreProducts\(button\.getAttribute\('data-store-category'\)\)/);
  assert.doesNotMatch(block, /onclick="filterStoreProducts/);
  assert.doesNotMatch(block, /getAttribute\('onclick'\)/);
  assert.match(source, /function isSafeStoreImageUrl\(value\)/);
  assert.match(block, /isSafeStoreImageUrl\(data\.photoURL\)/);
  assert.match(source, /function getValidStoreCoordinates\(coords\)/);
  assert.match(block, /const storeCoords = getValidStoreCoordinates\(data\.coords\)/);
  assert.doesNotMatch(block, /data\.coords\.(?:lat|lng)/);
});
