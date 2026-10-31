# Admin UI Legacy Access Blockers

Status: verified source-review findings; no runtime behavior changed.

## Scope
Reviewed `admin.html` on `security-hardening-review`. This document records blockers to connecting the Admin UI to the new backend. It is not authorization to deploy or change Firebase Rules.

## Confirmed findings

1. **Client-side UID gate is not a security boundary.** The page embeds an `AUTHORIZED_ADMIN_UID` constant and checks the signed-in user's UID in `auth.onAuthStateChanged`. A browser-side check can be bypassed and must never authorize privileged data access.
2. **Direct unpaginated collection reads.** `fetchAllAdminData()` reads the complete `products` collection and then the complete `users` collection using client Firestore SDK calls. The Users read exposes whole user documents to the browser and is incompatible with least-privilege field projection and server pagination.
3. **Direct destructive client write.** `deleteAdminAd(docId)` calls `db.collection('products').doc(docId).delete()` directly from the browser. It bypasses the intended server-side mutation validation, authorization re-check, atomic audit event and request correlation contract.
4. **Error detail exposure.** The delete failure alert includes `error.message`; this can reveal backend/rules details to the UI and should be replaced by a generic user-facing message with safe request ID correlation.

## Required remediation before Admin UI reconnection

- Remove the browser UID constant as an authorization mechanism; require Firebase ID token verification and owner-controlled active role resolution on every backend request.
- Remove direct client reads of `users` and `products`; use only the authenticated Admin read API with explicit field allowlists, bounded signed pagination, and audited access where required.
- Remove direct client delete/write paths; route each supported mutation through a strictly validated operation schema and a trusted atomic domain-write + append-only audit adapter.
- Do not add a permissive Firestore rule to make the legacy page work. Keep client access denied unless a separate, reviewed least-privilege design explicitly permits it.
- Verify UI behavior against staging with synthetic/test accounts and data before any release. Production remains out of scope.

## Not established

This source review does not prove the current deployed Admin page is reachable or that deployed Rules permit these calls. No live environment, Firebase Rules, staging data, IAM, secrets, or Production resources were inspected or changed.
