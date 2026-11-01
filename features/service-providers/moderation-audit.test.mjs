import test from 'node:test';
import assert from 'node:assert/strict';
import { planModerationAudit } from './moderation-audit.mjs';
const base = () => ({ actorUid: 'admin-1', actorIsTrustedAdmin: true, providerId: 'provider-1', currentStatus: 'pending', nextStatus: 'active', reason: 'Verified submitted details', now: new Date('2026-11-02T00:00:00Z') });
test('builds an auditable approval event', () => {
  const result = planModerationAudit(base());
  assert.equal(result.allowed, true);
  assert.equal(result.event.actorUid, 'admin-1');
  assert.equal(result.event.fromStatus, 'pending');
  assert.equal(result.event.toStatus, 'active');
  assert.equal(result.event.reason, 'Verified submitted details');
});
test('rejects unauthorized actor and missing reason', () => {
  assert.equal(planModerationAudit({ ...base(), actorIsTrustedAdmin: false }).allowed, false);
  assert.equal(planModerationAudit({ ...base(), reason: ' ' }).allowed, false);
});
test('rejects invalid audit context', () => {
  assert.equal(planModerationAudit({ ...base(), actorUid: '' }).allowed, false);
  assert.equal(planModerationAudit({ ...base(), now: '2026-11-02' }).allowed, false);
});
