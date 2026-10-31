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

test('Edit Ad preview gives each valid photo its own accessible remove control', () => {
  const block = section('function renderEditImagesPreview()', 'function closeEditAdPage()');
  assert.match(block, /window\.currentEditingImages/);
  assert.match(block, /removeBtn\.setAttribute\('aria-label'/);
  assert.match(block, /removeBtn\.addEventListener\('click',[\s\S]*?removeCurrentEditImage\(index\)/);
  assert.match(block, /function removeCurrentEditImage\(index\)/);
  assert.match(block, /window\.currentEditingImages\.splice\(index, 1\)/);
  assert.match(block, /renderEditImagesPreview\(\)/);
  assert.doesNotMatch(block, /innerHTML\s*=/);
});

test('Photo removals are staged locally and persisted only by the existing Save Changes update', () => {
  const block = section('async function handleEditAdSubmit(e)', 'function checkUserPinStatus(user)');
  assert.match(block, /let updatedImages = Array\.isArray\(window\.currentEditingImages\)/);
  assert.match(block, /await db\.collection\('products'\)\.doc\(docId\)\.update\([\s\S]*?images: updatedImages/);
  assert.match(block, /if \(newImgInput\.files && newImgInput\.files\.length > 0\)/);
  assert.match(block, /updatedImages = replacementImages/);
});

test('Opening Edit Ad resets pending file selection and stages a copy of saved photos', () => {
  const block = section('async function renderEditAdView(docId)', 'function renderEditImagesPreview()');
  assert.match(block, /newImgInput\.value = ''/);
  assert.match(block, /window\.currentEditingImages = Array\.isArray\(p\.images\) \? \[\.\.\.p\.images\]/);
  assert.match(block, /renderEditImagesPreview\(\)/);
});
