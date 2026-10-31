# OLDX Admin Page Access Inventory — Review Branch

## Scope and method

Static inspection of `admin.html` on `security-hardening-review`. This is not a runtime trace and does not prove deployed Rules or backend behavior. No Rules, data, Firebase settings, or production deployment were changed.

## Current authorization gate

- The page initializes Firebase from `window.OLDX_FIREBASE_CONFIG`.
- It listens to Firebase Auth state.
- It compares the signed-in UID against a hard-coded `AUTHORIZED_ADMIN_UID`.
- A non-matching user is signed out and redirected.
- This is only a browser-side navigation gate. It is not sufficient authorization for reading private user records or performing moderation because browser code can be inspected or bypassed.

## Confirmed Admin Firestore operations

| Path | Operation | Current purpose | Required migration |
|---|---|---|---|
| `stats/traffic` | Read one document | Display total visitor views | Return only required aggregate through a trusted Admin API; avoid exposing general stats access |
| `products` | Read entire collection | Build Ads table and total/featured counts | Server-side paginated listing; only return fields required by the table; avoid unbounded full collection download |
| `users` | Read entire collection | Build Users table and user count | Verified Admin API with bounded pagination and role-scoped fields; never return full private documents |
| `products/{docId}` | Delete document | Admin deletes an ad | Replace with verified moderation endpoint, reason required, audit event, and preferably reversible quarantine before permanent deletion |

## Confirmed UI fields

### Ads table
- title
- category
- finalPriceStr
- location
- sellerUid
- isFeatured contributes to aggregate count
- docId is used as the delete target

### Users table / forensic view
The Admin discovery document records the current visible user fields and forensic modal requirements. Before implementing an API, re-check exact current render fields and ensure each sensitive field has a documented purpose and role requirement. Do not expose lastIp or email to roles that do not need them.

## Security findings

1. A hard-coded UID in `admin.html` can hide the page from ordinary users but cannot authorize Firestore access.
2. Full collection reads create excessive data exposure and do not scale.
3. Direct client deletion has no trusted authorization, reason capture, append-only audit, reversible state, or retention/hold check.
4. The dashboard currently depends on broad direct Firestore reads. Tightening user/stats Rules before migrating the dashboard to a trusted backend will break it.
5. No verified backend source or Functions directory exists in the current review branch. No endpoint should be assumed to exist.

## Required backend contract before Rules tightening

- Verify Firebase ID token on every request.
- Resolve the caller's active role server-side from the owner-managed role registry or verified custom claims.
- Keep the existing owner-approved Admin identity as the only active Admin until the owner separately approves any additional identities.
- Enforce bounded page sizes, safe filters, rate limits, and no-store responses for sensitive data.
- Return a minimal field allowlist per endpoint and role.
- Log sensitive user/evidence access and every moderation action.
- Use reversible quarantine/restore before permanent deletion where appropriate.
- Check retention and legal holds before destructive operations.
- Never trust request-body actor UID, email, role, admin flag, Firestore path, or privileged product fields.

## Emulator security tests required once candidate Rules exist

- Ordinary authenticated user cannot read `stats/traffic` if that path is private or backend-only.
- Ordinary authenticated user cannot enumerate `users`.
- A browser-only Admin UID string does not grant database access.
- No client can delete another user's product through direct Firestore access.
- Seller can still toggle their own `isSold` field in both directions under the approved product update allowlist.
- Client cannot set `isFeatured`, `isShopVerified`, moderation, or audit fields.
- Backend integration tests separately verify ID token, active Admin role, required reason, audit record, quarantine/restore, and hold-aware deletion.

## Blockers

- No approved `firestore.rules` file exists in this branch.
- No Firebase Emulator Rules tests can run until candidate Rules and test dependencies are authored.
- Admin backend is not implemented.
- Exact deployed staging Rules and all current data schemas have not been verified.
- User/private profile split, presence visibility, block enforcement, chat state transitions, and product edit allowlist remain open design decisions.

This document is a static inventory and implementation gate, not an authorization implementation. Do not deploy it or treat it as a substitute for Rules/backend enforcement.
