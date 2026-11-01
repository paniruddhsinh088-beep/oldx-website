// SERVER ONLY. Construct this with Firebase Admin SDK Auth and Firestore.
// Authentication and authorization are performed before the transaction.
// The browser must never supply trusted roles or audit actor IDs.
import { createAdminVerifier } from './admin-verifier.mjs';
import { moderateProvider } from './moderation-transaction.mjs';

export function createModerationService({ adminAuth, db }) {
  const verifyAdmin = createAdminVerifier(adminAuth);
  if (!db || typeof db.runTransaction !== 'function') {
    throw new Error('admin_firestore_required');
  }
  return async function approveOrModerate({ idToken, providerId, nextStatus, reason }) {
    return moderateProvider({
      db, verifyAdmin, idToken, providerId, nextStatus, reason
    });
  };
}
