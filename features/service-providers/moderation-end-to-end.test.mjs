import test from 'node:test';
import assert from 'node:assert/strict';
import { createModerationService } from './moderation-service.mjs';
import { createModerationHttpHandler } from './moderation-http-handler.mjs';

function response() {
  return {
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}
function request() {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer signed-token', 'content-type': 'application/json' },
    body: { providerId: 'provider-1', nextStatus: 'active', reason: 'Verified provider information' }
  };
}
function firestore() {
  const writes = [];
  return {
    writes,
    collection(name) {
      return { doc(id) { return { id: id || 'audit-1', name }; } };
    },
    async runTransaction(work) {
      return work({
        async get() { return { exists: true, data: () => ({ status: 'pending' }) }; },
        update(ref, data) { writes.push([ref.name, data.status]); },
        create(ref, data) { writes.push([ref.name, data.toStatus]); }
      });
    }
  };
}
test('HTTP to verified admin to transaction writes status and audit', async () => {
  const db = firestore();
  const moderate = createModerationService({
    db,
    adminAuth: { async verifyIdToken(token, revoked) {
      assert.equal(token, 'signed-token');
      assert.equal(revoked, true);
      return { uid: 'admin-1', admin: true };
    } }
  });
  const res = response();
  await createModerationHttpHandler(moderate)(request(), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.status, 'active');
  assert.deepEqual(db.writes, [
    ['serviceProviders', 'active'],
    ['serviceProviderAudit', 'active']
  ]);
});
test('HTTP request by non-admin never writes to Firestore', async () => {
  const db = firestore();
  const moderate = createModerationService({
    db,
    adminAuth: { async verifyIdToken() { return { uid: 'ordinary-user', admin: false }; } }
  });
  const res = response();
  await createModerationHttpHandler(moderate)(request(), res);
  assert.equal(res.code, 403);
  assert.deepEqual(db.writes, []);
});
