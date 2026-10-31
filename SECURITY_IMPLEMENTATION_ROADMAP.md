# OLDX Security Implementation Roadmap — Review Branch

**Branch:** `security-hardening-review`  
**Status:** Consolidated execution plan; design only.  
**Production boundary:** No merge to `main`, no Production V13 change, no Firebase Production project `oldx-1c983` access, and no Rules publication without separate explicit owner approval.

## Executive status

The review branch now contains source inventories and contracts for:
- staging configuration separation and local Emulator safety;
- Admin access and Admin API;
- Product, Chat and Store write permissions;
- account deletion and privacy lifecycle;
- Cloudinary store-photo and chat attachment security.

These are planning and test-preparation artifacts. They do not mean the backend, Firestore Rules, upload migration, or account-deletion worker exists. Staging Firestore remains deny-all by design. No production migration is authorized.

## Phase 0 — Preserve the safety boundary (ongoing)

- Keep all changes on `security-hardening-review`.
- Keep `main`, Production V13 and Firebase project `oldx-1c983` untouched.
- Use synthetic staging identities and records only.
- Never commit service-account JSON, Admin private keys, Cloudinary API Secret, or other server credentials.
- Do not relax staging deny-all Rules merely to make the preview appear functional.
- Treat CI build success as a code/build signal, not proof that Firebase runtime flows work.

**Exit gate:** branch and project boundaries confirmed; no secret scan or diff check reports an unintended production/configuration change.

## Phase 1 — Make the review branch testable locally

1. Run `npm run test:emulator:safety` in a clean Node.js 24 environment.
2. Fix test harness issues before adding more policy logic.
3. Add Firebase Emulator dependencies and Rules test libraries only after the test command is stable and package lock is committed.
4. Add a local-only Emulator startup/test script using project ID `demo-oldx-emulator`; it must fail closed if a live project ID or non-loopback Emulator host is selected.
5. Add CI execution for the dependency-free tests; separately confirm actual workflow run status rather than assuming a commit created a successful run.

**Exit gate:** tests run locally and in CI with recorded passing output; no external Firebase project is contacted.

## Phase 2 — Complete schema and access inventory

Complete before authoring Rules:
- Product dynamic `extraDetails` category schemas, image limits and all alternate write paths.
- Chat room creation, typing, read receipts, hide-for-me, delete-for-everyone and block behavior.
- Store public/private field split and explicit contact-field consent.
- All product/profile/store/chat media upload paths and storage ownership conventions.
- User data dependencies: saved ads, blocked users, presence, IP, push tokens, traffic counters and all UID references.
- Account deletion and shared-chat retention decisions.
- Admin list/detail fields, actions and owner-approved role identity.

**Exit gate:** every collection and write path has an owner, allowed field set, data classification, and positive/negative test cases. Unknown behavior remains a blocker, not an assumed permission.

## Phase 3 — Approve staging backend foundation

Before implementation, owner must choose/confirm:
- backend runtime (Firebase Cloud Functions 2nd gen or another supported trusted runtime);
- staging-only project binding, region and billing implications;
- service identity and least-privilege IAM;
- secrets storage mechanism;
- logging/monitoring and retention;
- whether any backend already exists outside this repository.

No Admin API, upload signer, deletion worker, traffic endpoint, or backfill script should be deployed before this decision. Keep credentials in managed secret storage, never in browser code or Git.

**Exit gate:** approved staging-only architecture and service identity, with proof that no production project is targeted.

## Phase 4 — Implement read-only trusted Admin API

- Verify Firebase ID tokens server-side.
- Resolve role from a server-controlled allowlist/custom claims; no request-body role or UID trust.
- Preserve one owner-approved Admin identity; no additional roles without approval.
- Implement paginated product and user summaries with strict field allowlists.
- Implement bounded dashboard aggregates; no full collection scans per page load.
- Audit sensitive reads; return `no-store` responses.
- Keep destructive operations disabled.

**Exit gate:** Emulator/integration tests prove 401/403 behavior, pagination, field minimization, rate limits and staging-only isolation. Admin UI still works with synthetic data.

## Phase 5 — Migrate data and client access compatibly

- Add `publicProfiles/{uid}` and `privateUsers/{uid}` with explicit schemas.
- Implement trusted dual-write/backfill, with checkpoints and reconciliation; never backfill from browser code.
- Switch public profile/presence reads to publicProfiles.
- Switch saved ads and blocked-user data to privateUsers.
- Preserve legacy `users/{uid}` during a verified compatibility period.
- Move visitor counter writes to trusted backend before denying client writes to `stats`.
- Do not remove legacy fields/documents until all supported clients and flows pass regression checks.

**Exit gate:** new/existing synthetic accounts pass signup, login, profile, presence, saved ads, block, chat and Admin regression tests; reconciliation has no unexplained differences.

## Phase 6 — Harden Products, Stores and Chats

- Remove client assignment of privileged product flags.
- Enforce seller ownership and explicit editable-field allowlists while preserving seller's two-way `isSold` toggle.
- Separate public Store profile fields from private contact details; public exposure requires explicit product decision/consent.
- Enforce immutable Chat participants/product link and participant-scoped message operations.
- Move block enforcement to a trusted or Rules-verifiable model without exposing private block lists.
- Only now write candidate `firestore.rules`; run all positive and negative Emulator tests.
- Keep Rules publication as a separately approved action, even for staging.

**Exit gate:** complete Rules Emulator matrix passes, including guest, seller A/B, chat participant/non-participant, Store owner/non-owner and Admin cases. No live Rules are published automatically.

## Phase 7 — Secure media uploads

- Replace unsigned Cloudinary store upload with signed upload intent/confirm flow.
- Store verified `public_id` and asset metadata while keeping legacy `photoURL` rendering.
- Move Chat attachments from Firestore data URLs to private participant-scoped object storage.
- Verify content metadata server-side; apply size/type limits and rate limits.
- Add idempotent orphan cleanup and retention-aware deletion.
- Do not disable legacy upload until all deployed clients are migrated and rollback is tested.

**Exit gate:** upload ownership, replay, oversize, MIME mismatch, private download, cleanup retry and legacy rendering tests pass.

## Phase 8 — Admin moderation and account deletion

- Add reversible quarantine/restore with reason and append-only audit events.
- Keep permanent delete disabled until retention/legal hold and recovery are approved.
- Implement account deletion only after reauthentication, durable idempotent task creation, resumable bounded cleanup, shared-chat policy and media cleanup are implemented.
- Delete Auth identity only at the approved final stage; mark completion only after postcondition checks.
- Keep sensitive evidence purpose-limited, access-controlled and retention-limited.

**Exit gate:** fault-injection tests prove safe resume, no premature deletion, legal hold handling and accurate status.

## Phase 9 — Staging acceptance and owner review

- Run full synthetic end-to-end tests against `oldx-staging`.
- Verify login, product browsing, seller create/edit/sold toggle, Store, Chat, saved ads, upload, Admin read-only views and deletion request lifecycle.
- Verify logs and bundles contain no server secrets.
- Record known issues and rollback steps.
- Obtain explicit owner approval before any staging Rules publication or staging service deployment.

Production remains a separate project, requiring a new migration plan, separate risk review and explicit authorization. This roadmap does not grant that authorization.

## Current blockers (must be resolved, not guessed)

1. Actual local/CI test execution status and dependency readiness.
2. Backend platform, region, billing and staging service identity.
3. Product dynamic field and image schema.
4. Store public/private data decision and contact consent.
5. Chat block and shared-message retention policy.
6. Complete media path inventory and Cloudinary preset verification.
7. Admin role source and final minimal fields.
8. Account deletion retention/legal hold decisions.

## Work sequence for the next engineering pass

Start with Phase 1: verify the dependency-free Node tests and CI workflow, correct any failures, then add the Firebase Emulator test dependencies and an isolated local Rules test harness. Do not create deployable Rules until the Phase 2 schemas are complete.

**No production resources, Firebase Rules, Cloudinary settings, user records, or deployed application code are changed by this roadmap.**
