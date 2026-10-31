# OLDX Profile Access-Control Test Matrix

**Branch:** `security-hardening-review`  
**Status:** Security contract and synthetic reference-model tests only. Not deployable Firestore Rules.  
**Safety:** No user data, Firebase project, Production setting, or deployment is touched.

## Intended boundary

- `publicProfiles/{uid}`: only the explicitly approved display projection. Current candidates are `displayName` and `photoURL`; product-owner approval is still required before enabling public reads or writes.
- `privateUsers/{uid}`: owner-only preferences such as `savedAds` and `blockedUsers`.
- Trusted server collections: role registry, verified security signals, audit records and migration checkpoints. Client SDK access is denied.
- Legacy `users/{uid}`: keep compatibility behavior unchanged until a separately approved migration and cutover.

## Test matrix

| Actor | Resource | Read | Create/update | Delete | Expected |
|---|---|---:|---:|---:|---|
| Guest | Public profile | Candidate allow | Deny pending owner/backend decision | Deny | Public projection only |
| Signed-in user A | Public profile A | Candidate allow | Candidate owner-only, allowlisted fields | Deny pending lifecycle design | No arbitrary fields |
| Signed-in user B | Public profile A | Candidate allow | Deny | Deny | No cross-owner writes |
| User A | Private profile A | Allow | Allow owner fields only | Deny; deletion via trusted workflow | Owner only |
| User B | Private profile A | Deny | Deny | Deny | No cross-user access |
| Guest | Private profile A | Deny | Deny | Deny | No private access |
| Any client | Role registry / audit / verified IP / migration state | Deny | Deny | Deny | Trusted backend only |
| Admin client | Any user's private profile | No direct client bypass | No direct client bypass | No direct client bypass | Admin access through authenticated, audited backend API only |

## Required negative cases

1. A user cannot read or write another user's private document.
2. A guest cannot read private profile documents.
3. A user cannot add `email`, IP, role, audit, presence or arbitrary keys to the public projection.
4. A user cannot grant themselves Admin or modify the owner-managed role registry.
5. A user cannot read another user's block list to decide whether a message may be sent.
6. An Admin UI session without a valid server-verified role receives no privileged data.
7. A forged UID in request data does not override the UID from a verified Firebase ID token.

## Required positive cases (only after policy approval)

1. Guest and authenticated users can read only approved public profile fields.
2. User A can read and update A's private preferences.
3. User A's saved ads and block list remain available after profile separation.
4. Chat can display approved public fields without reading private profile data.
5. A seller retains the existing ability to toggle their own product `isSold` state; this profile test suite must not change product behavior.

## What this test suite does and does not prove

The adjacent reference model is a pure JavaScript specification used to check the intended allow/deny matrix with synthetic identities. It does **not** enforce Firestore access, test deployed Rules, validate Firebase Authentication, or authorize a migration. The existing Emulator baseline intentionally remains deny-all until the full data model, public-field decisions, trusted backend and migration plan are approved.

## Release gates

- Confirm public profile fields and presence visibility.
- Decide whether clients may update their own public display fields directly or must use a trusted backend.
- Implement candidate Rules only after the schema and write paths are complete.
- Run the matrix against Firestore Emulator with the candidate Rules.
- Verify old-client compatibility and synthetic account flows.
- Keep Production V13 and `oldx-1c983` untouched; no Rules deployment is part of this work.
