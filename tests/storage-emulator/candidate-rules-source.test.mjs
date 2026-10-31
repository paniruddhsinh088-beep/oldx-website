import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = await readFile(new URL('./candidate.rules', import.meta.url), 'utf8');

test('candidate product Storage rules are scoped to seller-owned product media paths', () => {
  assert.match(rules, /match \/product-media\/{uid}\/{productId}\/{fileName}/);
  assert.match(rules, /request\.auth\.uid == uid/);
  assert.match(rules, /productId\.matches/);
  assert.match(rules, /fileName\.matches/);
});

test('candidate product Storage rules accept only bounded raster image uploads as pending', () => {
  assert.match(rules, /request\.resource\.size < 10 \* 1024 \* 1024/);
  assert.match(rules, /image\/\(jpeg\|png\|webp\)/);
  assert.match(rules, /request\.resource\.metadata\.moderationStatus == 'pending'/);
});

test('candidate product Storage rules prevent client approval and pending-file reads', () => {
  assert.match(rules, /allow read: if resource\.metadata\.moderationStatus == 'approved'/);
  assert.match(rules, /allow update: if false/);
  assert.match(rules, /allow delete: if isOwner\(\)\s*&&\s*resource\.metadata\.moderationStatus == 'pending'/);
  assert.match(rules, /allow read, write: if false/);
});
