// Synthetic, in-memory Service enquiry rehearsal ONLY. This is not authorization,
// messaging, persistence, a completion proof, or a review entitlement.
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const CONTROL = /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const STATES = new Set([
  'new', 'accepted', 'declined', 'in_progress',
  'completion_requested', 'completed_confirmed', 'disputed', 'cancelled'
]);
const ACTIVE = new Set(['new', 'accepted', 'in_progress', 'completion_requested']);
const CLOSED = new Set(['declined', 'completed_confirmed', 'disputed', 'cancelled']);
const NEXT = Object.freeze({
  new: {provider: ['accepted', 'declined'], buyer: ['cancelled']},
  accepted: {provider: ['in_progress'], buyer: ['cancelled']},
  in_progress: {provider: ['completion_requested'], buyer: ['cancelled', 'disputed']},
  completion_requested: {buyer: ['completed_confirmed', 'disputed']}
});
const unavailable = code => ({ok: false, code});
const safeText = (value, max, min = 1) =>
  typeof value === 'string' && value.length >= min && value.length <= max &&
  value.trim().length >= min && !CONTROL.test(value);

function publicSampleProvider(provider) {
  return provider && typeof provider === 'object' && !Array.isArray(provider) &&
    typeof provider.id === 'string' && ID.test(provider.id) && provider.published === true &&
    Array.isArray(provider.services) && provider.services.length > 0 &&
    provider.services.length <= 12 && provider.services.every(s => safeText(s, 80));
}

function projectRow(row, provider) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      typeof row.requestId !== 'string' || !ID.test(row.requestId) || row.providerId !== provider.id ||
      !provider.services.includes(row.service) || !STATES.has(row.status) ||
      !safeText(row.summary, 160, 5) ||
      !['flexible', 'this-week'].includes(row.timing) ||
      !Number.isSafeInteger(row.createdOrder) || row.createdOrder < 0 || row.createdOrder > 999999) return null;
  // Explicit projection: never spread the original row (buyer UID/contact, private
  // notes, phone, address, internal moderation and audit fields stay excluded).
  return {
    requestId: row.requestId, providerId: provider.id, service: row.service,
    summary: row.summary.normalize('NFC').trim(), timing: row.timing,
    status: row.status, createdOrder: row.createdOrder
  };
}

export function inspectSampleProviderInbox(provider, rows, {filter = 'all', limit = 12} = {}) {
  if (!publicSampleProvider(provider)) return unavailable('PROVIDER_UNAVAILABLE');
  if (!Array.isArray(rows) || rows.length > 50 ||
      !['all', 'new', 'active', 'closed'].includes(filter) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 20) return unavailable('INVALID_REQUEST');
  const scoped = [];
  const ids = new Set();
  for (const row of rows) {
    if (!row || row.providerId !== provider.id) continue;
    const projected = projectRow(row, provider);
    if (!projected || ids.has(projected.requestId)) return unavailable('INVALID_FIXTURE');
    ids.add(projected.requestId);
    scoped.push(projected);
  }
  scoped.sort((a, b) => b.createdOrder - a.createdOrder || a.requestId.localeCompare(b.requestId, 'en'));
  const matches = scoped.filter(row => filter === 'all' ||
    (filter === 'new' && row.status === 'new') ||
    (filter === 'active' && ACTIVE.has(row.status)) ||
    (filter === 'closed' && CLOSED.has(row.status)));
  return {ok: true, value: {
    providerId: provider.id, filter, total: matches.length,
    items: matches.slice(0, limit), hasMore: matches.length > limit,
    sampleOnly: true
  }};
}

export function rehearseSampleEnquiryTransition(provider, row, {actor, nextStatus} = {}) {
  if (!publicSampleProvider(provider)) return unavailable('PROVIDER_UNAVAILABLE');
  const current = projectRow(row, provider);
  if (!current) return unavailable('INVALID_ENQUIRY');
  if (!['buyer', 'provider'].includes(actor) || !STATES.has(nextStatus) ||
      !NEXT[current.status]?.[actor]?.includes(nextStatus)) return unavailable('INVALID_TRANSITION');
  // Actor labels are UI rehearsal choices, not verified identities. Never grant
  // review eligibility, write state, or infer completion from this result.
  return {ok: true, value: {...current, status: nextStatus}, sampleOnly: true};
}
