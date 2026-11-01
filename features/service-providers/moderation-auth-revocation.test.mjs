import test from 'node:test';
import assert from 'node:assert/strict';
import { createModerationService } from './moderation-service.mjs';
import { createModerationHttpHandler } from './moderation-http-handler.mjs';

test('revoked Firebase token returns HTTP 401 without starting a Firestore transaction', async () => {
  let transactionStarted = false;
  const moderate = createModerationService({
    adminAuth: {
      async verifyIdToken(_token, checkRevoked) {
        assert.equal(checkRevoked, true);
        throw new Error('auth/id-token-revoked');
      }
    },
    db: {
      async runTransaction() {
        transactionStarted = true;
        throw new Error('unexpected_transaction');
      }
    }
  });
  const res = {
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(value) { this.body = value; return this; }
  };
  await createModerationHttpHandler(moderate)({
    method: 'POST',
    headers: { authorization: 'Bearer revoked-token', 'content-type': 'application/json' },
    body: { providerId: 'provider-1', nextStatus: 'active', reason: 'Verified provider details' }
  }, res);
  assert.equal(res.code, 401);
  assert.deepEqual(res.body, { error: 'authentication_required' });
  assert.equal(transactionStarted, false);
});
