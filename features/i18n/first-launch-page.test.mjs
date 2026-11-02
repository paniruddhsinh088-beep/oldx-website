import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import en from './catalogs/en.mjs';
import gu from './catalogs/gu.mjs';
import hi from './catalogs/hi.mjs';

const html = await readFile(new URL('../../language-preview.html', import.meta.url), 'utf8');
const catalogs = [en, gu, hi];

test('first-launch sample has complete translated UI keys in all three catalogs', () => {
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(match => match[1]);
  assert.ok(keys.length >= 9);
  for (const key of keys) {
    for (const catalog of catalogs) {
      assert.equal(Object.hasOwn(catalog, key), true, key);
      assert.equal(typeof catalog[key], 'string', key);
      assert.ok(catalog[key].trim(), key);
    }
  }
  assert.match(gu['onboard.heading'], /\p{Script=Gujarati}/u);
  assert.match(hi['onboard.heading'], /\p{Script=Devanagari}/u);
});

test('picker has explicit native-script choices, accessible controls and a sample-only boundary', () => {
  for (const code of ['gu', 'en', 'hi'])
    assert.match(html, new RegExp('type="radio" name="locale" value="' + code + '"'));
  assert.match(html, /ગુજરાતી/);
  assert.match(html, /हिन्दी/);
  assert.match(html, /id="continue" type="button" disabled/);
  assert.match(html, /id="status" role="status" aria-live="polite"/);
  assert.match(html, /id="ready" hidden tabindex="-1"/);
  assert.match(html, /SAMPLE ONLY/);
  assert.doesNotMatch(html, /https?:\/\/|firebase|XMLHttpRequest|fetch\s*\(|navigator\.geolocation/i);
});
