import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { chromium } from 'playwright-core';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-oldx-saved-products';
const firestoreHost = '127.0.0.1:8088';
const authHost = '127.0.0.1:9098';
const source = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const sdkFiles = ['app', 'auth', 'firestore'].map(name => 'firebase-' + name + '-compat.js');
const part = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, start);
  return source.slice(from, to);
};
const functions = part('function getSavedAdsStorageKey()', 'function triggerPushNotification(')
  + part('async function saveAdMembership(', 'function closeCartModal()')
  + part('function createProductCard(', '    </script>');
let environment, server, browser, origin;

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, firestoreHost);
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, authHost);
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1', port: 8088,
      rules: `rules_version = '2'; service cloud.firestore {
        match /databases/{database}/documents {
          match /users/{uid} {
            allow read: if request.auth.uid == uid;
            allow create: if request.auth.uid == uid && request.resource.data.keys().hasOnly(['savedAds']);
            allow update: if request.auth.uid == uid
              && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['savedAds'])
              && !resource.data.get('paused', false);
          }
        }
      }`
    }
  });
  // Serve the fixture and forward only emulator SDK paths on the same origin.
  server = createServer((incoming, outgoing) => {
    const path = incoming.url;
    if (path === '/fixture') {
      outgoing.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      outgoing.end('<!doctype html><html lang="en"><main id="cards"></main></html>');
      return;
    }
    const authRequest = /^\/(?:identitytoolkit|securetoken)\.googleapis\.com\//.test(path);
    const firestoreRequest = path.startsWith('/google.firestore.v1.Firestore/')
      || path.startsWith('/v1/projects/' + projectId + '/databases/');
    const port = authRequest ? 9098 : firestoreRequest ? 8088 : null;
    if (!port) {
      outgoing.writeHead(404).end();
      return;
    }
    const upstream = request({
      host: '127.0.0.1', port, path, method: incoming.method,
      headers: { ...incoming.headers, host: '127.0.0.1:' + port }
    }, response => {
      outgoing.writeHead(response.statusCode, response.headers);
      response.pipe(outgoing);
    });
    upstream.on('error', () => outgoing.destroy());
    outgoing.on('close', () => upstream.destroy());
    incoming.pipe(upstream);
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-proxy-server'] });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await environment?.cleanup();
});

async function session() {
  const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
  const errors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(new URL(request.url()).pathname + ': ' + request.failure()?.errorText));
  await page.goto(origin + '/fixture');
  async function boot() {
    for (const file of sdkFiles) {
      await page.addScriptTag({ content: await readFile(new URL('../../node_modules/firebase/' + file, import.meta.url), 'utf8') });
    }
    await page.addScriptTag({ content: `
      firebase.initializeApp({projectId:${JSON.stringify(projectId)},apiKey:'fake-key'});
      const auth = firebase.auth();
      auth.useEmulator(location.origin);
      const db = firebase.firestore();
      db.useEmulator('127.0.0.1', Number(location.port));
      let userSavedAdsUnsubscribe = null, savedAdsGuestImport = false, currentProduct = null;
      const pendingSavedAds = new Set();
      const products = ['old', 'new', 'guest', 'recovery', 'pending'].map(docId => ({docId, title: docId}));
      window.alerts = [];
      const showCustomAlert = (...args) => alerts.push(args), triggerPushNotification = () => {};
      const updateProfileDetails = () => {}, renderRecentlyViewed = () => {};
      function renderProducts() {
        document.getElementById('cards').replaceChildren(...products.map(p => {
          const card = createProductCard(p);
          card.dataset.product = p.docId;
          return card;
        }));
      }
      ${functions}
      auth.onAuthStateChanged(user => {
        window.currentUser = user;
        if (user) {
          startRealtimeSavedAdsSync(user);
          importGuestSavedAds(user);
        } else {
          userSavedAdsUnsubscribe?.();
        }
        renderProducts();
      });
    ` });
  }
  await boot();
  return { context, page, boot, errors };
}

const email = name => name + '@example.test';
const password = 'fixture-password';
const signIn = (page, name) => page.evaluate(({ email, password }) =>
  auth.signInWithEmailAndPassword(email, password).then(() => {}), { email: email(name), password });
const signOut = page => page.evaluate(() => auth.signOut());
const createUser = (page, name) => page.evaluate(({ email, password }) =>
  auth.createUserWithEmailAndPassword(email, password).then(result => result.user.uid), { email: email(name), password });
const clickHeart = (page, id) => page.locator('[data-product="' + id + '"] [data-save-button]').click();
const heart = (page, id, saved) => page.waitForFunction(({ id, saved }) => {
  const icon = document.querySelector('[data-product="' + id + '"] [data-heart-icon]');
  return icon && icon.classList.contains(saved ? 'text-red-500' : 'text-gray-400');
}, { id, saved });

test('Saved Products converge across two browser contexts using local Auth and Firestore', { timeout: 90_000 }, async () => {
  const a = await session();
  const b = await session();
  try {
    await a.page.evaluate(() => localStorage.setItem('oldx_saved_ads_guest', '["guest"]'));
    const uid = await createUser(a.page, 'owner');
    await heart(a.page, 'guest', true);
    await a.page.waitForFunction(() => localStorage.getItem('oldx_saved_ads_guest') === null);
    await signIn(b.page, 'owner');
    await heart(b.page, 'guest', true);
    await clickHeart(a.page, 'old');
    await heart(b.page, 'old', true);
    await Promise.all([clickHeart(a.page, 'new'), clickHeart(b.page, 'old')]);
    for (const { page } of [a, b]) {
      await heart(page, 'old', false);
      await heart(page, 'new', true);
    }

    await b.page.evaluate(uid => localStorage.setItem('oldx_saved_ads_' + uid, '[]'), uid);
    await b.page.reload();
    await b.boot();
    await heart(b.page, 'new', true);
    await heart(b.page, 'old', false);
    await signOut(b.page);
    await createUser(b.page, 'other');
    await heart(b.page, 'new', false);
    await heart(b.page, 'guest', false);
    await signOut(b.page);
    await signIn(b.page, 'owner');
    await heart(b.page, 'new', true);

    const pause = value => environment.withSecurityRulesDisabled(async context =>
      context.firestore().doc('users/' + uid).set({ paused: value }, { merge: true }));
    await pause(true);
    await clickHeart(a.page, 'recovery');
    await a.page.waitForFunction(() => alerts.at(-1)?.[2] === 'error');
    await heart(a.page, 'recovery', false);
    await heart(b.page, 'recovery', false);
    await pause(false);
    await clickHeart(a.page, 'recovery');
    await heart(a.page, 'recovery', true);
    await heart(b.page, 'recovery', true);

    await a.page.evaluate(() => {
      const run = db.runTransaction.bind(db);
      db.runTransaction = callback => run(transaction => callback({
        async get(ref) {
          const value = await transaction.get(ref);
          await new Promise(resolve => { window.resumeSavedRead = resolve; });
          return value;
        },
        set: (...args) => transaction.set(...args)
      }));
    });
    await clickHeart(a.page, 'pending');
    await a.page.waitForFunction(() => typeof resumeSavedRead === 'function');
    await signOut(a.page);
    await a.page.waitForFunction(() => currentUser === null);
    await a.page.evaluate(() => resumeSavedRead());
    await a.page.waitForFunction(() => pendingSavedAds.size === 0);
    await signIn(a.page, 'other');
    await heart(a.page, 'pending', false);
    await environment.withSecurityRulesDisabled(async context => {
      const snap = await context.firestore().doc('users/' + uid).get();
      assert.deepEqual(snap.data().savedAds.map(item => typeof item === 'string' ? item : item.docId).sort(), ['guest', 'new', 'recovery']);
    });
    assert.deepEqual([...a.errors, ...b.errors].filter(error => !error.endsWith('net::ERR_ABORTED')), []);
  } catch (error) {
    throw new Error(JSON.stringify([...a.errors, ...b.errors]), { cause: error });
  } finally {
    await Promise.all([a.context.close(), b.context.close()]);
  }
});
