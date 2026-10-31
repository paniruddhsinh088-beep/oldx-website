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


## Verified migration readiness checklist (2026-10-31)

This checklist separates code foundations from deployable functionality. A checked item means repository-level evidence exists; it does not imply a live endpoint or deployed backend.

### Read foundations
- [x] Framework-neutral Admin HTTP handler with bearer-token/role-resolver injection points.
- [x] Signed pagination token binds actor, operation, query, filters, ordering and page size.
- [x] Fixed collection mapping and field projection in the read adapter.
- [x] Adapter rejects unsupported search and filters before issuing a Firestore query.
- [x] Handler + fake Firestore end-to-end pagination test passes in CI.
- [ ] Real Firebase Admin SDK verifier and server-controlled active-role resolver.
- [ ] Owner-approved staging runtime, region, billing, service identity, IAM and managed secret storage.
- [ ] Read-only staging data audit proving timestamp presence/type and index readiness.
- [ ] Live endpoint integration tests against staging Emulator/runtime.

### Collection-specific readiness
| Area | Source review | Pagination readiness | Required next proof |
|---|---|---|---|
| Products | New create path writes server createdAt | Not yet established for all existing records | Read-only staging coverage/type audit; confirm indexes and projection |
| Stores | New store path writes server createdAt; update path does not backfill | Not yet established for all existing records | Read-only staging coverage/type audit; confirm indexes and projection |
| Users | Reviewed profile creation/sync paths do not write universal createdAt | Blocked | Identify approved stable ordering field or design trusted backfill; no client workaround |

### Admin UI cutover gates
- [ ] Replace initial browser reads of stats/traffic, all products, and all users with bounded API calls.
- [ ] Remove browser-side full-collection caches and implement server pagination.
- [ ] Keep search and filters visibly unavailable until indexed implementations exist; never download all records to simulate them.
- [ ] Remove email and IP from ordinary Users table unless a documented owner-approved purpose and access policy exist.
- [ ] Replace forensic modal with case-linked, purpose-bound and audited reads.
- [ ] Replace direct Product delete with a separately approved recoverable moderation mutation; permanent delete remains disabled.
- [ ] Ensure all mutation controls fail closed when endpoint is absent or authorization is denied.
- [ ] Add keyboard, mobile-width, loading, empty, error and retry UX tests for each migrated section.

### Release gates (all required; none implied by this checklist)
1. Backend runtime and staging project binding are owner-approved and startup rejects Production.
2. Token verification, active-role lookup, revocation behavior, rate limiting and audit writes are implemented server-side.
3. Collection timestamp coverage and indexes are verified in staging without modifying user data.
4. Emulator and staging integration tests pass with synthetic fixtures, including denied users and malformed tokens/cursors.
5. Admin UI no longer performs broad direct reads or direct privileged writes.
6. Security/privacy review approves projections, forensic access, retention, mutation recovery and audit retention.
7. Explicit owner approval is obtained before any staging deployment or Rules publication.

**Current decision:** Continue repository-only review and test improvements. Do not wire the Admin UI to the inactive API client, provision cloud resources, run collection scans, migrate records, publish Rules, or deploy. Production remains out of scope.
