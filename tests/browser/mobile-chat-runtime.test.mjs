import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import { chromium } from 'playwright-core';
import { startPreviewServer } from './preview-server.mjs';
import { legacyProductMutationsAcceptance } from '../integration/legacy-product-mutations-cases.mjs';
import { providerChatParityAcceptance } from '../integration/provider-chat-parity-cases.mjs';
import { createEmulatorMarketplaceEnforcement } from '../../scripts/provider-enforcement-adapters.mjs';
import { createIsolatedMarketplaceRepository } from '../../scripts/firebase-marketplace-repository.mjs';
import { createMarketplacePublicHttp } from '../../scripts/marketplace-public-http.mjs';
import { createProductConversationHttp } from '../../scripts/product-conversation-http.mjs';
import { createIsolatedProductConversationRepository } from '../../scripts/firebase-product-conversation-repository.mjs';
import { createProviderConversationHttp } from '../../scripts/provider-conversation-http.mjs';
import { createProviderConversationRepository } from '../../scripts/provider-conversation-repository.mjs';
import { createTrustedInboxHttp } from '../../scripts/trusted-inbox-http.mjs';

const projectId = 'demo-oldx-admin-runtime';
const actors = ['buyer', 'seller', 'foreign', 'journey-buyer', 'journey-provider'];
const password = 'local-test-password';
const asset = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
const authScripts = await Promise.all(['app', 'auth'].map(name => asset('node_modules/firebase/firebase-' + name + '-compat.js')));
const source = await asset('index.html');
const part = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const productPage = '<!doctype html><html lang="en"><style>'
 + '*{box-sizing:border-box}body{margin:8px}input,textarea,select,button{max-width:100%;min-height:44px;font:inherit}'
 + 'button,p,span,h2,legend{overflow-wrap:anywhere}#fullChatMessages{max-height:300px;overflow:auto}'
 + '[hidden],.hidden{display:none!important}</style>'
 + part('<div id="sellWizardPage"', '    <!-- SKELETON LOADING SLIDE VIEW -->')
 + part('<div id="productDetailView"', '    <!-- IMAGE LIGHTBOX')
 + part('<div id="fullChatPage"', '    <!-- SELL FLOW PAGE -->')
 + '<main id="homeView"><input id="searchInput"><div id="productGrid"></div><button id="productNext"></button></main>'
 + '<p id="productPortStatus"></p><section id="inboxModal"><div id="inboxConversationsList"></div><button id="productInboxNext"></button></section><span id="inboxBadgeCount"></span></html>';
let browser, server, origin, environment, admin, verifyFirebaseToken;
let handlers, loseResponse, lastMutation, replayStatus, pending = Promise.resolve();

function forwardAuth(incoming, outgoing) {
  const upstream = request({
    host: '127.0.0.1', port: 9098, path: incoming.url, method: incoming.method,
    headers: { ...incoming.headers, host: '127.0.0.1:9098' }
  }, response => {
    outgoing.writeHead(response.statusCode, response.headers);
    response.pipe(outgoing);
  });
  upstream.on('error', () => outgoing.destroy());
  outgoing.on('close', () => upstream.destroy());
  incoming.pipe(upstream);
}

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9098');
  environment = await initializeTestEnvironment({ projectId });
  admin = initializeApp({ projectId }, 'mobile-chat');
  const adminAuth = getAuth(admin);
  for (const uid of actors) await adminAuth.createUser({ uid, email: uid + '@example.test', password });
  ({ verifyFirebaseToken } = createEmulatorMarketplaceEnforcement({ enabled: true, adminAuth }));
  server = await startPreviewServer(['service-preview.html', 'service-conversation-preview.html'], async (path, req, res) => {
    const sdkFile = /^\/fixture-sdk\/([01])\.js$/.exec(path);
    if (sdkFile) {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(authScripts[Number(sdkFile[1])]);
      return true;
    }
    if (/^\/(?:identitytoolkit|securetoken)\.googleapis\.com\//.test(path)) {
      forwardAuth(req, res);
      return true;
    }
    if (path === '/product-fixture') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(productPage);
      return true;
    }
    const match = /^\/loopback\/(product|market|provider|discovery|enquiry|inbox)\/([\w.]+)$/.exec(path);
    if (!match || !handlers?.[match[1]]) return false;
    try {
      req.setEncoding('utf8');
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 16384) {
          res.writeHead(413).end();
          return true;
        }
      }
      const envelope = { method: req.method, headers: {
        'content-type': req.headers['content-type'] ?? '', authorization: req.headers.authorization ?? ''
      }, body };
      const [,, op] = match;
      // Existing fixture inventories track a single seeded conversation and actor.
      const task = pending.then(() => handlers[match[1]](op, envelope));
      pending = task.catch(() => {});
      const reply = await task;
      res.writeHead(reply.status, reply.headers ?? { 'Content-Type': 'application/json' }).end(JSON.stringify(reply.body));
    } catch (error) {
      console.error('Local Chat fixture failed:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' }).end('{}');
    }
    return true;
  });
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-proxy-server'] });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (admin) await deleteApp(admin);
  await environment?.cleanup();
});

async function bindServer(kind, width, db) {
  const options = { sdk, db, namespace: 'Mobile' + kind + width,
    seed: (c, id, data) => sdk.setDoc(sdk.doc(db, c, id), data) };
  const product = kind === 'product';
  const f = product ? await legacyProductMutationsAcceptance({ ...options, setupOnly: true })
    : await providerChatParityAcceptance({ ...options, setupOnly: true, verifyFirebaseToken });
  const enforcement = { enabled: true, emulatorTokenSyntax: true, verifyFirebaseToken, consumeRateLimit: () => ({ allowed: true }) };
  const chatOptions = { ...enforcement, readStateEnabled: true };
  const chat = product
    ? createProductConversationHttp({ ...chatOptions, createRepository: ({ authenticate }) => createIsolatedProductConversationRepository({ ...f.base, authenticate }) })
    : createProviderConversationHttp({ ...chatOptions, createRepository: ({ authenticate }) => createProviderConversationRepository({ ...f.base, authenticate }) });
  const inbox = createTrustedInboxHttp({ ...enforcement, createRepository: ({ authenticate }) => {
    f.session(authenticate().uid);
    return f.index;
  } });
  const market = product && createMarketplacePublicHttp({ ...enforcement,
    repository: createIsolatedMarketplaceRepository({ ...options, enabled: true, firestore: db, schema: f.m,
      readCursor: f.base.readCursor, issueCursor: f.base.issueCursor }) });
  const handleChat = async (op, req) => {
    const body = JSON.parse(req.body);
    if (op === 'open' || op === 'send') f.clock((body.expectedRevision ?? 0) + 1);
    const result = await chat.handle(op, req);
    if (result.body?.status === 'replayed') replayStatus = result.body.status;
    if (result.body?.ok && ['open', 'send'].includes(op)) {
      lastMutation = { group: kind, op, body };
      if (op === 'open') f.recordThread(result.body.thread.id);
      if (!product) f.recordConversation();
      if (loseResponse) {
        loseResponse = false;
        return { status: 202, body: { ok: false, error: { code: 'OUTCOME_UNKNOWN' } } };
      }
    }
    return result;
  };
  handlers = { [kind]: handleChat, inbox: (op, req) => inbox.handle(op, req) };
  if (product) handlers.market = (op, req) => market.handle(op, req);
  else {
    handlers.discovery = async (op, req) => ({ status: 200, body: await f.f.publicReads[op](JSON.parse(req.body)) });
    handlers.enquiry = async (op, req) => {
      const result = await f.f.http.handle(op, req);
      if (op === 'enquiry.create' && result.body?.ok) f.recordEnquiry(result.body.enquiryId);
      return result;
    };
  }
  return product ? f.c.messages : f.chatSchema.messages;
}

async function openSession(width, locale) {
  const context = await browser.newContext({ viewport: { width, height: 780 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function boot() {
    for (const i of authScripts.keys()) await page.addScriptTag({ url: origin + '/fixture-sdk/' + i + '.js' });
    await page.evaluate(async ({ projectId, locale }) => {
      const { loadTranslator } = await import('/features/i18n/i18n.mjs');
      const { applyCatalog } = await import('/features/i18n/dom.mjs');
      const catalog = await loadTranslator(locale);
      applyCatalog(document, catalog);
      window.translate = key => catalog.t(key);
      window.auth = firebase.initializeApp({ projectId, apiKey: 'fake-key' }).auth();
      auth.useEmulator(location.origin);
      await new Promise(resolve => { const stop = auth.onAuthStateChanged(() => { stop(); resolve(); }); });
      window.syncIdentity = () => {
        const uid = auth.currentUser?.uid;
        return uid ? { uid, sessionId: 'browser-' + uid, revision: 0, generation: 0 } : null;
      };
      // Test transport uses real emulator tokens without changing the staging-only client gate.
      window.localCall = async (group, op, body, { signal, session } = {}) => {
        const user = auth.currentUser;
        const token = ['market', 'discovery'].includes(group) ? null : await user?.getIdToken();
        if (signal?.aborted || user !== auth.currentUser || session && session.uid !== user?.uid) return { status: 401 };
        const response = await fetch('/loopback/' + group + '/' + op, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify(body), signal
        });
        return { status: response.status, body: await response.json() };
      };
    }, { projectId, locale });
  }
  const signIn = uid => page.evaluate(({ uid, password }) =>
    auth.signInWithEmailAndPassword(uid + '@example.test', password).then(() => {}), { uid, password });
  return { context, page, boot, signIn, errors };
}

async function mountChat(client, kind, audience) {
  await client.page.evaluate(async ({ kind, audience }) => {
    const { mountUnifiedInbox } = await import('/features/chat/unified-inbox-dom.mjs');
    if (kind === 'product') {
      const { mountProductIntegration } = await import('/features/marketplace/product-integration-dom.mjs');
      const { createMarketplacePublicClient } = await import('/features/marketplace/public-read-client.mjs');
      const ports = { ...createMarketplacePublicClient({ enabled: true, sendRead: (op, body, ctx) => localCall('market', op, body, ctx) }) };
      for (const op of ['open', 'send', 'thread', 'read', 'acknowledge']) {
        ports[op] = async (body, ctx) => {
          const response = await localCall('product', op, body, ctx);
          return response.status === 200 ? response.body : { ok: false, code: response.body?.error?.code };
        };
      }
      window.chat = mountProductIntegration({ enabled: true, ports, readStateEnabled: true, translate,
        openInbox: () => { document.getElementById('inboxModal').style.display = 'block'; return inbox.open(); } });
    } else {
      const { mountProviderConversation } = await import('/features/service-providers/private-conversation-dom.mjs');
      const host = document.createElement('section');
      host.id = 'inboxModal';
      host.innerHTML = '<div id="inboxConversationsList"></div><button id="productInboxNext"></button>';
      document.body.prepend(host);
      document.body.prepend(Object.assign(document.createElement('span'), { id: 'inboxBadgeCount' }));
      window.chat = mountProviderConversation({ enabled: true, audience, translate,
        openInbox: () => { history.replaceState(null, '', location.pathname); chat.restoreRoute(); host.style.display = 'block'; return inbox.open(); },
        messaging: { enabled: true, readStateEnabled: true, execute: (op, body, ctx) => localCall('provider', op, body, ctx) } });
    }
    window.inbox = mountUnifiedInbox({ enabled: true, translate, loadPage: (body, ctx) => localCall('inbox', 'page', body, ctx),
      openConversation: row => {
        document.getElementById('inboxModal').style.display = 'none';
        return kind === 'product' ? chat.navigate('thread', row.threadId) : chat.open({ providerId: row.providerId, enquiryId: row.threadId });
      } });
    window.setChatSession = () => Promise.all([chat.setSession(syncIdentity()), inbox.setSession(syncIdentity())]);
    await setChatSession();
    if (kind === 'product' && !location.hash) await chat.model.discover();
  }, { kind, audience });
}

const badge = (page, count) => page.waitForFunction(value => document.getElementById('inboxBadgeCount').textContent === value, String(count));
const expectMessage = (page, selector, text) => page.waitForFunction(({ selector, text }) =>
  document.querySelector(selector)?.textContent.includes(text), { selector, text });

for (const [width, locale] of [[320, 'gu'], [375, 'hi']]) for (const kind of ['product', 'provider']) {
  test('local Auth and Firestore mobile ' + kind + ' Chat ' + width, { timeout: 90000 }, async () => {
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore()._delegate;
      const messageCollection = await bindServer(kind, width, db);
      const a = await openSession(width, locale), b = await openSession(width, locale);
      const product = kind === 'product', buyer = a.page, seller = b.page;
      const route = product ? '/product-fixture' : '/service-conversation-preview.html';
      const messages = product ? '#fullChatMessages' : '#messages';
      const input = product ? '#fullChatInput' : '#messageDraft';
      const send = product ? '#chatSendButton' : '#previewDraft';
      const retry = product ? '#productChatRetry' : '#conversationRetryCommand';
      const row = '[data-conversation-kind="' + kind + '"]';
      try {
        await seller.goto(origin + route);
        await b.boot(); await b.signIn(product ? 'seller' : 'journey-provider');
        await mountChat(b, kind, 'provider');
        await badge(seller, 0);
        if (product) {
          await buyer.goto(origin + route);
          await a.boot(); await a.signIn('buyer'); await mountChat(a, kind, 'buyer');
          await buyer.locator('#productGrid [data-product-id]').click();
          await buyer.locator('#productEnquire').click();
        } else {
          await buyer.goto(origin + '/service-preview.html#services');
          await a.boot(); await a.signIn('journey-buyer');
          await buyer.evaluate(async () => {
            const { configureProviderIntegration } = await import('/features/service-providers/service-preview.mjs');
            const binding = configureProviderIntegration({ enabled: true,
              reads: Object.fromEntries(['discover', 'detail'].map(op => [op, (body, ctx) => localCall('discovery', op, body, ctx).then(r => r.body)])),
              buyer: { commands: { execute: (op, body, ctx) => localCall('enquiry', op, body, ctx) } },
              openPrivateEnquiry: ({ providerId, enquiryId }) => location.assign('/service-conversation-preview.html#conversation/buyer/' + providerId + '/' + enquiryId) });
            binding.setSession(syncIdentity());
          });
          await buyer.locator('#results [data-provider-id]').first().click();
          await buyer.locator('#enquiryService').selectOption('Repair');
          await buyer.locator('#enquiryDescription').fill('Local enquiry');
          await buyer.locator('#sampleEnquiryForm button[type=submit]').click();
          await buyer.locator('#trustedEnquiryLink').click();
          await buyer.waitForURL('**/service-conversation-preview.html#conversation/buyer/**');
          await a.boot(); await mountChat(a, kind, 'buyer');
        }
        const first = 'ખરીદદારનો સંદેશ ' + width, reply = 'विक्रेता का जवाब ' + width;
        await buyer.locator(input).fill(first);
        await buyer.locator(send).click();
        await expectMessage(buyer, messages, first);
        const back = product ? '[onclick="closeFullChatPage()"]' : '#inboxLink';
        await buyer.locator(back).click();
        await seller.evaluate(() => inbox.open());
        await badge(seller, 1);
        await seller.locator(row).click();
        await expectMessage(seller, messages, first);
        await badge(seller, 0);
        await seller.locator(input).fill(reply);
        loseResponse = true; replayStatus = null;
        await seller.locator(send).click();
        await seller.locator(retry).click();
        await expectMessage(seller, messages, reply);
        assert.equal(replayStatus, 'replayed');
        const duplicate = await seller.evaluate(({ group, op, body }) => localCall(group, op, body), lastMutation);
        assert.equal(duplicate.body.status, 'replayed');
        const conflict = await seller.evaluate(({ group, op, body }) =>
          localCall(group, op, { ...body, text: 'Different text using the same request ID' }), lastMutation);
        assert.equal(conflict.status, 409);
        assert.equal(await seller.locator(messages).getByText(reply, { exact: true }).count(), 1);
        await seller.locator(back).click();
        await seller.locator(row).click();
        await expectMessage(seller, messages, reply);
        await buyer.evaluate(() => inbox.open());
        await badge(buyer, 1);
        await buyer.locator(row).click();
        await expectMessage(buyer, messages, reply);
        await badge(buyer, 0);
        await buyer.reload(); await a.boot(); await mountChat(a, kind, 'buyer');
        await expectMessage(buyer, messages, reply);
        await badge(buyer, 0);
        const overflow = await buyer.evaluate(() => ({
          width: innerWidth, document: document.documentElement.scrollWidth,
          elements: [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 6).map(node => node.id || node.tagName)
        }));
        assert.ok(overflow.document <= overflow.width + 1, JSON.stringify(overflow));
        await a.signIn('foreign');
        await buyer.evaluate(() => setChatSession());
        assert.equal(await buyer.locator(messages).textContent(), '');
        assert.equal(await buyer.locator(row).count(), 0);
        const outsider = await buyer.evaluate(({ group, body }) => {
          const scope = group === 'product' ? { threadId: body.threadId }
            : { providerId: body.providerId, enquiryId: body.enquiryId };
          return localCall(group, 'read', { ...scope, expectedRevision: 2, afterSequence: 0, limit: 20 });
        }, lastMutation);
        assert.equal(outsider.status, 403);
        await buyer.evaluate(async () => { await auth.signOut(); await setChatSession(); });
        await badge(buyer, '');
        const stored = await sdk.getDocsFromServer(sdk.collection(db, messageCollection));
        assert.deepEqual(stored.docs.map(doc => doc.data().text).sort(), [first, reply].sort());
        assert.deepEqual([...a.errors, ...b.errors], []);
      } catch (error) {
        throw new Error(kind + ' browser errors: ' + JSON.stringify([...a.errors, ...b.errors]), { cause: error });
      } finally {
        await Promise.all([a.context.close(), b.context.close()]);
        handlers = null;
      }
    });
  });
}
