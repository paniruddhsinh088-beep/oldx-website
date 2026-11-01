import test from 'node:test';
import assert from 'node:assert/strict';
import { createModerationService } from './moderation-service.mjs';

test('audit actor is derived from verified Firebase token, never browser fields', async () => {
  const writes = [];
  const db = {
    collection(name) {
      return { doc(id) { return { name, id: id || 'audit-event-1' }; } };
    },
    async runTransaction(work) {
      return work({
        async get() { return { exists: true, data: () => ({ status: 'pending' }) }; },
        update(ref, value) { writes.push({ type: 'update', name: ref.name, value }); },
        create(ref, value) { writes.push({ type: 'create', name: ref.name, value }); }
      });
    }
  };
  const service = createModerationService({
    db,
    adminAuth: { async verifyIdToken() { return { uid: 'verified-admin', admin: true }; } }
  });
  await service({
    idToken: 'signed-token',
    providerId: 'provider-1',
    nextStatus: 'active',
    reason: 'Reviewed provider information',
    actorUid: 'forged-browser-actor',
    actorIsTrustedAdmin: false
  });
  const audit = writes.find(entry => entry.type === 'create');
  assert.equal(audit.value.actorUid, 'verified-admin');
  assert.equal(audit.value.providerId, 'provider-1');
  assert.equal(audit.value.fromStatus, 'pending');
  assert.equal(audit.value.toStatus, 'active');
});
