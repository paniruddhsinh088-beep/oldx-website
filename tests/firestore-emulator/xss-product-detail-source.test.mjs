import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('Product detail highlights render dynamic labels and values as text', () => {
  const start = source.indexOf("const grid = document.getElementById('detailHighlightsGrid');");
  const end = source.indexOf("const phone = p.phone", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);
  assert.match(block, /label\.textContent\s*=\s*String\(detailKey\)/);
  assert.match(block, /value\.textContent\s*=\s*String\(detailValue\)/);
  assert.doesNotMatch(block, /\$\{detailKey\}|\$\{detailValue\}/);
});

test('Product detail image URLs reject non-http and non-raster data schemes', () => {
  const start = source.indexOf("const safeProductImages = Array.isArray(p.images)");
  const end = source.indexOf("const imageBadge =", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = source.slice(start, end);
  assert.match(block, /\^https\?:/);
  assert.match(block, /data:image\\\/(?:png\|jpeg\|webp\|gif\);base64/);
  assert.match(block, /image\.src\s*=\s*trimmedImage/);
});
