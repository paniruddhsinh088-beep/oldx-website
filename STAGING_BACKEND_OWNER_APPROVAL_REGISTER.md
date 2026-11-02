# OLDX Staging Backend Owner Approval Register

Status: decision register only. No approval is implied by creating this file. No staging or production resource has been accessed or changed by this document.

## Non-negotiable scope

- Permitted future target, only after explicit approval: Firebase project `oldx-staging`.
- Forbidden: Production Firebase project `oldx-1c983`, branch `main`, live domain `oldxbazar.in`.
- Current Staging Firestore rules remain deny-all.
- No Storage rules deployment, billing upgrade, data migration, real user/admin role assignment, IAM change, secret creation or deployment is authorized.
- Never share credentials, private keys, service-account JSON, access tokens or passwords in chat, source code or GitHub.

## Decisions required before trusted runtime implementation

Each decision must be explicitly approved by the owner. A blank or undecided item means STOP.

| ID | Decision | Options to evaluate | Required evidence / safe default |
|---|---|---|---|
| D1 | Backend platform | Vercel Functions (same application hosting); Firebase Cloud Functions; another approved managed runtime | Compare runtime compatibility, auth integration, region, operational ownership and cost. No platform selected. |
| D2 | Region | A supported region near intended users and compatible with Firestore/storage location | Confirm latency, data location, provider support and cross-region charges. Do not guess from user location. |
| D3 | Image storage provider | Cloudflare R2, Cloudinary, Firebase Storage, Supabase Storage | Review current pricing, egress, image processing, private-object capability, upload restrictions, deletion and legal/data-location requirements. No provider selected. |
| D4 | Traffic and budget | Expected monthly active uploaders, uploads per surface, average processed size, image views, monthly spend ceiling | Define hard budget/alerts and abuse reserve. If unknown, no billable provisioning. |
| D5 | Quota values | Current draft policy: Product 6×5 MiB, Store 1×5 MiB, Profile 1×2 MiB, Chat 1×3 MiB; per-hour draft quotas in `IMAGE_UPLOAD_ABUSE_AND_CLEANUP_POLICY.md` | Confirm product UX and abuse assumptions. Draft values are not active. |
| D6 | Retention | Quarantine grace, rejected-file retention, audit retention, quota-ledger retention, user deletion behavior | Define legal, privacy, support and cost needs. Safe default: no automated live deletion until reviewed. |
| D7 | Service identity and IAM | Dedicated staging-only service identity with minimum permissions | List exact required operations and IAM roles; no Production identity reuse. |
| D8 | Secret management | Approved managed secret store and rotation/incident process | Secrets entered directly in provider secret manager by owner; never pasted into chat or committed. |
| D9 | Data scope | Exact collections/fields and read/write operations needed | Begin with synthetic tests; live access read-only and aggregate-only after separate approval. |
| D10 | Audit and moderation | Who reviews reports, how approval/rejection is recorded, retention and escalation | No public image derivative until trusted moderation state is established. |
| D11 | Rollback and incident response | Named owner/contact, disable switch, capability revocation and restore procedure | Test in non-production before rollout. |
| D12 | Release gates | Emulator tests, staging-only smoke test, security review, owner sign-off | Production remains separately gated and is not part of this plan. |

## Required technical gates after approval

1. Confirm trusted runtime project ID equals exactly `oldx-staging`; otherwise startup and every privileged operation fail closed.
2. Use a dedicated staging service identity and least privilege.
3. Keep secrets server-side; no browser credentials or repo secrets.
4. Implement verified token authentication, server-derived actor UID, ownership checks and strict operation-specific schemas.
5. Implement atomic quota reservations, idempotency and rolling-window concurrency tests.
6. Validate uploaded bytes and decoded image content server-side; client metadata is never authoritative.
7. Keep objects private in quarantine; publish only approved derivatives.
8. Implement append-only audit events atomically with privileged mutations.
9. Prove owner/participant revocation, cross-user isolation, cleanup race safety and rollback with emulator/integration tests.
10. Perform any live Staging read-only audit only after separate written approval; emit aggregate metadata only.

## Approval record

No approvals have been supplied or recorded in this repository. Approval must be explicit and scoped to named decisions (D1–D12). Approval of a design document is not approval to provision, access data, deploy, change rules or incur charges.

## Current state

- Backend starter: source-only dependency-injected helpers.
- Image upload: provider-neutral contracts and local policy models only.
- Firestore Staging rules: deny-all.
- Storage: no runtime integration or rules deployment; no billing change.
- Live Staging data audit: not run.
- Production: untouched and out of scope.

See also:
- `functions/admin-backend/STAGING_BACKEND_PREFLIGHT.md`
- `IMAGE_UPLOAD_BACKEND_ATOMIC_QUOTA_CONTRACT.md`
- `IMAGE_STORAGE_PROVIDER_COST_AND_SECURITY_COMPARISON.md`
- `PRODUCTS_PUBLIC_PRIVATE_MIGRATION_PLAN.md`

### Limited repository/testing authorization — 2 November 2026

Owner explicitly authorizes repository-only Firebase/Vercel architecture code and
isolated mock/emulator testing at zero additional spend. This is not selection or
approval of D1–D12 live runtime/schema/region/IAM/secrets/cost/resource/deployment
choices. No live data, Rules changes, provider setup or release activation approved.

### Owner-approved Service design — 2 November 2026

Approved for DESIGN AND REPOSITORY-ONLY DEVELOPMENT: Gujarat-first text-only Service
Providers on existing Firebase Auth/Firestore architecture; one profile per verified
owner with multiple services; private drafts and explicit authorized publication;
strict public fields with no public IP/private personal data/exact GPS. Preserve
Products, Stores, Chat and future media/reviews. No new paid infrastructure.

The [v1 proposal](docs/proposals/service-provider-schema-v1.md) translates this semantic
design into candidate paths, identity/index and compatibility contracts. Proposed
paths/index JSON remain unactivated. This is not approval to use those collections
in a live project or deploy indexes/Rules. D9 feature/data design is approved only
at this scope; actual operational schema binding/access remains unapproved. Existing
architecture choice is approved in principle, not D1/D2 runtime/account/region setup.
D6 retention/privacy operations, D7/D8 IAM/secrets, D10 eligibility/moderation/role
provisioning and D11/D12 staging/rollback/release actions remain unapproved. No live
reads/writes, migration, billing, resource, Rules or deployment approval inferred.

## Owner bootstrap ports and photo audit — 2 November 2026

Repository-only approval permits the disabled owner-private HTTP/UI binding and
mock-only image lifecycle preparation. It does not authorize actual owner endpoint,
provider credentials, media runtime or changes to the existing unsigned Store preset.
[Source audit/evaluation](docs/photo-storage-audit-and-inactive-adapter-2026-11-02.md)
records Cloudinary Free as a candidate, not an approved replacement for existing
storage or the previous R2 comparison. No photo migration or Service media policy
approval. Existing images, staging deny-all and HOLD/NO-GO are preserved.

Still require explicit decisions on image provider/account terms/free-tier/runtime
eligibility, per-surface visibility, trusted processing/moderation, quota hard stops,
private delivery/revocation, retention/deletion/backups, journal schema and migration.
Any account/preset/secret/IAM/Rules/resource/deployment action remains separately gated.
The approved Gujarat-first v1 design stays text-only; repository mocks do not prove
live identity, authorization, spending controls or actual provider functionality.

## November 7 target / integration preparation — 2 November 2026

Owner's new instruction prioritizes repository-only launch preparation, mandatory
photo contracts and isolated journal/enquiry tests. This does not authorize runtime,
IAM/secrets, live provider/Firebase access, Rules/indexes, staging/deployment, billing,
media migration or production actions. The approved Provider v1 stays text-only;
future Provider media descriptors do not add fields to that schema. All agreed
requirements remain in the [P0/P1 launch register](docs/launch-decision-register-2026-11-07.md).
November 7 remains a target, with HOLD/NO-GO until evidence/approval gates are met.

## Durable repository / essential locale preparation — 2 November 2026

New demo/loopback SDK enquiry, Product/Store and private photo-association mappings
are repository/isolated-test code only. `testOldx*` namespaces are test fixtures, not
approved operational schemas; Provider v1 keys remain text-only. No runtime resource,
Rules/index, IAM/secret, media provider, migration, billing, deployment or release
approval inferred. Essential locale/control and password-byte fixes change repository
UI source, not authentication configuration. All P0 requirements and HOLD/NO-GO remain.

## Media journal/delivery and portable UI ports — 2 November 2026

Repository-only/isolated testing now includes durable quota/attempt/registry/delete/
reconciliation and private/public media contracts. Public-release records and proof/
token verifiers in tests are synthetic authority, not permission to expose images.
No actual media provider, moderation/release writer, service-worker identity, byte
gateway, quota reset, retention worker or native app is approved or activated.
Provider v1 remains unchanged/text-only; media stays in unactivated separate namespaces.
All runtime, schema/index, identity/role/rate/quota/cleanup, consent/privacy/retention,
media, IAM/secrets/resource/staging/deployment/migration/billing/release gates remain.
