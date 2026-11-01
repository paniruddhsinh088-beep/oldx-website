import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminVerifier } from './admin-verifier.mjs';
test('accepts only verified admin custom claim and checks revocation', async () => {
  const calls = [];
  const verifyAdmin = createAdminVerifier({ async verifyIdToken(token, checkRevoked) {
    calls.push([token, checkRevoked]);
    return { uid: 'admin-1', admin: true };
  } });
  assert.deepEqual(await verifyAdmin('signed-token'), { uid: 'admin-1', isAdmin: true });
  assert.deepEqual(calls, [['signed-token', true]]);
});
test('rejects valid tokens without admin claim', async () => {
  const verifyAdmin = createAdminVerifier({ async verifyIdToken() { return { uid: 'user-1', admin: false }; } });
  await assert.rejects(verifyAdmin('token'), /admin_required/);
});
test('rejects revoked or invalid tokens', async () => {
  const verifyAdmin = createAdminVerifier({ async verifyIdToken() { throw new Error('revoked'); } });
  await assert.rejects(verifyAdmin('token'), /unauthenticated/);
  await assert.rejects(verifyAdmin(''), /invalid_id_token/);
});
test('rejects missing trusted auth dependency', () => {
  assert.throws(() => createAdminVerifier({}), /admin_auth_required/);
});
