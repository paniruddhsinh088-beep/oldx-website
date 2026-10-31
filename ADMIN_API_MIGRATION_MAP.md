# Admin API Migration Map — Legacy Admin Page

**Branch:** `security-hardening-review`  
**Status:** Static mapping from current `admin.html`; not an implementation or deployed API.  
**Production:** Untouched. No Firebase Rules or cloud resources changed.

## Current page behaviour observed

- Initial load reads `stats/traffic`, all `products`, and all `users` from the browser.
- Product table displays title, category, final price, location, seller UID, and exposes permanent delete.
- User table displays display name, email, last IP, UID, and opens a forensic modal.
- The forensic modal shows identity/authentication fields, IP address, last-seen activity, and derives listings by filtering the full product cache.
- Search is currently performed in browser memory over the entire downloaded collections.

## Replacement API contract

| UI action | Proposed operation | Minimum response / policy |
|---|---|---|
| Admin page bootstrap | `dashboard.summary` | Aggregate counts only; no full collection reads |
| Product directory | `products.list` | Bounded page; only table fields; server-side search/filter |
| Delete product | `products.delete` | POST mutation; reason/confirmation policy; server-side ownership-independent Admin authorization; atomic audit |
| User directory | `users.list` | Bounded page; UID + display name + approved status fields; email only if owner-approved need |
| User forensic view | `users.case.read` | Case-linked, purpose/reason required; minimal fields; separately gated access to network/IP data |
| User listing history | `users.case.products.list` | Query by seller UID server-side; bounded page; no dependence on a client-wide product cache |
| Audit history | `audit.list` | Bounded page, append-only records; no edit/delete endpoint |

Operation names are proposed contract identifiers and must be reconciled with the existing Admin API v1 contract before implementation.

## Privacy and abuse controls

1. Treat IP address and detailed connection history as restricted personal data, not a normal user-directory column.
2. Require a case or support reason before opening forensic details; audit actor, target UID, case reference, purpose, timestamp, and fields accessed.
3. Avoid returning authentication credentials, ID tokens, refresh tokens, password hashes, or unrelated private profile fields.
4. Do not infer that a visible UI button authorizes the operation. The backend independently verifies the Firebase ID token and active owner-approved Admin role.
5. Search, filtering, pagination, and sorting are server-side allowlisted. Cursors must be opaque, integrity-protected, and bound to actor, operation, filter/search scope, and stable ordering.
6. Product deletion must validate the target and policy server-side, then atomically commit deletion and append-only audit. No direct client Firestore delete.
7. Do not grant Admin users the ability to alter Admin identities/roles, erase audit events, or access production infrastructure.

## Migration order

1. Implement dashboard summary and bounded product/user list adapters behind the existing tested HTTP handler.
2. Add staging Emulator integration tests with synthetic data for field minimization, pagination, role revocation, and audit atomicity.
3. Migrate the Admin UI to call the API; preserve current display and search behaviour while replacing browser caches with paginated results.
4. Migrate product delete to an audited POST operation with explicit confirmation and a generic user-facing failure.
5. Replace the forensic modal with a case-linked API call and remove IP/network fields from the general directory.
6. Only after staging runtime tests and separate owner approval, consider staging deployment. Never deploy to production as part of this work.

## Explicit unresolved owner decisions

- Which Admin roles may view email addresses?
- Is IP address access still a legitimate operational requirement, and if so, which role and case purpose permit it?
- What retention period applies to forensic access audit events?
- Is product deletion permanent, or should Admin actions use a recoverable moderation state?

Until these are decided, implement the least-privilege default: omit email and IP from ordinary directory responses, and do not expose forensic details through a general list endpoint.
