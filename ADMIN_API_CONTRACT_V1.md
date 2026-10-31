# OLDX Admin API Contract v1 — Design Draft

**Branch:** `security-hardening-review`  
**Status:** Contract only. No endpoint is implemented or deployed.

## 1. Architecture decision

Use a trusted server-side API for Admin operations. The API may be implemented as Firebase Cloud Functions (2nd gen) or another owner-approved trusted runtime. The current repository and available project information do not establish which backend runtime, billing plan, region, or staging service identity is approved. Do not create or deploy a backend until those are confirmed.

The browser must never use Firebase Admin SDK credentials. Server credentials belong only in the selected platform's managed secret/service identity system.

## 2. Authentication and authorization

Every endpoint must:

1. Require `Authorization: Bearer <Firebase ID token>`.
2. Verify the token cryptographically with Firebase Admin SDK.
3. Resolve the caller's active role from a private server-controlled role registry or verified custom claims.
4. Deny by default. Never trust `uid`, `email`, `role`, `isAdmin`, `actorUid`, or permissions supplied in the request body.
5. Keep the existing owner-approved Admin identity as the only active Admin until the owner explicitly approves additional identities.
6. Apply rate limits and return `Cache-Control: no-store` on sensitive responses.
7. Write append-only audit events for sensitive reads and every mutation.

The current hard-coded UID check in `admin.html` remains a display/navigation gate only. It must not be treated as API authorization.

## 3. Common response envelope

Success:
```json
{ "ok": true, "data": {}, "requestId": "server-generated-id" }
```

Failure:
```json
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "Request not permitted" }, "requestId": "server-generated-id" }
```

Do not return stack traces, raw Firestore errors, private paths, or secrets to the browser.

## 4. Endpoints

### GET /api/admin/dashboard

Purpose: replace direct `stats/traffic` read and full product/user collection scans for aggregate cards.

Response fields (only):
- `totalViews`: aggregate count, or `null` if unavailable
- `totalAds`: count if safely/efficiently available
- `featuredAds`: count if safely/efficiently available
- `totalUsers`: count if safely/efficiently available

Do not run an unbounded scan on every page load. Use trusted aggregate counters or bounded/maintained statistics. Each field may be `null` until a trusted aggregation path exists.

### GET /api/admin/products

Query:
- `pageSize`: integer 1–50; default 25
- `pageToken`: opaque server-issued cursor, optional
- `q`: optional bounded search string, max 80 characters

Response:
- `items[]`: `id`, `title`, `category`, `finalPriceStr`, `location`, `sellerUid`, `isFeatured`, and only other fields proven necessary for the Ads table
- `nextPageToken`: opaque cursor or `null`

Never accept a Firestore collection/path or arbitrary sort field from the caller. Firestore substring search is not native; define and document a prefix/token search strategy before claiming parity with the current browser `includes()` search.

### GET /api/admin/users

Query:
- `pageSize`: integer 1–50; default 25
- `pageToken`: opaque server-issued cursor, optional
- `q`: optional bounded search string, max 80 characters

Response:
- `items[]`: `uid`, `displayName`, and only role-approved identity fields
- `nextPageToken`: opaque cursor or `null`

Email and IP are sensitive. Return them only to the Owner Admin if a documented task requires them. Never return entire `users/{uid}` documents.

### GET /api/admin/users/{uid}/summary

Return a minimal user summary and listing summary for the selected UID. Validate UID format; do not permit caller-supplied Firestore paths. Return last activity as a genuine timestamp with a clear source label, or `null`/Not available. Do not imply `lastSeen` is a full activity or authentication history.

### POST /api/admin/products/{productId}/quarantine

Request:
```json
{ "reasonCode": "POLICY_REVIEW", "reason": "Bounded explanation", "caseId": null }
```

- Require Owner Admin or explicitly granted moderation role.
- Require an allowlisted reason code and bounded explanation.
- Store a restricted before-snapshot reference and immutable audit event.
- Prefer reversible quarantine over permanent deletion.
- Return the confirmed moderation state only after the server transaction succeeds.

### POST /api/admin/products/{productId}/restore

Request requires reason and optional case reference. Verify the item is in a restorable state; append an audit event. Do not overwrite unrelated seller fields.

### POST /api/admin/products/{productId}/permanent-delete

Disabled in v1 until retention, legal hold, evidence snapshot, approval, and recovery requirements are implemented. No client-side Firestore delete fallback is permitted.

## 5. Audit event minimum fields

- server-generated immutable `eventId`
- `eventType`, `targetType`, `targetId`
- `actorUid` and `actorRole` derived server-side
- `createdAt` server timestamp
- allowlisted `reasonCode` and bounded `reason`
- optional `caseId`
- restricted `beforeSnapshotRef` for moderation changes
- `requestId`

Clients must not write or update audit events.

## 6. Pagination and query safety

- Enforce page size server-side regardless of client input.
- Use stable ordering and opaque cursors.
- Validate and normalize filters.
- Apply indexes deliberately; avoid unbounded collection scans.
- Rate-limit user search and dashboard refresh.
- Do not implement substring search by downloading every user/product to the browser.
- Keep sensitive response payloads minimal and non-cacheable.

## 7. Migration order

1. Confirm backend platform, staging project, region, billing and service identity.
2. Implement and test token verification and role resolution in staging only.
3. Implement read-only dashboard, products and users endpoints with pagination.
4. Update Admin UI to use the API; verify existing Ads/Users workflows.
5. Implement quarantine/restore with audit trail; test with synthetic records.
6. Only after migration, prepare Firestore Rules that deny direct client Admin reads/deletes.
7. Run Emulator Rules tests and backend integration tests.
8. Obtain explicit owner approval before any staging Rules publication.
9. Production migration is a separate project and requires separate explicit approval.

## 8. Acceptance criteria

- Non-admin token receives 403 for every Admin endpoint.
- Missing/invalid/expired token receives 401.
- A browser-only UID constant does not grant access.
- User list is paginated and returns only allowed fields.
- Product list is paginated and seller identity is not accidentally omitted from the Admin workflow.
- Quarantine and restore require reason and create immutable audit events.
- Permanent delete is unavailable until retention and hold checks exist.
- No Admin endpoint can read or mutate Production during staging tests.
- Failure leaves the Admin UI state unchanged and presents a safe message.

## 9. Explicit non-goals

This contract does not create endpoints, grant roles, define Firestore Rules, alter Firebase projects, migrate records, or authorize deployment. It is a reviewable API design draft.
