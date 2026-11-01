// Server-only HTTP adapter. Wire through a protected POST endpoint on staging.
// Requires a trusted service created with Firebase Admin Auth and Firestore.
export function createModerationHttpHandler(moderate) {
  if (typeof moderate !== 'function') throw new Error('moderation_service_required');
  return async function handle(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    const header = req.headers?.authorization;
    const match = typeof header === 'string' ? /^Bearer ([^\s]+)$/.exec(header) : null;
    if (!match) return res.status(401).json({ error: 'authentication_required' });
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(k => !['providerId', 'nextStatus', 'reason'].includes(k)) ||
        typeof body.providerId !== 'string' ||
        typeof body.nextStatus !== 'string' ||
        typeof body.reason !== 'string') {
      return res.status(400).json({ error: 'invalid_request' });
    }
    try {
      const result = await moderate({
        idToken: match[1], providerId: body.providerId,
        nextStatus: body.nextStatus, reason: body.reason
      });
      return res.status(200).json({ providerId: result.providerId, status: result.status, auditId: result.auditId });
    } catch (err) {
      const code = err?.message;
      if (code === 'unauthenticated' || code === 'invalid_id_token') return res.status(401).json({ error: 'authentication_required' });
      if (code === 'admin_required') return res.status(403).json({ error: 'forbidden' });
      if (code === 'provider_not_found') return res.status(404).json({ error: 'provider_not_found' });
      if (['invalid_provider_id', 'invalid_transition', 'reason_required'].includes(code)) return res.status(400).json({ error: code });
      // Do not leak Firestore paths, tokens or internal error details.
      return res.status(500).json({ error: 'internal_error' });
    }
  };
}
