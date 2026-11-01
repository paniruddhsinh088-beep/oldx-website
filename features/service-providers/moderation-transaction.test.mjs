import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateProvider } from './moderation-transaction.mjs';

function mockDb(status = 'pending') {
  const calls = [];
  const db = {
    collection(name) {
      return { doc(id) { return { id: id ?? 'audit-1', collection: name }; } };
    },
    async runTransaction(fn) {
      return fn({
        async get() { return { exists: true, data: () => ({ status }) }; },
        update(ref, data) { calls.push(['update', ref.collection, data.status]); },
        create(ref, data) { calls.push(['create', ref.collection, data.toStatus]); }
      });
    }
  };
  return { db, calls };
}
const args = (db) => ({
  db, verifyAdmin: async () => ({ uid: 'trusted-admin', isAdmin: true }),
  idToken: 'verified-by-server', providerId: 'provider-1',
  nextStatus: 'active', reason: 'Reviewed supporting details',
  now: new Date('2026-11-02T00:00:00Z')
});
test('approval writes status and audit in one transaction', async () => {
  const { db, calls } = mockDb();
  const result = await moderateProvider(args(db));
  assert.equal(result.status, 'active');
  assert.deepEqual(calls, [
    ['update', 'serviceProviders', 'active'],
    ['create', 'serviceProviderAudit', 'active']
  ]);
});
test('rejects unverified or unauthorized actor before transaction', async () => {
  const { db, calls } = mockDb();
  await assert.rejects(moderateProvider({ ...args(db), verifyAdmin: async () => ({ uid: 'user', isAdmin: false }) }), /admin_required/);
  assert.deepEqual(calls, []);
});
test('rejects invalid status transitions without writes', async () => {
  const { db, calls } = mockDb('active');
  await assert.rejects(moderateProvider(args(db)), /invalid_transition/);
  assert.deepEqual(calls, []);
});
test('rejects unsafe provider IDs', async () => {
  const { db } = mockDb();
  await assert.rejects(moderateProvider({ ...args(db), providerId: '../admins' }), /invalid_provider_id/);
});
