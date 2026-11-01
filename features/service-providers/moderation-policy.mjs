// Pure policy helpers for server-side moderation planning.
// IMPORTANT: caller must verify Firebase ID token and server-side admin role.
// Never accept isAdmin, status, or rating values from browser requests.
const transitions = Object.freeze({
  pending: Object.freeze(['active', 'rejected']),
  active: Object.freeze(['suspended']),
  rejected: Object.freeze(['pending']),
  suspended: Object.freeze(['active'])
});
export function canTransitionProviderStatus(from, to) {
  return typeof from === 'string' && typeof to === 'string' &&
    Object.hasOwn(transitions, from) && transitions[from].includes(to);
}
export function moderationDecision({ actorIsTrustedAdmin, currentStatus, nextStatus, reason }) {
  if (actorIsTrustedAdmin !== true) return { allowed: false, code: 'admin_required' };
  if (!canTransitionProviderStatus(currentStatus, nextStatus)) return { allowed: false, code: 'invalid_transition' };
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) {
    return { allowed: false, code: 'reason_required' };
  }
  return { allowed: true, code: 'ok' };
}
