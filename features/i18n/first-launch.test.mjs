import test from 'node:test';
import assert from 'node:assert/strict';
import { createFirstLaunchLanguageFlow } from './first-launch.mjs';
import { LOCALE_STORAGE_KEY } from './preference.mjs';

const translator = locale => ({ locale, t: key => locale + ':' + key });
const storage = initial => {
  const entries = new Map(initial ? [[LOCALE_STORAGE_KEY, initial]] : []);
  const writes = [];
  return { entries, writes,
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); entries.set(key, value); },
  };
};

test('first launch does not infer or persist a language before explicit selection', async () => {
  const store = storage();
  const flow = createFirstLaunchLanguageFlow({ storage: store, load: async code => translator(code) });
  assert.equal(flow.initialLocale, null);
  assert.equal(flow.needsChoice, true);
  assert.deepEqual(store.writes, []);
  const result = await flow.select('gu');
  assert.equal(result.ok, true);
  assert.equal(result.persisted, true);
  assert.deepEqual(store.writes, [[LOCALE_STORAGE_KEY, 'gu']]);
  assert.equal(result.translator.t('onboard.heading'), 'gu:onboard.heading');
});

test('returning visitors keep an allowlisted private local choice; corrupt values show picker', () => {
  for (const code of ['gu', 'en', 'hi']) {
    const flow = createFirstLaunchLanguageFlow({ storage: storage(code) });
    assert.equal(flow.initialLocale, code);
    assert.equal(flow.needsChoice, false);
  }
  for (const invalid of ['fr', 'EN', '../admin', '__proto__', '', 'hi-IN']) {
    const flow = createFirstLaunchLanguageFlow({ storage: storage(invalid) });
    assert.equal(flow.initialLocale, null);
    assert.equal(flow.needsChoice, true);
  }
});

test('unsupported, forged or missing choices never load or persist', async () => {
  const store = storage();
  let loads = 0;
  const flow = createFirstLaunchLanguageFlow({ storage: store, load: async code => { loads++; return translator(code); } });
  for (const invalid of ['fr', '../secret', '__proto__', null, {}, 'GU']) {
    assert.deepEqual(await flow.select(invalid), { ok: false, reason: 'invalid' });
  }
  assert.equal(loads, 0);
  assert.deepEqual(store.writes, []);
});

test('denied storage still allows a non-persistent local language choice', async () => {
  const flow = createFirstLaunchLanguageFlow({ storage: {
    getItem() { throw Error('blocked'); },
    setItem() { throw Error('denied'); },
  }, load: async code => translator(code) });
  assert.equal(flow.needsChoice, true);
  const result = await flow.select('hi');
  assert.equal(result.ok, true);
  assert.equal(result.locale, 'hi');
  assert.equal(result.translator.locale, 'hi');
  assert.equal(result.persisted, false);
});

test('failed catalog loading or malformed translator never saves the choice', async () => {
  const store = storage();
  const broken = createFirstLaunchLanguageFlow({ storage: store, load: async () => { throw Error('offline'); } });
  assert.deepEqual(await broken.select('hi'), { ok: false, reason: 'unavailable' });
  const forged = createFirstLaunchLanguageFlow({ storage: store, load: async () => translator('en') });
  assert.deepEqual(await forged.select('gu'), { ok: false, reason: 'unavailable' });
  assert.deepEqual(store.writes, []);
});

test('late async language results cannot replace or persist the latest choice', async () => {
  const store = storage();
  const pending = new Map();
  const flow = createFirstLaunchLanguageFlow({ storage: store, load: code => new Promise(resolve => pending.set(code, resolve)) });
  const first = flow.select('gu');
  const second = flow.select('hi');
  pending.get('hi')(translator('hi'));
  assert.equal((await second).ok, true);
  pending.get('gu')(translator('gu'));
  assert.deepEqual(await first, { ok: false, reason: 'stale' });
  assert.deepEqual(store.writes, [[LOCALE_STORAGE_KEY, 'hi']]);
});

test('navigation cancellation invalidates pending selection without writing storage', async () => {
  const store = storage();
  let resolve;
  const flow = createFirstLaunchLanguageFlow({ storage: store, load: () => new Promise(r => { resolve = r; }) });
  const pending = flow.select('gu');
  flow.cancelPending();
  resolve(translator('gu'));
  assert.deepEqual(await pending, { ok: false, reason: 'stale' });
  assert.deepEqual(store.writes, []);
});

test('restoring a saved language does not write storage and handles failed loads', async () => {
  const store = storage('hi');
  const flow = createFirstLaunchLanguageFlow({ storage: store, load: async code => translator(code) });
  const restored = await flow.restore();
  assert.equal(restored.ok, true);
  assert.equal(restored.locale, 'hi');
  assert.deepEqual(store.writes, []);
  const missing = createFirstLaunchLanguageFlow({ storage: storage(), load: async code => translator(code) });
  assert.deepEqual(await missing.restore(), { ok: false, reason: 'missing' });
  const failed = createFirstLaunchLanguageFlow({ storage: store, load: async () => { throw Error('offline'); } });
  assert.deepEqual(await failed.restore(), { ok: false, reason: 'unavailable' });
});
