import test from 'node:test';
import assert from 'node:assert/strict';
import { createModerationService } from './moderation-service.mjs';
function fakeDb() {
  const writes = [];
  return {
    writes,
    collection(name) {
      return { doc(id) { return { id: id || 'audit-1', name }; } };
    },
    async runTransaction(work) {
      return work({
        async get() { return { exists: true, data: () => ({ status: 'pending' }) }; },
        update(ref, value) { writes.push(['update', ref.name, value.status]); },
        create(ref, value) { writes.push(['create', ref.name, value.toStatus]); }
      });
    }
  };
}
test('verified admin can approve and create audit event together', async () => {
  const db = fakeDb();
  const service = createModerationService({
    db, adminAuth: { async verifyIdToken(_token, checkRevoked) {
      assert.equal(checkRevoked, true);
      return { uid: 'admin-1', admin: true };
    } }
  });
  const result = await service({
    idToken: 'signed-token', providerId: 'provider-1',
    nextStatus: 'active', reason: 'Verified provider details'
  });
  assert.equal(result.status, 'active');
  assert.deepEqual(db.writes, [
    ['update', 'serviceProviders', 'active'],
    ['create', 'serviceProviderAudit', 'active']
  ]);
});
test('ordinary signed-in user cannot approve', async () => {
  const db = fakeDb();
  const service = createModerationService({
    db, adminAuth: { async verifyIdToken() { return { uid: 'user-1' }; } }
  });
  await assert.rejects(service({
    idToken: 'signed-token', providerId: 'provider-1',
    nextStatus: 'active', reason: 'Attempted unauthorized approval'
  }), /admin_required/);
  assert.deepEqual(db.writes, []);
});
test('missing admin SDK or Firestore dependency fails closed', () => {
  assert.throws(() => createModerationService({ adminAuth: {}, db: fakeDb() }), /admin_auth_required/);
  assert.throws(() => createModerationService({
    adminAuth: { verifyIdToken: async () => ({ uid: 'a', admin: true }) }, db: {}
  }), /admin_firestore_required/);
});
