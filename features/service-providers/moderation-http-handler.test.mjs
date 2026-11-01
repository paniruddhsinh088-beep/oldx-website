import test from 'node:test';
import assert from 'node:assert/strict';
import { createModerationHttpHandler } from './moderation-http-handler.mjs';
function response() {
  return { headers: {}, setHeader(k,v) { this.headers[k] = v; },
    status(n) { this.code = n; return this; }, json(data) { this.body = data; return this; } };
}
const request = (body = { providerId: 'provider-1', nextStatus: 'active', reason: 'Verified details' }) =>
  ({ method: 'POST', headers: { authorization: 'Bearer signed-token', 'content-type': 'application/json' }, body });
test('accepts authenticated POST and returns limited result', async () => {
  const handler = createModerationHttpHandler(async data => {
    assert.equal(data.idToken, 'signed-token');
    return { providerId: data.providerId, status: 'active', auditId: 'audit-1', secret: 'never-send' };
  });
  const res = response();
  await handler(request(), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.secret, undefined);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
test('rejects GET, missing auth and unexpected role fields', async () => {
  const handler = createModerationHttpHandler(async () => { throw Error('should_not_run'); });
  for (const [req, code] of [
    [{ ...request(), method: 'GET' }, 405],
    [{ ...request(), headers: {} }, 401],
    [request({ providerId: 'p1', nextStatus: 'active', reason: 'Verified', isAdmin: true }), 400]
  ]) {
    const res = response(); await handler(req, res); assert.equal(res.code, code);
  }
});
test('maps authorization failures and hides unexpected errors', async () => {
  for (const [message, code] of [['admin_required', 403], ['unauthenticated', 401], ['database password leaked', 500]]) {
    const res = response();
    await createModerationHttpHandler(async () => { throw Error(message); })(request(), res);
    assert.equal(res.code, code);
    assert.equal(JSON.stringify(res.body).includes('password'), false);
  }
});

test('requires JSON and rejects oversized requests', async () => {
  const handler = createModerationHttpHandler(async () => { throw Error('should_not_run'); });
  for (const [req, code] of [
    [{ ...request(), headers: { authorization: 'Bearer signed-token', 'content-type': 'text/plain' } }, 415],
    [{ ...request(), headers: { ...request().headers, 'content-length': '5000' } }, 413],
    [request({ providerId: 'p1', nextStatus: 'active', reason: 'x'.repeat(501) }), 400]
  ]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.code, code);
  }
});
