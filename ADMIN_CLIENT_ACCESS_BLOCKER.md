# Admin Client Access Blocker and Migration Checklist

**Branch:** `security-hardening-review`  
**Status:** Static source inspection; no runtime or deployed authorization claim.  
**Safety:** No Firebase Rules, projects, user records, or deployments changed.

## Confirmed legacy browser-side access

Inspection of `admin.html` found:

- A hardcoded `AUTHORIZED_ADMIN_UID` check in browser JavaScript. This is a UI gate, not a trusted authorization boundary.
- `fetchAllAdminData()` reads the complete `stats/traffic`, `products`, and `users` collections directly from the browser.
- The Ads table exposes a direct browser-side product delete operation.
- The page initializes Firebase client SDK and Firestore directly.
- The forensic user view is populated from browser-fetched user records; this risks exposing fields such as email and IP beyond a narrowly authorized purpose.

## Required replacement before Admin Panel can be considered secure

1. Remove browser-side UID authorization as the authority source. The backend must verify the Firebase ID token and resolve an active owner-approved Admin role on every request.
2. Replace all collection-wide browser reads with bounded server-side list endpoints. Enforce operation-specific filters, page size caps, deterministic ordering, and scoped opaque cursors.
3. Return only fields required by each Admin screen. Do not return IP address, private account settings, tokens, or unrelated forensic data in ordinary user listings.
4. Replace direct browser deletes with a server-side mutation endpoint that validates the target, checks policy, commits the domain mutation and append-only audit event atomically, and returns a generic result.
5. Keep owner-only Admin identity management outside ordinary Admin operations.
6. Add endpoint integration tests for token expiry/revocation, role removal, pagination cursor tampering/scope, field minimization, rate limits, and atomic audit.
7. Migrate the UI only after a real staging backend adapter exists and has passed Emulator integration tests.

## Safe interim state

Do not loosen Firestore Rules to make this legacy page work. Do not connect it to production or deploy a new Admin API. The framework-neutral backend helpers on this branch are testable primitives only; they are not yet a deployed API or Firebase Admin SDK integration.

## Acceptance criteria

- No full-collection read from the browser.
- No direct privileged Firestore mutation from the browser.
- Backend authorization is independent of client-side visibility and hardcoded browser constants.
- User listings expose only approved fields and are paginated.
- Every privileged mutation has an atomic audit record.
- All changes are validated against the staging project only after separate runtime/IAM approval.
