# Provider v1 design and owner recovery — 2 November 2026

Read AGENTS.md, fresh remote/log and clean `feb230f`, feature matrix, approvals,
UI/HTTP/SDK contracts and checkpoints. Preserved all prior/canonical automation
history. Recorded new owner-approved Gujarat-first text-only design scope distinctly
from runtime/IAM/privacy/retention/staging actions, which remain unapproved.

## Completed source/proposal

[Versioned schema proposal](proposals/service-provider-schema-v1.md) specifies ten
new, unactivated v1 collection paths, canonical opaque ID/owner mappings, exact public/
private document facts, GJ catalog, counters, proposed indexes and migration/legacy
compatibility plan. Index JSON is documentation-only, unreferenced by Firebase
configuration. SDK guard rejects the proposed runtime paths; tests use separately
versioned test namespaces. No new Rules file/change, resource or deployment.

Disabled v1 composition reuses existing atomic draft/publication ports with random
opaque candidate IDs and one-owner transaction uniqueness. No UID in public IDs,
caller owner/provider/role control or automatic publication. Multi-service drafts
and explicit independent publication/withdrawal permission are preserved.

New owner-private read-only bootstrap derives verified identity, validates current
eligibility, ownership/identity/draft/publication/generation/permission graph and
returns editable private fields, current counters/capabilities and minimal scoped
receipt outcomes. No allocation/write, UID/token/fingerprint/audit leakage. Historical
receipt cannot regress counters or grant current visibility. Missing receipt stays
unknown, never failed/rolled back; original body/key is required for safe retry.
Private DTO must never enter the public UI channel. No endpoint/UI activation.

## Verification / continuation

Focused transaction/integration tests passed 41 cases, including concurrent owner
allocation, duplicate keys, lost acknowledgement, stale revision, cross-account and
reserved identity mismatch, private-field rejection, withdrawal/historical receipt,
audit corruption, timeout and no-write bootstrap. A timeout fixture initially expired
before its fake dependency started; fixed the synchronization to exercise a genuinely
late dependency. No security assertions weakened. Actual SDK Emulator suite adds the
same v1 create/update/bootstrap/publish/withdraw/recovery sequence in isolated demo
state; no local actual Emulator claim. Full sweep/exact-source CI follow below.

Next shortest staging step: choose actual schema/runtime/identity/IAM binding and
role/quota/retention policies, validate owner bootstrap + private form restoration
under approved staging transport/session boundaries, then separately approve staging
Rules/data/deployment/rollback acceptance. Until those approvals, next safe task is
an inactive owner-only HTTP bootstrap composition and UI reconciliation binding,
keeping private form restoration distinct from public renderers and missing-receipt
unknown states blocked from silent replacement commands. Existing Login/Products/
Stores/Chat and future media/reviews remain untouched; HOLD/NO-GO and deny-all remain.

All 34 local non-emulator commands passed once in the combined sweep, including
41 transaction/enforcement/bootstrap integration cases. `git diff --check` passed.
No Firebase configuration or Rules file changed. Exact commands/counts:

| Command | Passed |
| --- | ---: |
| `npm run test:emulator:safety` | 78 |
| `npm run test:profile-migration` | 11 |
| `npm run test:admin-backend` | 115 |
| `npm run test:firebase-config` | 6 |
| `npm run test:product-migration` | 11 |
| `npm run test:product-category` | 8 |
| `npm run test:product-image-classifier` | 9 |
| `npm run test:image-upload-contract` | 7 |
| `npm run test:image-lifecycle` | 8 |
| `npm run test:image-upload-abuse` | 12 |
| `npm run test:inbox-summary` | 5 |
| `npm run test:chat-read-receipt` | 5 |
| `npm run test:chat-message-authorization` | 32 |
| `npm run test:account-deletion` | 7 |
| `npm run test:privacy-policy` | 12 |
| `npm run test:data-requests` | 7 |
| `npm run test:chat-privacy` | 9 |
| `npm run test:chat-block-policy` | 12 |
| `npm run test:chat-private-user-state` | 9 |
| `npm run test:service-providers` | 189 |
| `npm run test:emulator:guard` | 10 |
| `npm run test:service-preview` | 13 |
| `npm run test:service-preview:browser` | 23 |
| `npm run test:static-build` | 3 |
| `npm run test:i18n` | 11 |
| `npm run test:toolchain` | 2 |
| `npm run test:stores` | 81 |
| `npm run test:stores:browser` | 28 |
| `npm run test:stores:preview` | 3 |
| `npm run test:service-inbox:browser` | 7 |
| `npm run test:service-buyer:browser` | 6 |
| `npm run test:service-conversation:browser` | 7 |
| `npm run test:service-discovery:browser` | 6 |
| `npm run test:provider-draft:transaction` | 41 |
