# OLDX Admin API Contract v1 — Design Draft

**Branch:** `security-hardening-review`  
**Status:** Contract only. No endpoint is implemented or deployed.

## 1. Architecture decision

Use a trusted server-side API for Admin operations. The API may be implemented as Firebase Cloud Functions (2nd gen) or another owner-approved trusted runtime. The current repository and available project information do not establish which backend runtime, billing plan, region, or staging service identity is approved. Do not create or deploy a backend until those are confirmed.

The browser must never use Firebase Admin SDK credentials. Server credentials belong only in the selected platform's managed secret/service identity system.

## 2. Authentication and authorization

Every endpoint must require `Authorization: Bearer <Firebase ID token>`, verify the token cryptographically, resolve the active role server-side, deny by default, rate-limit, use `Cache-Control: no-store` for sensitive responses and append audit events for sensitive reads and all mutations. Never trust request-body UID, role, isAdmin, actorUid or permissions. Keep the single existing owner-approved Admin identity as the only active Admin until owner-approved role provisioning exists. The hard-coded UID in `admin.html` is a navigation gate only, never API authorization.

## 3. Response envelope

Success: `{ "ok": true, "data": {}, "requestId": "server-generated-id" }`  
Failure: `{ "ok": false, "error": { "code": "FORBIDDEN", "message": "Request not permitted" }, "requestId": "server-generated-id" }`

Never return stack traces, raw Firestore errors, private paths or secrets.

## 4. Read endpoints

- `GET /api/admin/dashboard`: bounded aggregates only: totalViews, totalAds, featuredAds, totalUsers; unavailable values may be null. No full scans per page load.
- `GET /api/admin/products?pageSize=&pageToken=&q=`: pageSize 1–50 (default 25); opaque cursor; bounded query; minimal Ads-table fields including sellerUid and moderation flags.
- `GET /api/admin/users?pageSize=&pageToken=&q=`: pageSize 1–50; opaque cursor; UID, displayName and approved identity fields only. Email/IP are excluded unless separately approved for a documented purpose and authorized Owner Admin.
- `GET /api/admin/users/{uid}/summary`: validated UID; minimal account/listing summary; activity has source label or is unavailable.
- `GET /api/admin/stores?pageSize=&pageToken=&q=`: paginated store review queue and approved public/operational fields only.
- `GET /api/admin/reports?pageSize=&pageToken=&status=`: paginated reports with case, target, status and reason metadata; no arbitrary collection paths.
- `GET /api/admin/audit?pageSize=&pageToken=&targetType=&targetId=`: read-only, paginated, append-only audit history; field-minimized and access itself audited.

Firestore substring search is not native; document a prefix/token strategy before promising parity with browser includes() search. Never download all records to browser.

## 5. Mutation endpoints

All mutations require server-derived actor identity, active role, validated input, reason/case where appropriate, idempotency protection for retryable operations, and an append-only audit event.

- `POST /api/admin/products`: create an operational listing only with validated schema; client cannot set privileged flags directly.
- `PATCH /api/admin/products/{id}`: allowlisted edits only.
- `POST /api/admin/products/{id}/feature` and `/verify`: explicit feature/verification state transition.
- `POST /api/admin/products/{id}/quarantine` and `/restore`: reason code, bounded reason, optional case ID, atomic state + audit event.
- `POST /api/admin/users/{uid}/suspend` and `/restore`: reason required; no client-side direct document mutation.
- `POST /api/admin/users/{uid}/deletion-request`: creates an idempotent deletion task only; actual cleanup is a separate resumable trusted workflow.
- `POST /api/admin/stores/{uid}/review`, `/verify`, `/suspend`, `/restore`: validated state transitions and audit.
- `POST /api/admin/reports/{id}/resolve` and `/escalate`: case-linked moderation workflow and audit.
- `PATCH /api/admin/settings/{key}`: allowlisted business settings only; no Firebase/Vercel infrastructure or secret configuration.
- `POST /api/admin/products/{id}/permanent-delete`: disabled until retention, legal hold, evidence preservation, approval and recovery controls exist.

Private chat access is not a general list endpoint. It requires case-linked safety authorization and is separately audited.

## 6. Role boundaries

The active Admin can use all approved platform-management operations above. Admin cannot grant/revoke/promote Admin identities, change own role, edit the role registry, disable/erase audit records, read passwords/tokens/service credentials/API secrets, or manage Production infrastructure. Only the owner-controlled process can manage Admin identities.

## 7. Audit event minimum

Server-generated immutable eventId; eventType; targetType/targetId; actorUid and actorRole derived server-side; server timestamp; allowlisted reasonCode and bounded reason; optional caseId; restricted beforeSnapshotRef; requestId. Clients cannot write/update audit events. Audit write failure must fail sensitive mutation safely.

## 8. Pagination and query safety

Enforce page size server-side, stable ordering, opaque query-bound cursors, normalized bounded filters, deliberate indexes, rate limits and minimal non-cacheable sensitive responses. Never accept arbitrary collection paths or sort fields.

## 9. Migration and release gates

1. Confirm backend runtime, staging project binding, region, billing, service identity, IAM and secret storage.
2. Implement token verification and role resolution in staging only.
3. Implement read-only APIs and integration tests.
4. Migrate Admin UI away from broad direct Firestore reads.
5. Implement audited reversible moderation and safe account lifecycle workflows.
6. Prepare candidate Firestore Rules only after schema inventory and client migration.
7. Run Emulator and backend integration tests.
8. Obtain explicit approval before staging deployment or Rules publication.
9. Production is a separate project and needs separate explicit authorization.

## 10. Explicit non-goals

This contract does not create endpoints, grant roles, define Firestore Rules, alter Firebase projects, migrate records, or authorize deployment.
