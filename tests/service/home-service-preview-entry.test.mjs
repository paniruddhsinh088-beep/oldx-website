import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('Home page exposes a clearly labelled Local Services preview entry', () => {
  assert.match(html, /id="homeServicesPreviewSection"/);
  assert.match(html, /Find Local Services/);
  assert.match(html, /Preview only · Demo data/);
  assert.match(html, /href="\.\/service-preview\.html"/);
});

test('Home page preview entry opens safely in a new tab and does not imply live booking', () => {
  assert.match(html, /href="\.\/service-preview\.html" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /હાલ આ માત્ર ડેમો છે/);
  assert.doesNotMatch(html, /id="homeServicesPreviewSection"[\s\S]{0,1800}?(?:Book now|Book service|બુકિંગ કરો)/i);
});
