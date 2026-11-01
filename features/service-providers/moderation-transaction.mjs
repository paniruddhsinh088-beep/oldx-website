// Server-only adapter. Never import into a browser bundle.
// verifyAdmin MUST verify the Firebase ID token and check trusted server-side
// authorization; caller-provided booleans/claims are not sufficient.
import { planModerationAudit } from './moderation-audit.mjs';

export async function moderateProvider({ db, verifyAdmin, idToken, providerId, nextStatus, reason, now = new Date() }) {
  if (!db || typeof db.runTransaction !== 'function' || typeof verifyAdmin !== 'function')
    throw new Error('server_dependencies_required');
  if (typeof providerId !== 'string' || !/^[a-zA-Z0-9_-]{2,128}$/.test(providerId))
    throw new Error('invalid_provider_id');
  const actor = await verifyAdmin(idToken);
  if (!actor || actor.isAdmin !== true || typeof actor.uid !== 'string' || !actor.uid)
    throw new Error('admin_required');
  const providerRef = db.collection('serviceProviders').doc(providerId);
  const auditRef = db.collection('serviceProviderAudit').doc();
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(providerRef);
    if (!snapshot.exists) throw new Error('provider_not_found');
    const current = snapshot.data();
    const plan = planModerationAudit({
      actorUid: actor.uid, actorIsTrustedAdmin: true, providerId,
      currentStatus: current.status, nextStatus, reason, now
    });
    if (!plan.allowed) throw new Error(plan.code);
    tx.update(providerRef, { status: nextStatus, updatedAt: now });
    tx.create(auditRef, { ...plan.event, createdAt: now });
    return { providerId, status: nextStatus, auditId: auditRef.id };
  });
}
