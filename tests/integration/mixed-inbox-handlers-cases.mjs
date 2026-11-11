import assert from 'node:assert/strict';
import { compareInboxRows, createUnifiedInbox } from '../../features/chat/unified-inbox.mjs';
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

export async function mixedInboxHandlersAcceptance({ sdk, db, seed, verifyFirebaseToken, credentials }) {
  const buyer = 'journey-buyer', seller = 'seller', provider = 'journey-provider', outsider = 'mixed-outsider';
  const actors = [buyer, seller, provider, outsider];
  const schema = { heads: 'testOldxMixedHandlerHeads', rows: 'testOldxMixedHandlerRows' };
  const codec = createProviderDiscoveryCursorCodec({ key: new Uint8Array(32).fill(67) });
  const read = async (tx, collection, id) => (await tx.get(sdk.doc(db, collection, id))).data();
  const knownThreads = [];
  let product, service, pausePage;
  const facts = (tx, row) => (row.kind === 'product' ? product : service).facts(tx, row);
  const index = createIsolatedTrustedInboxIndex({
    enabled: true, firestore: db, schema, ...codec,
    sdk: { ...sdk, async getDocsFromServer(query) {
      const snapshot = await sdk.getDocsFromServer(query);
      if (pausePage) {
        const { started, resume } = pausePage;
        pausePage = null;
        started();
        await resume;
      }
      return snapshot;
    } },
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
  service = await providerChatParityAcceptance({ sdk, db, seed, namespace: 'MixedHandlerProvider', setupOnly: true, sharedIndex: index, verifyFirebaseToken });
  await seed(product.c.actors, outsider, { uid: outsider, canInteract: true, suspended: false });
  await seed(service.f.c.actors, outsider, { uid: outsider, canEnquire: true, suspended: false });
  const options = {
    enabled: true, readStateEnabled: true, reconciledHistoryEnabled: true, legacyMutationsEnabled: true,
    emulatorTokenSyntax: Boolean(verifyFirebaseToken),
    verifyFirebaseToken: verifyFirebaseToken ?? (token => {
      const uid = actors.find(actor => token === actor + '.fixture.token');
      return uid ? { uid } : null;
    }),
    consumeRateLimit: () => ({ allowed: true })
  };
  const listings = createProductConversationHttp({ ...options, createRepository: ({ authenticate }) =>
    createIsolatedProductConversationRepository({ ...product.base, ...options, authenticate }) });
  const providers = createProviderConversationHttp({ ...options, createRepository: ({ authenticate }) =>
    createProviderConversationRepository({ ...service.base, ...options, authenticate }) });
  const inbox = createTrustedInboxHttp({ ...options, createRepository: ({ authenticate }) =>
    ({ page: (body, context) => index.page(body, { ...context, credential: authenticate().uid }) }) });
  const call = (api, uid, op, body) => api.handle(op, {
    method: 'POST', headers: { authorization: 'Bearer ' + (credentials?.get(uid) ?? uid + '.fixture.token'), 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const ok = async (...args) => {
    const result = await call(...args);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  const firstPage = { limit: 20, cursor: null, snapshotId: null };
  const page = uid => ok(inbox, uid, 'page', firstPage);
  const continuation = ({ nextCursor, snapshotId }) => ({ limit: 20, cursor: nextCursor, snapshotId });
  const key = row => row.kind + ':' + row.threadId;
  async function assertMixedPages(totalUnread) {
    const first = await page(buyer);
    assert.ok(first.nextCursor);
    const last = await ok(inbox, buyer, 'page', continuation(first));
    assert.equal(last.snapshotId, first.snapshotId);
    assert.equal(last.nextCursor, null);
    for (const [slice, count] of [[first, 20], [last, 2]]) {
      assert.equal(slice.totalUnread, totalUnread);
      assert.equal(slice.items.length, count);
      assert.deepEqual(new Set(slice.items.map(row => row.kind)), new Set(['product', 'provider']));
    }
    const rows = [...first.items, ...last.items];
    assert.deepEqual(rows, [...rows].sort(compareInboxRows));
    assert.deepEqual(rows.map(key).sort(), knownThreads.map(key).sort());
    assert.equal(rows.reduce((sum, row) => sum + row.unreadCount, 0), totalUnread);
    return first;
  }
  async function reconcileAll(affectedThread, otherActor) {
    assert.equal((await index.reconcile(affectedThread)).ok, true);
    assert.equal((await index.finalize({ actorUid: buyer })).code, 'INVENTORY_REQUIRED');
    for (const thread of knownThreads) {
      if (thread !== affectedThread) assert.equal((await index.reconcile(thread)).ok, true);
    }
    for (const actorUid of [buyer, otherActor]) assert.equal((await index.finalize({ actorUid })).ok, true);
  }
  product.clock(1);
  const opened = await ok(listings, buyer, 'open', { productId: 'product', expectedProductRevision: 1, requestId: 'product-open', text: 'Product question' });
  const threadId = opened.thread.id;
  knownThreads.push({ kind: 'product', threadId });
  service.f.uid(buyer);
  async function createEnquiry(requestId) {
    const body = {
      requestId, providerId: service.f.providerId, expectedPublicationGeneration: 1,
      service: 'Repair', description: 'Service enquiry', timing: 'flexible'
    };
    const enquiry = await (credentials ? call(service.f.http, buyer, 'enquiry.create', body) : service.f.execute('enquiry.create', body));
    assert.equal(enquiry.status, 200, JSON.stringify(enquiry.body));
    return { providerId: service.f.providerId, enquiryId: enquiry.body.enquiryId };
  }
  const scope = await createEnquiry('provider-enquiry');
  service.recordEnquiry(scope.enquiryId);
  const providerSend = { ...scope, expectedEnquiryRevision: 0, expectedGeneration: 1 };
  await ok(providers, buyer, 'send', { ...providerSend, expectedRevision: 0, requestId: 'provider-open', text: 'Service question' });
  knownThreads.push({ kind: 'provider', threadId: scope.enquiryId });
  product.clock(2);
  service.clock(2);
  await ok(listings, seller, 'send', { threadId, expectedRevision: 1, requestId: 'product-reply', text: 'Product reply' });
  await ok(providers, provider, 'send', { ...providerSend, expectedRevision: 1, requestId: 'provider-reply', text: 'Service reply' });

  for (let n = 0; n < 10; n++) {
    const productId = 'more-product-' + n;
    assert.equal((await product.publishListing(productId)).ok, true);
    product.clock(n === 0 ? 1 : 10 + n);
    const opened = await ok(listings, buyer, 'open', { productId, expectedProductRevision: 1, requestId: 'open-more-' + n, text: 'More product questions' });
    knownThreads.push({ kind: 'product', threadId: opened.thread.id });
    const more = await createEnquiry('more-enquiry-' + n);
    service.clock(n === 0 ? 1 : 10 + n);
    await ok(providers, buyer, 'send', { ...providerSend, ...more, expectedRevision: 0, requestId: 'send-more-' + n, text: 'More service questions' });
    knownThreads.push({ kind: 'provider', threadId: more.enquiryId });
  }
  await assertMixedPages(2);
  let failRead = false;
  const client = createUnifiedInbox({ enabled: true, async loadPage(body, context) {
    if (failRead) {
      failRead = false;
      throw Error('Synthetic transport failure');
    }
    return call(inbox, context.session.uid, 'page', body);
  } });
  client.setSession({ uid: buyer, sessionId: 'mixed-buyer' });
  await client.refresh();
  assert.deepEqual(client.snapshot().items.slice(0, 2).map(row => row.kind), ['product', 'provider']);
  assert.equal(client.snapshot().totalUnread, 2);
  assert.deepEqual((await page(seller)).items.map(row => row.kind), Array(11).fill('product'));
  assert.deepEqual((await page(provider)).items.map(row => row.kind), Array(11).fill('provider'));

  const history = { expectedRevision: 2, afterSequence: 0, limit: 20 };
  const listingHistory = await ok(listings, buyer, 'read', { threadId, ...history });
  const serviceHistory = await ok(providers, buyer, 'read', { ...scope, ...history });
  assert.ok(listingHistory.readReceipt && serviceHistory.readReceipt);
  assert.equal((await call(listings, outsider, 'read', { threadId, ...history })).status, 403);
  assert.equal((await call(providers, outsider, 'read', { ...scope, ...history })).status, 403);
  await ok(listings, buyer, 'acknowledge', { threadId, readReceipt: listingHistory.readReceipt });
  await client.refreshAfterRead();
  assert.equal(client.snapshot().totalUnread, 1);
  assert.deepEqual(client.snapshot().items.filter(row => row.unreadCount).map(row => row.kind), ['provider']);
  await ok(providers, buyer, 'acknowledge', { ...scope, readReceipt: serviceHistory.readReceipt });
  await client.refreshAfterRead();
  assert.equal(client.snapshot().totalUnread, 0);

  product.clock(3);
  await ok(listings, seller, 'send', { threadId, expectedRevision: 2, requestId: 'product-keep', text: 'Product surviving reply' });
  product.clock(4);
  await ok(listings, seller, 'send', { threadId, expectedRevision: 3, requestId: 'product-delete-me', text: 'Withdraw this unread reply' });
  const preDelete = await assertMixedPages(2);
  const beforeDelete = await ok(listings, buyer, 'read', { threadId, ...history, expectedRevision: 4 });
  const deletion = { threadId, expectedRevision: 4, requestId: 'product-delete', sequence: 4, action: 'delete_for_everyone' };
  const listingRepository = uid => createIsolatedProductConversationRepository({
    ...product.base, ...options, authenticate: () => ({ uid })
  });
  const listingMaintenance = listingRepository(buyer);
  assert.equal((await listingMaintenance.changeVisibility(deletion)).code, 'DENIED');
  assert.equal((await listingRepository(outsider).changeVisibility(deletion)).code, 'DENIED');
  const cursor = continuation(preDelete);
  assert.equal((await call(inbox, seller, 'page', cursor)).body.error.code, 'CURSOR_INVALID');
  assert.equal((await call(inbox, buyer, 'page', { ...cursor, cursor: 'invalid-signature' })).body.error.code, 'CURSOR_INVALID');

  let resumePage;
  const resume = new Promise(resolve => { resumePage = resolve; });
  const started = new Promise(resolve => { pausePage = { started: resolve, resume }; });
  const concurrent = call(inbox, buyer, 'page', cursor);
  try {
    // The old page query must complete before deletion changes the head generation.
    await Promise.race([started, concurrent.then(() => assert.fail('Continuation completed before the mutation'))]);
    const author = listingRepository(seller);
    assert.equal((await author.changeVisibility(deletion)).status, 'changed');
    assert.equal((await author.changeVisibility(deletion)).status, 'replayed');
  } finally {
    resumePage();
  }
  assert.equal((await concurrent).body.error.code, 'CURSOR_INVALID');
  await client.refresh();
  assert.equal(client.snapshot().totalUnread, null);
  assert.deepEqual(client.snapshot().items, []);
  await reconcileAll(knownThreads[0], seller);
  const afterDelete = await assertMixedPages(1);
  assert.notEqual(afterDelete.snapshotId, preDelete.snapshotId);
  assert.equal((await call(inbox, buyer, 'page', cursor)).body.error.code, 'CURSOR_INVALID');
  for (const actor of [buyer, seller]) {
    const delivered = await ok(listings, actor, 'read', { threadId, ...history, expectedRevision: 4 });
    assert.deepEqual(delivered.messages.map(message => message.sequence), [1, 2, 3]);
    if (actor === buyer) {
      const stale = await call(listings, buyer, 'acknowledge', { threadId, readReceipt: beforeDelete.readReceipt });
      assert.equal(stale.status, 403);
      assert.equal(stale.body.error.code, 'DENIED');
      assert.equal((await page(buyer)).totalUnread, 1);
      assert.ok(delivered.readReceipt);
      assert.equal((await ok(listings, buyer, 'acknowledge', { threadId, readReceipt: delivered.readReceipt })).readSequence, 4);
    }
  }
  await client.refreshAfterRead();
  assert.equal(client.snapshot().totalUnread, 0);
  failRead = true;
  await client.next();
  assert.equal(client.snapshot().status, 'unavailable');
  assert.deepEqual(client.snapshot().items, []);
  assert.equal(client.snapshot().totalUnread, null);
  await client.refresh();
  await client.next();
  assert.equal(client.snapshot().items.length, 2);
  assert.equal(client.snapshot().totalUnread, 0);

  product.clock(5);
  await ok(listings, seller, 'send', { threadId, expectedRevision: 4, requestId: 'product-new', text: 'Hide this unread message' });
  assert.equal((await page(buyer)).totalUnread, 1);
  const hide = { threadId, expectedRevision: 5, requestId: 'product-hide', sequence: 5, action: 'hide_for_self' };
  assert.equal((await call(listings, buyer, 'changeVisibility', hide)).status, 404);
  // Product privacy remains available only through the isolated repository.
  assert.equal((await listingMaintenance.changeVisibility(hide)).status, 'changed');
  await client.refresh();
  assert.equal(client.snapshot().status, 'unavailable');
  assert.equal(client.snapshot().totalUnread, null);
  assert.deepEqual(client.snapshot().items, []);
  await reconcileAll(knownThreads[0], seller);
  await client.refresh();
  assert.equal(client.snapshot().totalUnread, 0);
  assert.equal(client.snapshot().items.length, 20);
  const ownHistory = await ok(listings, buyer, 'read', { threadId, ...history, expectedRevision: 5 });
  const otherHistory = await ok(listings, seller, 'read', { threadId, ...history, expectedRevision: 5 });
  assert.deepEqual(ownHistory.messages.map(message => message.sequence), [1, 2, 3]);
  assert.deepEqual(otherHistory.messages.map(message => message.sequence), [1, 2, 3, 5]);

  service.clock(3);
  await ok(providers, provider, 'send', { ...providerSend, expectedRevision: 2, requestId: 'provider-new', text: 'Unread service reply' });
  assert.equal((await page(buyer)).totalUnread, 1);
  await ok(providers, buyer, 'changeBlock', { ...scope, requestId: 'provider-block', expectedRevision: 3, expectedBlocked: false, blocked: true });
  await client.refresh();
  assert.equal(client.snapshot().totalUnread, null);
  await reconcileAll(knownThreads[1], provider);
  await client.refresh();
  assert.equal(client.snapshot().totalUnread, 0);
  assert.deepEqual(client.snapshot().items.map(row => row.kind), Array(11).fill('product'));
  client.setSession({ uid: seller, sessionId: 'mixed-seller' });
  assert.deepEqual(client.snapshot().items, []);
  await client.refresh();
  assert.deepEqual(client.snapshot().items.map(row => row.kind), Array(11).fill('product'));
  client.setSession(null);
  assert.deepEqual(client.snapshot().items, []);
  assert.equal(client.snapshot().totalUnread, null);
}
