import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionProviderStatus, moderationDecision } from './moderation-policy.mjs';
test('supports approval, rejection, suspension, and reinstatement', () => {
  for (const [from, to] of [['pending','active'], ['pending','rejected'], ['active','suspended'], ['suspended','active'], ['rejected','pending']]) {
    assert.equal(canTransitionProviderStatus(from, to), true);
  }
});
test('blocks direct self-approval and unsupported transitions', () => {
  assert.equal(moderationDecision({ actorIsTrustedAdmin: false, currentStatus: 'pending', nextStatus: 'active', reason: 'Reviewed identity' }).allowed, false);
  assert.equal(canTransitionProviderStatus('pending', 'suspended'), false);
  assert.equal(canTransitionProviderStatus('active', 'pending'), false);
});
test('trusted moderator must supply meaningful audit reason', () => {
  assert.equal(moderationDecision({ actorIsTrustedAdmin: true, currentStatus: 'pending', nextStatus: 'active', reason: 'ok' }).allowed, false);
  assert.equal(moderationDecision({ actorIsTrustedAdmin: true, currentStatus: 'pending', nextStatus: 'active', reason: 'Reviewed submitted details' }).allowed, true);
});
