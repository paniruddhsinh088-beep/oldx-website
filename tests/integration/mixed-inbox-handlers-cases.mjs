import assert from 'node:assert/strict';
import { createUnifiedInbox } from '../../features/chat/unified-inbox.mjs';
import { createIsolatedProductConversationRepository } from '../../scripts/firebase-product-conversation-repository.mjs';
import { createProductConversationHttp } from '../../scripts/product-conversation-http.mjs';
import { createProviderConversationRepository } from '../../scripts/provider-conversation-repository.mjs';
import { createProviderConversationHttp } from '../../scripts/provider-conversation-http.mjs';
import { createProviderDiscoveryCursorCodec } from '../../scripts/provider-discovery-cursor.mjs';
import { createIsolatedTrustedInboxIndex } from '../../scripts/trusted-inbox-index.mjs';
import { createTrustedInboxHttp } from '../../scripts/trusted-inbox-http.mjs';
import { reconcileInboxHistory } from '../../scripts/inbox-history-reconciliation.mjs';
import { legacyProductMutationsAcceptance } from './legacy-product-mutations-cases.mjs';
import { providerChatParityAcceptance } from './provider-chat-parity-cases.mjs';

export async function mixedInboxHandlersAcceptance({ sdk, db, seed }) {
  const buyer = 'journey-buyer', seller = 'seller', provider = 'journey-provider';
  const actors = [buyer, seller, provider, 'foreign'];
  const schema = { heads: 'testOldxMixedHandlerHeads', rows: 'testOldxMixedHandlerRows' };
  const codec = createProviderDiscoveryCursorCodec({ key: new Uint8Array(32).fill(67) });
  const read = async (tx, collection, id) => (await tx.get(sdk.doc(db, collection, id))).data();
  const knownThreads = [];
  let product, service;
  const facts = (tx, row) => (row.kind === 'product' ? product : service).facts(tx, row);
  const index = createIsolatedTrustedInboxIndex({
    enabled: true, firestore: db, sdk, schema, ...codec,
    authenticate: credential => actors.includes(credential) ? { uid: credential } : null,
    authenticateMaintenance: () => ({ uid: 'test-maintenance' }),
    // The test owns the full synthetic inventory. Live inventory proof is a separate binding.
    async verifyInventory(tx, uid) {
      const head = await read(tx, schema.heads, uid);
      let threadCount = 0;
      for (const thread of knownThreads) {
        const source = await facts(tx, thread);
        if (!source) return null;
        if (source.participants.includes(uid)) threadCount++;
      }
      return { complete: true, empty: threadCount === 0, epoch: head?.inventoryEpoch ?? 'initial', threadCount };
    },
    resolveHistory: facts,
    async authorizeIndex(tx, uid) {
      const listingActor = await read(tx, product.c.actors, uid);
      const serviceActor = await read(tx, service.f.c.actors, uid);
      return Boolean(listingActor?.suspended === false && listingActor.canInteract
        || serviceActor?.suspended === false && serviceActor.canEnquire);
    },
    async authorizeRow(tx, row) {
      const source = await facts(tx, row.item);
      const view = source && reconcileInboxHistory(source).views?.find(item => item.actorUid === row.actorUid);
      return Boolean(view && view.visible === row.visible
        && Object.entries(view.item).every(([key, value]) => row.item[key] === value));
    }
  });
  product = await legacyProductMutationsAcceptance({ sdk, db, seed, namespace: 'MixedHandlerProduct', setupOnly: true, sharedIndex: index, buyerUid: buyer });
  service = await providerChatParityAcceptance({ sdk, db, seed, namespace: 'MixedHandlerProvider', setupOnly: true, sharedIndex: index });
  const options = {
    enabled: true, readStateEnabled: true, reconciledHistoryEnabled: true, legacyMutationsEnabled: true,
    verifyFirebaseToken: token => {
      const uid = actors.find(actor => token === actor + '.fixture.token');
      return uid ? { uid } : null;
    },
    consumeRateLimit: () => ({ allowed: true })
  };
  const listings = createProductConversationHttp({ ...options, createRepository: ({ authenticate }) =>
    createIsolatedProductConversationRepository({ ...product.base, ...options, authenticate }) });
  const providers = createProviderConversationHttp({ ...options, createRepository: ({ authenticate }) =>
    createProviderConversationRepository({ ...service.base, ...options, authenticate }) });
  const inbox = createTrustedInboxHttp({ ...options, createRepository: ({ authenticate }) =>
    ({ page: (body, context) => index.page(body, { ...context, credential: authenticate().uid }) }) });
  const call = (api, uid, op, body) => api.handle(op, {
    method: 'POST', headers: { authorization: 'Bearer ' + uid + '.fixture.token', 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const ok = async (...args) => {
    const result = await call(...args);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  const page = uid => ok(inbox, uid, 'page', { limit: 20, cursor: null, snapshotId: null });
  product.clock(1);
  const opened = await ok(listings, buyer, 'open', { productId: 'product', expectedProductRevision: 1, requestId: 'product-open', text: 'Product question' });
  const threadId = opened.thread.id;
  knownThreads.push({ kind: 'product', threadId });
  service.f.uid(buyer);
  const enquiry = await service.f.execute('enquiry.create', {
    requestId: 'provider-enquiry', providerId: service.f.providerId, expectedPublicationGeneration: 1,
    service: 'Repair', description: 'Service enquiry', timing: 'flexible'
  });
  assert.equal(enquiry.status, 200, JSON.stringify(enquiry.body));
  const scope = { providerId: service.f.providerId, enquiryId: enquiry.body.enquiryId };
  service.recordEnquiry(scope.enquiryId);
  const providerSend = { ...scope, expectedEnquiryRevision: 0, expectedGeneration: 1 };
  await ok(providers, buyer, 'send', { ...providerSend, expectedRevision: 0, requestId: 'provider-open', text: 'Service question' });
  knownThreads.push({ kind: 'provider', threadId: scope.enquiryId });
  product.clock(2);
  service.clock(2);
  await ok(listings, seller, 'send', { threadId, expectedRevision: 1, requestId: 'product-reply', text: 'Product reply' });
  await ok(providers, provider, 'send', { ...providerSend, expectedRevision: 1, requestId: 'provider-reply', text: 'Service reply' });

  const client = createUnifiedInbox({ enabled: true, loadPage: (body, context) => call(inbox, context.session.uid, 'page', body) });
  client.setSession({ uid: buyer, sessionId: 'mixed-buyer' });
  await client.refresh();
  assert.deepEqual(client.snapshot().items.map(row => row.kind), ['product', 'provider']);
  assert.equal(client.snapshot().totalUnread, 2);
  assert.deepEqual((await page(seller)).items.map(row => row.kind), ['product']);
  assert.deepEqual((await page(provider)).items.map(row => row.kind), ['provider']);

  const history = { expectedRevision: 2, afterSequence: 0, limit: 20 };
  const listingHistory = await ok(listings, buyer, 'read', { threadId, ...history });
  const serviceHistory = await ok(providers, buyer, 'read', { ...scope, ...history });
  assert.ok(listingHistory.readReceipt && serviceHistory.readReceipt);
  assert.equal((await call(listings, 'foreign', 'read', { threadId, ...history })).status, 403);
  assert.equal((await call(providers, 'foreign', 'read', { ...scope, ...history })).status, 403);
  await ok(listings, buyer, 'acknowledge', { threadId, readReceipt: listingHistory.readReceipt });
  await client.refreshAfterRead();
  assert.equal(client.snapshot().totalUnread, 1);
  assert.deepEqual(client.snapshot().items.map(row => [row.kind, row.unreadCount]), [['provider', 1], ['product', 0]]);
  await ok(providers, buyer, 'acknowledge', { ...scope, readReceipt: serviceHistory.readReceipt });
  await client.refreshAfterRead();
  assert.equal(client.snapshot().totalUnread, 0);

  product.clock(3);
  await ok(listings, seller, 'send', { threadId, expectedRevision: 2, requestId: 'product-new', text: 'Hide this unread message' });
  assert.equal((await page(buyer)).totalUnread, 1);
  const hide = { threadId, expectedRevision: 3, requestId: 'product-hide', sequence: 3, action: 'hide_for_self' };
  assert.equal((await call(listings, buyer, 'changeVisibility', hide)).status, 404);
  // Product privacy remains available only through the isolated repository.
  const listingMaintenance = createIsolatedProductConversationRepository({
    ...product.base, ...options, authenticate: () => ({ uid: buyer })
  });
  assert.equal((await listingMaintenance.changeVisibility(hide)).status, 'changed');
  await client.refresh();
  assert.equal(client.snapshot().status, 'unavailable');
  assert.equal(client.snapshot().totalUnread, null);
  assert.deepEqual(client.snapshot().items, []);
  assert.equal((await index.reconcile(knownThreads[0])).ok, true);
  assert.equal((await index.finalize({ actorUid: buyer })).code, 'INVENTORY_REQUIRED');
  assert.equal((await index.reconcile(knownThreads[1])).ok, true);
  assert.equal((await index.finalize({ actorUid: buyer })).ok, true);
  assert.equal((await index.finalize({ actorUid: seller })).ok, true);
  await client.refresh();
  assert.equal(client.snapshot().totalUnread, 0);
  assert.equal(client.snapshot().items.length, 2);
  assert.equal(client.snapshot().items.find(row => row.kind === 'product').preview, 'Product reply');

  service.clock(3);
  await ok(providers, provider, 'send', { ...providerSend, expectedRevision: 2, requestId: 'provider-new', text: 'Unread service reply' });
  assert.equal((await page(buyer)).totalUnread, 1);
  await ok(providers, buyer, 'changeBlock', { ...scope, requestId: 'provider-block', expectedRevision: 3, expectedBlocked: false, blocked: true });
  await client.refresh();
  assert.equal(client.snapshot().totalUnread, null);
  assert.equal((await index.reconcile(knownThreads[1])).ok, true);
  assert.equal((await index.finalize({ actorUid: buyer })).code, 'INVENTORY_REQUIRED');
  assert.equal((await index.reconcile(knownThreads[0])).ok, true);
  assert.equal((await index.finalize({ actorUid: buyer })).ok, true);
  await client.refresh();
  assert.equal(client.snapshot().totalUnread, 0);
  assert.deepEqual(client.snapshot().items.map(row => row.kind), ['product']);
  client.setSession({ uid: seller, sessionId: 'mixed-seller' });
  assert.deepEqual(client.snapshot().items, []);
  await client.refresh();
  assert.deepEqual(client.snapshot().items.map(row => row.kind), ['product']);
  client.setSession(null);
  assert.deepEqual(client.snapshot().items, []);
  assert.equal(client.snapshot().totalUnread, null);
}
