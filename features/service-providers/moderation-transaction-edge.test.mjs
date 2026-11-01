import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateProvider } from './moderation-transaction.mjs';

function setup({ exists = true, status = 'pending', transactionError = null } = {}) {
  const writes = [];
  const db = {
    collection(name) {
      return { doc(id) { return { id: id || 'audit-id', name }; } };
    },
    async runTransaction(work) {
      if (transactionError) throw transactionError;
      return work({
        async get() { return { exists, data: () => ({ status }) }; },
        update() { writes.push('status'); },
        create() { writes.push('audit'); }
      });
    }
  };
  const params = {
    db, verifyAdmin: async () => ({ uid: 'admin-1', isAdmin: true }),
    idToken: 'signed-token', providerId: 'provider-1',
    nextStatus: 'active', reason: 'Verified provider details',
    now: new Date('2026-11-02T00:00:00Z')
  };
  return { writes, params };
}

test('missing provider is rejected without writes', async () => {
  const { writes, params } = setup({ exists: false });
  await assert.rejects(moderateProvider(params), /provider_not_found/);
  assert.deepEqual(writes, []);
});

test('invalid status transition cannot write audit or status', async () => {
  const { writes, params } = setup({ status: 'suspended' });
  await assert.rejects(moderateProvider({ ...params, nextStatus: 'rejected' }), /invalid_transition/);
  assert.deepEqual(writes, []);
});

test('Firestore transaction failures propagate without reporting success', async () => {
  const { params } = setup({ transactionError: new Error('transaction_failed') });
  await assert.rejects(moderateProvider(params), /transaction_failed/);
});
