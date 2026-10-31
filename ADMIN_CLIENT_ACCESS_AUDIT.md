# Admin Client Access Audit

**Branch:** `security-hardening-review`
**Status:** Static source inspection only; no implementation or deployment.
**Source:** `admin.html` on this branch, reviewed 2026-10-31.

## Observed direct Firestore operations

1. Reads `stats/traffic` directly to populate the total traffic counter.
2. Calls `products.get()` with no pagination, then caches all product documents in the browser.
3. Calls `users.get()` with no pagination, then caches all user documents in the browser.
4. Deletes `products/{docId}` directly from the browser after a confirmation prompt.

## Security and performance implications

- A hidden Admin button or frontend route check is not an authorization boundary. Firestore Rules must deny unauthorized users, and privileged operations must be mediated by a trusted backend that verifies the Firebase ID token and owner-approved Admin identity.
- Full collection reads expose more data than the current page needs, create unbounded reads/costs, and will become slower as the marketplace grows.
- Loading every user document into browser memory is especially sensitive because the `users` collection currently mixes public profile and private account fields (including email, lastIp, savedAds and blockedUsers in the reviewed client inventory).
- Direct browser deletion bypasses server-side reason validation, audit-event creation, retention/legal-hold checks and safe recovery controls.
- The dashboard's direct stats read should be replaced by a minimal aggregate endpoint or a deliberately public aggregate document; browser writes to traffic stats must be separately removed.

## Required target behavior

- Replace direct Admin collection reads with authenticated, server-side Admin API endpoints.
- Verify Firebase ID tokens cryptographically on every request and resolve the active Admin role server-side. Do not trust browser-supplied UID, email, role or `isAdmin` values.
- Use bounded pagination (page size 1–50), stable ordering and opaque cursors for Products, Users, Stores, Reports and Audit.
- Return only fields required for the current Admin view. Exclude email and IP unless a separately approved investigative purpose requires them.
- Route product deletion through a reversible, audited quarantine/moderation workflow first. Permanent deletion remains disabled until retention, legal hold, evidence preservation and recovery safeguards exist.
- Keep sensitive Admin responses non-cacheable and rate-limited; audit sensitive reads and all mutations.

## Emulator / integration acceptance tests

- Unauthenticated and non-Admin callers cannot read Admin data or perform mutations.
- The configured owner-approved Admin can read only paginated, allowlisted fields.
- A caller cannot impersonate the Admin by changing request-body UID/email/role or browser storage.
- Page size limits, cursor binding and rate limits are enforced.
- Product moderation/deletion writes an append-only audit event with server-derived actor identity and reason.
- No Admin browser workflow downloads the full Users or Products collection.

## Safety boundary

This audit does not change `admin.html`, Firestore Rules, Firebase data, backend services or deployments. The Admin API contract remains a design draft; runtime, staging service identity, region and billing approval are not yet established. Production remains untouched.
