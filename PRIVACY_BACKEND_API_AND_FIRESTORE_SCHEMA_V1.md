# OLDX Privacy Backend API and Firestore Data Schema — V1

**Status:** Architecture contract only — no runtime implementation  
**Branch:** `security-hardening-review`  
**Related UX:** `PRIVACY_SETTINGS_SCREEN_UX_PLAN.md`  
**Related policy:** `USER_PRIVACY_CONTROLS_AND_DATA_RETENTION_POLICY.md`

## 1. Security and deployment boundary

This document defines a proposed backend contract and logical Firestore schema. It does not create endpoints, collections, indexes, rules, secrets, service identities, provider resources, or deployments.

- Keep Firebase Staging project `oldx-staging` Firestore rules deny-all.
- Do not change Production project `oldx-1c983`, `main`, or the live site.
- Do not read, copy, migrate, or delete live user records.
- Do not use a service-account credential or privileged Firestore REST token as a shortcut.
- Client-side checks are UX only; all sensitive decisions must be enforced by a trusted backend and collection-specific database authorisation.
- If authentication, authorisation, consent state, or persistence cannot be verified, fail closed.
- No API may return a success state before the authoritative write is committed and verified.

## 2. Identity and request envelope

Every authenticated endpoint must:
1. Accept a Firebase ID token over HTTPS.
2. Verify its signature, key ID, expiry, issued-at time, audience, issuer, subject, and authentication time according to `FIREBASE_ID_TOKEN_VERIFICATION_CONTRACT.md`.
3. Derive the caller UID from the verified token only. Never accept a caller UID as authority from the request body or query.
4. Reject missing, malformed, expired, revoked/disabled-account, or wrong-project credentials.
5. Apply rate limits and request-size limits before expensive work.
6. Return a correlation/request ID that contains no personal data.

The browser must never submit a target UID and be allowed to act as that target. A target UID may be accepted only as a resource identifier after the backend verifies the caller's permission to perform the action.

## 3. Logical Firestore schema

All paths below are proposed names, not existing collections. Create them only after owner approval, migration design, collection-specific rules, and emulator tests.

### 3.1 Private account settings

`privateUserData/{uid}`
- Private profile/contact fields and sensitive account metadata.
- No public client query.
- Read only by the owning authenticated user through an explicitly authorised endpoint, or by narrowly authorised trusted services.
- Writes to sensitive fields are server validated.
- Never mix these fields into public listing documents.

`privateUserData/{uid}/privacy/preferences`
- `schemaVersion`: integer.
- `contact.phoneVisibility`: enum `private | selectedListings | selectedStores`.
- `contact.whatsappVisibility`: same enum.
- `location.publicDisplay`: enum `approximateArea | hidden`.
- `location.exactLocationSharing`: enum `private | explicitFeatureConsent`.
- `presence.onlineVisibility`: enum `hidden | visible`.
- `presence.lastSeenVisibility`: enum `hidden | approximate`.
- `notifications.messagePreview`: enum `generic | full`.
- `updatedAt`: server timestamp.
- `updatedBy`: trusted actor marker; never a client-supplied UID.

Use safe defaults when a field is absent: contact private, exact location private, presence hidden, generic notification preview. Do not interpret missing fields as consent.

### 3.2 Granular consent ledger

`privateUserData/{uid}/consents/{consentId}`
- `purpose`: allow-listed purpose enum.
- `field`: allow-listed field enum (e.g. `phone`, `whatsapp`, `exactLocation`).
- `scopeType`: `listing | store | feature`.
- `scopeId`: validated resource identifier.
- `policyVersion`: version of reviewed user-facing consent text.
- `grantedAt`: server timestamp.
- `revokedAt`: server timestamp or null.
- `status`: `active | revoked`.
- `source`: allow-listed UI surface.
- `requestId`: idempotency/correlation reference.

Consent records are append-only from the client perspective. Clients cannot create, edit, or delete consent records directly. A trusted service records grant and revocation events. A revocation must take effect for subsequent reads once the server confirms it.

Do not use one broad consent flag for unrelated data fields or multiple listings/stores.

### 3.3 Public listing/store projection

Publicly readable listing/store documents must contain only explicitly approved fields. They must not contain private contact details, exact coordinates, IP addresses, internal moderation data, or unreviewed user-provided fields.

The public projection is updated only by trusted publication logic after validating the corresponding active consent for each optional field. Revocation must remove the optional field from future public responses and public projections through a reliable, retryable operation.

### 3.4 Blocks

`privateUserData/{uid}/blockedUsers/{targetUid}`
- `createdAt`: server timestamp.
- `status`: `active | removed`.
- `reasonCode`: optional allow-listed category; no free-text sensitive details by default.

Only the caller may manage their own block list. The target user must not be able to read who blocked them. Backend and chat authorisation must enforce the block in both relevant directions according to approved product semantics. Unblocking is an authenticated, audited operation.

### 3.5 Reports

`moderationReports/{reportId}`
- `reporterUid`: verified caller UID.
- `reportedUid`: validated subject UID where known.
- `resourceType` and `resourceId`: allow-listed reference.
- `reasonCode`: allow-listed reason.
- `evidenceRefs`: references to authorised evidence, not arbitrary external URLs.
- `createdAt`, `status`, `reviewedAt`: server-controlled.
- Internal reviewer notes live in a separately restricted field/path and are never returned to the reporter.

Only trusted services create/update report records. Reporters can read a minimal status projection for their own report; they cannot read reviewer notes or other users' reports.

### 3.6 Export and deletion requests

`accountDataRequests/{requestId}`
- `uid`: verified requester UID.
- `type`: `export | deletion | correction`.
- `status`: `received | processing | waitingReview | blocked | completed | failedRetryable`.
- `createdAt`, `updatedAt`: server timestamps.
- `progressCode`: coarse stage enum; do not expose internal paths or other users' data.
- `resultRef`: optional short-lived authorised export reference.
- `failureCode`: safe, non-sensitive error enum.
- `idempotencyKeyHash`: hash of client-supplied idempotency key; never store raw secrets.

Request records are created and advanced by trusted backend logic. The requester can read only their own safe status projection. Export files must be private, short-lived, access-controlled, and never placed in a public bucket.

## 4. API contract

Base path is illustrative: `/api/v1/me`. All endpoints require verified authentication unless explicitly marked otherwise. Use JSON, HTTPS, strict content-type and payload limits.

| Method and route | Purpose | Important enforcement |
|---|---|---|
| GET `/privacy` | Read caller's safe privacy preferences | UID derived from token; no other user's data |
| PATCH `/privacy` | Update allow-listed non-consent preferences | Validate schema/version; reject unknown keys; server timestamp |
| POST `/consents/grant` | Grant a specific field/purpose/scope | Explicit confirmation, reviewed policy version, resource ownership |
| POST `/consents/revoke` | Revoke a specific consent | Caller ownership; immediate deny for subsequent disclosure; retryable projection cleanup |
| GET `/consents` | List caller's own consent history | Paginated, bounded, no other UID |
| GET `/blocks` | List caller's blocked accounts | Caller-scoped and paginated |
| POST `/blocks` | Block a target account | Target validation, self-block rejection, idempotent |
| DELETE `/blocks/{targetUid}` | Unblock target | Caller-scoped; audited |
| POST `/reports` | Submit a report | Rate-limited; minimum evidence; idempotency |
| GET `/reports/{reportId}` | Read safe report status | Reporter ownership only |
| POST `/data-requests` | Request export or deletion | Re-authentication/step-up where needed; idempotency |
| GET `/data-requests` | List own request statuses | Caller-scoped and paginated |
| GET `/data-requests/{requestId}` | Read one own request | Ownership; safe status only |

Do not add a generic endpoint that accepts arbitrary Firestore paths, field names, roles, or document patches.

## 5. Validation and consistency rules

- Reject unknown fields, enum values, oversized strings, invalid IDs, and unsupported schema versions.
- Never trust `uid`, `sellerUid`, `isAdmin`, `isVerified`, `isFeatured`, role names, timestamps, or consent booleans supplied by the browser.
- Use server timestamps and deterministic allow-lists.
- Use idempotency keys for consent changes, block/report requests, and data requests.
- Use bounded pagination with stable cursors; no unbounded collection scans in user-facing requests.
- Enforce per-user and per-IP rate limits where appropriate, without requiring IP collection for ordinary sign-in.
- Keep sensitive writes transactional where supported. For multi-step changes, use durable job state and reconciliation rather than pretending multiple documents changed atomically.
- Never return raw Firestore errors, stack traces, private document paths, tokens, or internal moderation data to the client.

## 6. Consent and publication consistency

A field is eligible for public exposure only if all conditions are true:
1. The caller owns the listing/store or has the explicit authority to manage it.
2. The requested field is allowed for that surface.
3. An active consent record exists for the exact field and resource scope.
4. The policy version is currently accepted for that operation.
5. The trusted publication service has validated the underlying field value.
6. No block, moderation, account state, or policy restriction prevents disclosure.

Revocation sequence:
1. Persist revocation as the authoritative decision.
2. Make API reads deny disclosure immediately after confirmation.
3. Enqueue projection/cache cleanup with an idempotent job.
4. Retry until all known public projections and caches are reconciled.
5. Report completion only after required checks pass; if cleanup is pending, display a truthful pending state.

## 7. Error response shape

Use a stable, non-sensitive shape:

```json
{
  "error": {
    "code": "CONSENT_REQUIRED",
    "message": "This action needs your permission.",
    "requestId": "opaque-correlation-id"
  }
}
```

Suggested codes: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONSENT_REQUIRED`, `RATE_LIMITED`, `CONFLICT`, `UNAVAILABLE`, `REQUEST_PENDING`.

Do not expose whether another user's private record exists. Use the same safe not-found/forbidden behaviour where existence itself is sensitive.

## 8. Required security and UX tests

Before implementation is approved, add tests for:
- User A cannot read/update User B's preferences, consents, blocks, reports, or requests.
- Forged UID, role, consent, server timestamp, or policy version is ignored/rejected.
- Missing consent never exposes phone, WhatsApp, or exact coordinates.
- Consent for one listing cannot expose a different listing/store.
- Revocation blocks disclosure before asynchronous projection cleanup finishes.
- Stale client cache and weak-network retry do not restore revoked consent.
- Repeated idempotent requests do not create duplicate reports or deletion jobs.
- Account switching does not leak cached preferences or saved content.
- Block enforcement applies to chat/message operations server-side.
- Export links are private, scoped, short-lived, and non-enumerable.
- Deletion status never reports completion while required records/media remain unresolved.
- Rate limits and bounded pagination prevent resource exhaustion.
- Every privileged access and mutation produces a safe audit event.

Run Firestore Emulator and Storage Emulator tests with synthetic identities and synthetic documents only. Do not import Production data or real user identities.

## 9. Operational and cost posture

- Reuse the existing Firebase Auth identity system; do not migrate accounts.
- Keep the API narrow and user-scoped initially.
- Do not introduce a privileged service-account-based Firestore bypass.
- Benchmark token verification and API CPU/request limits before selecting a runtime.
- Use bounded payloads, pagination, and idempotent operations to control reads/writes and retries.
- Do not process image bytes or large exports in a low-CPU request handler.
- Define rate limits and a manual disable/kill switch before any rollout.
- Any provider, region, paid plan, IAM, secrets, or budget decision remains subject to owner approval.

## 10. Implementation sequence and release gates

1. Owner approves schema fields, defaults, retention, and user-facing consent copy.
2. Select backend platform and identity-verification approach with cost and compatibility review.
3. Implement pure validation/authorisation functions and synthetic unit tests.
4. Implement one read-only preference endpoint in isolated Staging backend only after approval.
5. Add collection-specific Firestore rules and emulator tests; do not loosen deny-all until this gate passes.
6. Implement preference writes, then consent grant/revocation with consistency tests.
7. Implement blocks/reports only after chat moderation semantics are approved.
8. Implement export/deletion only after data inventory, retention exceptions, and external media reconciliation are verified.
9. Conduct security review, low-end Android/weak-network UX test, rollback rehearsal, and owner acceptance.
10. Production release requires a separate explicit approval.

## 11. Explicit non-goals

This contract does not create collections or endpoints, write Firestore rules, add dependencies, create runtime backend code, provision Cloudflare/Vercel/Firebase resources, create IAM or secrets, enable Storage, change billing, migrate data, or deploy any code.

**Until all required approvals and test gates pass, Staging Firestore must remain deny-all.**
