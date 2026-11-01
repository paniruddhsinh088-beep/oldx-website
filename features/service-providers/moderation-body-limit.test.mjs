import test from 'node:test';
import assert from 'node:assert/strict';
import { createModerationHttpHandler } from './moderation-http-handler.mjs';

test('rejects a large parsed JSON request regardless of length header', async () => {
  const handle = createModerationHttpHandler(async () => { throw new Error('unexpected_call'); });
  const res = {
    setHeader() {},
    status(value) { this.code = value; return this; },
    json(value) { this.payload = value; return this; }
  };
  await handle({
    method: 'POST',
    headers: {
      authorization: 'Bearer test-token',
      'content-type': 'application/json'
    },
    body: {
      providerId: 'provider-1',
      nextStatus: 'active',
      reason: 'Reviewed provider details',
      padding: 'a'.repeat(4500)
    }
  }, res);
  assert.equal(res.code, 413);
  assert.deepEqual(res.payload, { error: 'request_too_large' });
});
