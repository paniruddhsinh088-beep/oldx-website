# Admin Panel Improvement Plan

Status: implementation plan only. No live data, permissions, backend, Rules, indexes, or deployment changed.

## Goals

- Keep Admin workflows straightforward on desktop and mobile.
- Keep all Users inspectable through pagination without downloading every user document.
- Reduce initial Firestore reads and browser memory use.
- Minimize personal data sent to the browser.
- Make loading, empty, error, and retry states understandable.
- Preserve an auditable path for privileged actions.

## Phase 0 — release blockers (must be resolved first)

1. The hard-coded Admin UID in `admin.html` is only a browser-side visibility gate. It is not a server authorization boundary.
2. The current page reads `products` and `users` directly from Firestore and retains full documents in browser memory.
3. Product deletion is a direct browser Firestore write and has no atomic audit event.
4. The backend starter is framework-neutral and is not connected to Firebase Admin SDK or deployed.
5. The live project's Firestore Rules and actual collection contents have not been verified by this review.

**Gate:** do not connect the redesigned UI to private data or privileged mutations until a trusted backend, server-side token verification, immutable Admin identity resolution, strict operation schemas, least-privilege staging identity, and atomic audit commits are implemented and tested.

## Phase 1 — UI shell (can be developed against synthetic fixtures)

- Mobile-first header with compact title and clearly labelled logout.
- Accessible tabs using `role=tablist`, `role=tab`, `aria-selected`, `aria-controls`, and keyboard navigation.
- On narrow screens, render each ad/user as a compact labelled card; retain a semantic table at wider breakpoints.
- Visible focus styles, minimum touch target sizing, and non-colour-only status indicators.
- Consistent loading skeleton, empty state, recoverable error message, and Retry control.
- Search input labels and result count; debounce only if it improves measured interaction, and keep search text out of logs.
- Keep user-facing labels concise and avoid exposing email/IP/UID on compact cards unless the authorized workflow requires them.

**Verification:** DOM/accessibility checks and browser tests with synthetic data at narrow and wide viewport sizes. No live Firestore calls.

## Phase 2 — bounded read APIs (blocked on collection readiness)

Proposed API shape:
- `GET /admin/products?limit=25&cursor=...`
- `GET /admin/users?limit=25&cursor=...`
- `GET /admin/stores?limit=25&cursor=...`
- `GET /admin/stats` for trusted aggregate counters.

Requirements:
- Verify Firebase ID token on every request.
- Resolve Admin role from server-controlled immutable identity; ignore caller-supplied UID/role.
- Enforce a maximum page size (proposed 25; confirm with owner before production policy).
- Use stable ordering `createdAt DESC, documentId DESC` with opaque server-generated cursors.
- Return only allowlisted fields for the active view.
- Keep total counts separate from page length; never label a page count as a collection total.
- Do not expose last IP or connection history through ordinary user-list responses.
- Use server-side search/filter only for approved fields and indexes.

Collection gates:
- Users: blocked until a trusted immutable creation-time strategy exists for legacy documents.
- Products: blocked until a read-only oldx-staging audit confirms complete valid `createdAt` coverage and index/cursor behavior.
- Stores: same staging audit and index verification required.
- Missing/invalid timestamps, partial scans, index uncertainty, or project identity uncertainty mean no enablement.

The audit must emit aggregate counts only. Do not export document bodies or personal data.

## Phase 3 — investigation workflow

- Ordinary user list shows minimum identity fields only.
- IP/network details load only after an explicitly authorized investigation action.
- Define purpose, access logging, retention, and who may view IP data before implementation.
- Investigation modal fetches one user's approved details through a separate narrow endpoint.
- User listings load through a paginated seller-scoped query, not from an all-products browser cache.
- Preserve privacy boundaries; do not inspect private chat content without a separately approved, disclosed policy.

## Phase 4 — privileged mutations

- Replace direct browser deletion with a server-side allowlisted operation.
- Validate target ID, operation-specific fields, lengths, types, and reason code; reject unknown fields.
- Re-check actor authorization on the server at mutation time.
- Commit domain mutation and append-only audit event atomically.
- Show success only after the trusted endpoint confirms commit.
- Provide safe failure and retry guidance; avoid duplicate submissions.

No mutation operation should be enabled until its schema and transaction behavior pass Emulator integration tests.

## Phase 5 — Stores and operational metrics

- Add Stores tab only after public/private store field policy and collection readiness are approved.
- Keep owner contact, exact address, and coordinates out of general list projections unless necessary.
- Use bounded pagination and a dedicated store-detail endpoint.
- Aggregate metrics should be server-derived and must not require downloading all products/users.

## Test plan

- Unit: page cursor encoding/decoding, max page size, field projection, operation validation, authorization denial.
- Emulator integration: equal timestamps, cursor continuity, no duplicates/omissions, role revocation, cross-user access denial, atomic mutation + audit rollback.
- Browser: 360px/390px mobile, tablet, desktop; keyboard-only tabs; screen-reader labels; loading/error/empty states; long text; slow network.
- Performance: measure initial bytes, query reads, time-to-first-row, and interaction responsiveness against synthetic datasets of increasing size.
- Security: verify direct Firestore reads/writes are denied to browser clients for protected Admin operations.

## Owner approvals still required

Before runtime work, owner must approve backend platform/region, expected billing, dedicated staging identity/IAM, secret management, allowed staging project, read scope, retention, and rollback process as specified in `functions/admin-backend/STAGING_BACKEND_PREFLIGHT.md`.

Before collection operations are enabled, complete `functions/admin-backend/ADMIN_COLLECTION_READINESS_AUDIT.md` on `oldx-staging` under explicit read-only approval.

No Production work, Rules publication, index changes, IAM changes, secrets, migrations, or deployment are authorized by this plan.
