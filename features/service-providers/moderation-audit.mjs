// Pure audit-event builder. Call only after verifying Firebase Auth and admin
// authorization on a trusted server. Persist status and audit atomically.
import { moderationDecision } from './moderation-policy.mjs';

export function planModerationAudit({ actorUid, actorIsTrustedAdmin, providerId, currentStatus, nextStatus, reason, now }) {
  const decision = moderationDecision({ actorIsTrustedAdmin, currentStatus, nextStatus, reason });
  if (!decision.allowed) return { allowed: false, code: decision.code };
  if (typeof actorUid !== 'string' || !actorUid.trim() ||
      typeof providerId !== 'string' || !providerId.trim() ||
      !(now instanceof Date) || Number.isNaN(now.getTime())) {
    return { allowed: false, code: 'invalid_context' };
  }
  return {
    allowed: true,
    code: 'ok',
    event: {
      providerId,
      actorUid,
      action: 'provider_status_change',
      fromStatus: currentStatus,
      toStatus: nextStatus,
      reason: reason.trim(),
      occurredAt: now.toISOString()
    }
  };
}
