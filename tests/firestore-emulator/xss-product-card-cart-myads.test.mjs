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

test('My Ads renders product title and price as text and binds actions without inline handlers', () => {
  const block = section('function openMyAdsModal()', 'function toggleAdStockStatus');
  assert.match(block, /\[data-ad-title\]'\)\.textContent\s*=\s*String\(p\.title/);
  assert.match(block, /\[data-ad-price\]'\)\.textContent\s*=\s*String\(p\.finalPriceStr/);
  assert.match(block, /addEventListener\('click',\s*\(\)\s*=>\s*toggleAdStockStatus/);
  assert.doesNotMatch(block, /onclick="[^"]*\$\{p\.docId\}/);
  assert.doesNotMatch(block, /\$\{p\.title\}|\$\{p\.finalPriceStr\}/);
});

test('Saved Ads cart uses text nodes and validated image URLs', () => {
  const block = section('function openCartModal()', 'function removeFromCart');
  assert.match(block, /\[data-cart-title\]'\)\.textContent\s*=\s*String\(title/);
  assert.match(block, /\[data-cart-price\]'\)\.textContent\s*=\s*String\(price/);
  assert.match(block, /addEventListener\('click',[\s\S]*?openProductDetailPage\(id\)/);
  assert.match(block, /\^https\?:/);
  assert.doesNotMatch(block, /\$\{title\}|\$\{price\}|onclick=/);
});

test('Product cards do not interpolate Firestore text, IDs or image URLs into HTML', () => {
  const block = section('function createProductCard(p, isCarousel = false)', '    </script>');
  assert.match(block, /\[data-card-title\]'\)\.textContent\s*=\s*String\(p\.title/);
  assert.match(block, /\[data-card-location\]/);
  assert.match(block, /\[data-card-category\]'\)\.textContent\s*=\s*String\(p\.category/);
  assert.match(block, /addEventListener\('click',[\s\S]*?toggleCartProduct\(p\.docId\)/);
  assert.match(block, /\^https\?:/);
  assert.match(block, /image\.loading\s*=\s*'lazy'/);
  assert.match(block, /image\.decoding\s*=\s*'async'/);
  assert.doesNotMatch(block, /\$\{p\.title\}|\$\{p\.location\}|\$\{p\.category\}|\$\{p\.docId\}|\$\{p\.images/);
});
