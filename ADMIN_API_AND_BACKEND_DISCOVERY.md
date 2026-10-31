# OLDX Admin API and Backend Discovery — Phase 0 Deliverable

**Branch:** security-hardening-review  
**Status:** Discovery/design only; Admin timestamp display correction committed on review branch; no runtime or production changes.

## 1. Confirmed current Admin UI data requirements

Static inspection of `admin.html` on `security-hardening-review` (rechecked after the forensic timestamp correction):

### Users table currently renders
- displayName (fallback "Anonymous User")
- email
- lastIp
- uid
- Action: View Audit File

Search currently filters the in-memory full list by displayName and email.

### Forensic modal currently renders
- Name
- Registered email
- Auth UID
- Last IP
- A field labelled "Last Activity Timestamp"
- Count and title/price summary of listings where sellerUid equals userData.uid

**Data correctness correction (review branch):** the modal now displays the stored `userData.lastSeen` Firestore timestamp as "Last Recorded Activity (lastSeen)" when it is a Firestore Timestamp, and otherwise displays "Not available". The app writes `lastSeen` using `firebase.firestore.FieldValue.serverTimestamp()` in its presence update flow. This is a last-recorded presence timestamp, not a complete activity/authentication history. The correction is committed as `a8b02bbf5e71fa28c76cc38315592a291ea28fa8`; browser/emulator verification remains pending.

**Evidence limitation:** the current modal is not a complete forensic audit. It does not prove historical edits/deletions, authentication history, or chat evidence. The UI must label data by source and availability, and must not imply missing history exists.


## 1A. Current Admin page access and Firestore reads (static inspection)

- `admin.html` contains a hard-coded `AUTHORIZED_ADMIN_UID` and checks the signed-in UID in `auth.onAuthStateChanged`. A non-matching account is signed out and redirected. This is a client-side page gate only; it is not a substitute for Firestore Rules or server-side authorization.
- After that client-side check, `fetchAllAdminData()` reads `stats/traffic`, downloads the full `products` collection, and downloads the full `users` collection.
- Consequence: the currently supplied Rules' broad read permissions are what make these direct client reads possible. Tightening `users` or `stats` access before moving Admin reads to a trusted backend will break the dashboard. A client-side UID constant must not be treated as authorization for private records.
- Admin product moderation currently includes a direct client delete of a product document. This must move behind a verified Admin backend operation before Rules deny client admin deletes.
- The current all-record downloads are unbounded and expose more user/product data to the browser than a paginated, role-scoped API should return. Backend migration must preserve required dashboard workflows while minimizing returned fields.

## 2. Existing repository/backend discovery

The recursive Git tree for security-hardening-review contains index.html, admin.html, and security/audit Markdown documents.

No firebase.json, functions/ directory, backend source directory, or backend package.json was present in this branch tree at discovery time. Therefore there is no verified existing Firebase Functions backend to extend.

Before selecting/creating backend:
- Confirm Firebase project ID(s) and which are staging vs production.
- Confirm Firebase Auth providers and whether MFA is enabled/available for the owner/admin accounts.
- Confirm current Hosting setup and deployment workflow.
- Confirm whether the owner has a separate staging Firebase project.
- Select a supported runtime/region and establish private Admin SDK credentials/service identity. Never put service-account credentials in the browser or Git.
- Confirm whether Firebase Cloud Functions, Cloud Run, or another trusted backend is preferred and available under the project/billing setup.

## 3. Proposed Admin API contract (design only)

All endpoints require Firebase ID token verification on the server and an active owner-approved Admin UID/role allowlist check. Every request is denied by default. Sensitive responses are no-store and access-logged.

### GET /admin/users
Query: bounded pageSize (e.g. 25–100), opaque pageToken, q search term with strict length/rate limits, optional status/date filters.

Response (only verified admin):
- items[]: uid, displayName, email (if present), lastIp (only if required for current workflow), genuine lastSeen with source/meaning, createdAt if reliably available, account status
- nextPageToken
- totalCount only if computed safely/efficiently; avoid expensive full scans

Search/pagination must be server-side and index-aware. Firestore does not provide arbitrary substring search; do not claim current JavaScript includes() semantics will be preserved without choosing a search strategy. Options include prefix/token search or a dedicated search service. Never accept client-supplied Firestore paths/field names.

### GET /admin/users/{uid}/summary
Returns authorised admin summary: identity fields and verification state; real last activity or null/not-available; listing summaries/counts; moderation/report summary where present; linked evidence case IDs/status only for permitted roles.

### GET /admin/users/{uid}/evidence
Returns only case-authorised evidence references/metadata, not unrestricted raw user records. Require case assignment/role and log access.

### POST /admin/cases and POST /admin/cases/{caseId}/holds
Create case / scoped legal hold. Require reason, scope, legal basis/reference, review date, and approval. Hold/release events append to audit log.

### POST /admin/evidence-exports
Prepare a scoped export. Verify authority/request reference, scope, date range, approval(s), recipient, and secure delivery. Do not allow requester to approve their own export.

### POST /admin/users/{uid}/deletion-review
Create deletion job and check hold/retention obligations before any destructive operation. Never perform the old client-first destructive sequence.

### POST /admin/roles and DELETE /admin/roles/{uid}
Owner Admin only; require explicit approval, reauthentication/MFA, reason, and audit event. Role provisioning is a private trusted operation, never a normal user callable self-service action.

## 4. Admin role matrix proposal

| Capability | Owner Admin | Operations Admin | Evidence Reviewer | Read-only Admin |
|---|---:|---:|---:|---:|
| Full paginated user directory | Yes | If owner grants | Case-limited | Minimal |
| Listing/user moderation | Yes | Yes | No | No |
| View IP/security details | Yes | Explicit grant | Case-limited | No |
| Create/review evidence case | Yes | Request only | Assigned cases | No |
| Place/release legal hold | Approve | Request only | Request only | No |
| Prepare evidence export | Yes | No by default | Prepare only | No |
| Approve evidence export | Yes / second approver | No | No | No |
| Add/revoke Admin | Yes | No | No | No |
| Change retention/security config | Yes | No | No | No |

Owner must approve role assignment and exact field visibility before activation. Two-person approval is the default for high-risk exports/holds wherever staffing permits.

## 5. Data correctness and migration requirements

- Preserve existing table columns and user-management workflows.
- Replace client-side full collection download with backend cursor pagination.
- Search by name/email needs an explicit search design; Firestore substring search is not natively equivalent to JavaScript includes().
- IP field must include provenance and timestamp; a single lastIp value is not a historical connection log.
- Do not fabricate missing timestamps. Render "Not available" where there is no trusted stored event.
- Do not imply the current listing summary is a complete historical listing audit.
- Add audit events prospectively; historical events cannot be reconstructed unless another trustworthy source exists.
- Keep private email/IP inaccessible to ordinary users; Firestore Rules cannot redact fields in a publicly readable document.

## 6. Tests required before rollout

- Admin identity not allowlisted: all API calls denied, including direct calls.
- Approved Admin with valid token/MFA: allowed only within assigned role.
- Revoked Admin/stale token: denied promptly.
- Ordinary user cannot list/search all users or access email/IP/evidence.
- Page tokens cannot be forged to access arbitrary records.
- Search limits/rate limits and pagination do not omit users.
- Last activity displays stored source timestamp or "Not available", never modal-open time.
- Evidence reviewer cannot view unassigned cases or approve own export.
- Admin role changes and exports generate immutable audit events.
- Existing Ads, Saved Ads, Chat, Online Status, Stores, Product Edit, and seller Sold/Available toggle regressions pass.

## 7. Gate before coding/deployment

This is not yet implementation. No backend, Firestore Rules, claims, user schema, or production configuration has been changed. Before implementation, obtain staging project details and owner approval of backend runtime and role/field matrix. Production deployment remains a separate explicit approval.
