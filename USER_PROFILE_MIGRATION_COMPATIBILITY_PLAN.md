# OLDX Profile Split — Migration and Compatibility Plan

**Branch:** `security-hardening-review`  
**Status:** Design and acceptance contract only. No data migration, client cutover, Rules publication, or backend deployment.  
**Safety boundary:** Staging-only planning. Production V13, `main`, and Firebase Production project `oldx-1c983` remain untouched.

## 1. Goal

Separate public display information from private account preferences without breaking existing signup, login, saved ads, chat display, presence, blocking, Store pages, or account deletion.

Target collections (proposed):
- `publicProfiles/{uid}`: explicitly approved public display projection.
- `privateUsers/{uid}`: owner-only preferences and private settings.
- Trusted server-only collections: role registry, verified security signals, audit events and migration job state. Client SDK writes must be denied.

Do not remove or rename legacy `users/{uid}` in the first migration.

## 2. Conservative field placement proposal

| Existing field | Proposed destination | Initial migration treatment |
|---|---|---|
| `displayName` | `publicProfiles/{uid}.displayName` | Copy only if non-empty string and within agreed length |
| `photoURL` | `publicProfiles/{uid}.photoURL` | Copy only if valid HTTPS URL on approved provider/origin; otherwise omit |
| `name`, `fullName`, `username` | Public profile only after UI/ownership review | Do not blindly copy; resolve precedence first |
| `isOnline` | Undecided; possible coarse public presence | Do not migrate until visibility/consent policy is approved |
| `lastSeen` | Private or omitted | Do not expose publicly by default |
| `email` | Firebase Authentication; Firestore private only if a verified feature requires it | Do not copy by default |
| `savedAds` | `privateUsers/{uid}.savedAds` | Validate IDs and bounded list; preserve existing supported shape during compatibility period |
| `blockedUsers` | `privateUsers/{uid}.blockedUsers` | Validate UID list; private to owner |
| `lastIp` | No client-writable destination | Exclude from migration; any future security telemetry requires a separately approved trusted-server design |
| Product `userIp` | No client-writable destination | Exclude from migration; do not treat legacy values as verified evidence |

Store contact data is outside this split and remains subject to the separate Store privacy decision.

## 3. Migration prerequisites

Do not begin a data-writing migration until all are true:

1. Owner approves the exact public profile fields and presence visibility.
2. A trusted staging-only backend runtime, region, billing, service identity and secrets mechanism are approved.
3. A migration service can read legacy documents and write target collections with least privilege.
4. A dry-run report can show counts, invalid records, conflicts and proposed field transformations without changing data.
5. A per-user checkpoint and idempotency key are designed.
6. Backfill can be paused and resumed safely.
7. Legacy and target document deletion/retention is covered by the account deletion plan.
8. Emulator tests cover access boundaries and migration transformations.
9. A rollback/read-fallback strategy is tested with synthetic accounts.

## 4. Safe rollout sequence

### Stage A — Read-only discovery
- Use synthetic fixtures first.
- In staging only, aggregate field-presence counts and type/size anomalies.
- Do not export raw email, phone, IP, saved-ad or block-list values into logs.
- Produce a dry-run summary with counts only and redacted error categories.

### Stage B — Backend dual-write
- Add trusted backend-owned profile update operations.
- Validate Firebase ID token server-side.
- Derive UID from verified token, never request body.
- Write public projection and private preferences in a bounded transaction/task.
- Do not let browser clients write server-only fields.
- Keep legacy client writes active only during a documented compatibility window, with narrowly scoped field allowlists.

### Stage C — Backfill
- Process bounded pages.
- For each UID, read legacy data, normalize only allowlisted fields, and write idempotently.
- Preserve newer target values; do not overwrite a more recent owner-approved update with stale legacy data.
- Record checkpoint and aggregate result; do not log raw documents.
- Quarantine malformed records for manual review rather than guessing.

### Stage D — Client read cutover
- Chat display and public profile UI read `publicProfiles`.
- Saved ads and block settings read `privateUsers`.
- Presence remains disabled or follows the separately approved minimal visibility policy.
- During compatibility, use a controlled fallback to legacy reads only where needed; instrument fallback counts without personal data.
- Verify old and new clients do not overwrite each other's fields.

### Stage E — Legacy retirement
- Stop legacy writes only after all supported client versions and flows pass.
- Keep legacy reads temporarily if required by rollback.
- Remove legacy fields/documents only in a separate, approved, resumable cleanup after retention and account deletion checks.
- Never run cleanup as an incidental part of client login or page load.

## 5. Conflict and rollback rules

- Target collections are canonical only after explicit cutover.
- A newer target field wins over an older legacy snapshot.
- Never merge arbitrary legacy keys into target documents.
- A failed per-user migration must be retryable without duplicate side effects.
- A partial migration must not block sign-in or browsing.
- Rollback returns reads to legacy source while preserving target data; it must not delete target records.
- Stop the job automatically on unexpected write volume, permission failures, schema drift, or production project ID.

## 6. Acceptance tests

1. Dry run performs zero writes.
2. Migration rejects any project ID other than the approved staging project.
3. Migration rejects non-loopback emulator configuration in local test mode.
4. A synthetic user with valid public fields produces only the approved public projection.
5. Email, saved ads and block list never appear in public profile output.
6. IP fields are excluded.
7. Invalid photo URL, malformed saved-ad entries and invalid block UIDs are omitted or quarantined according to deterministic rules.
8. Re-running the same migration page is idempotent.
9. Newer target values are not overwritten by stale legacy data.
10. A mid-page failure resumes from checkpoint without duplicate audit or writes.
11. User A cannot read User B's private document.
12. Guest cannot read private profile documents.
13. Old-client fallback is observable without exposing personal data.
14. Account deletion can find and clean both legacy and target records via the approved resumable worker.
15. No production endpoint, secret, or Firebase project is touched.

## 7. Decisions intentionally left open

- Public fields: displayName and photoURL are candidates; owner confirmation and product UI review still required.
- Presence: public, chat-participant-only, or hidden; default migration is **do not expose**.
- Email: Auth-only unless a concrete feature proves Firestore copy is needed.
- Block enforcement: trusted message-send check or separately modeled block relation; never public-read of private block lists.
- Backend platform and service identity: requires owner approval before implementation.

## 8. Explicit non-goals

This plan does not create a backend, modify client behavior, change Firestore Rules, backfill data, delete legacy records, alter Vercel settings, or authorize any staging/production deployment.
