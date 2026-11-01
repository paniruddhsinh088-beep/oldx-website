// SERVER ONLY. Supply Firebase Admin SDK Auth; never use the client SDK.
// The admin custom claim must be issued through a trusted server operation.
// verifyIdToken(token, true) rejects revoked tokens when supported by Admin SDK.
export function createAdminVerifier(adminAuth) {
  if (!adminAuth || typeof adminAuth.verifyIdToken !== 'function') {
    throw new Error('admin_auth_required');
  }
  return async function verifyAdmin(idToken) {
    if (typeof idToken !== 'string' || !idToken || idToken.length > 8192) {
      throw new Error('invalid_id_token');
    }
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken, true);
    } catch {
      throw new Error('unauthenticated');
    }
    if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid ||
        decoded.admin !== true) {
      throw new Error('admin_required');
    }
    return { uid: decoded.uid, isAdmin: true };
  };
}
