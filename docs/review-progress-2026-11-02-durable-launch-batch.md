# Durable launch integration batch — 2 November 2026

Started clean at `99fe4f510c7bec493382da02364da13711b6f4b1`, verified fresh remote
and `aaae4661`/`99fe4f5`, read AGENTS, launch/feature matrix, photo/journal/enquiry
contracts, approved design and release gates. All previous/automation history is
preserved; no remote update needed reconciliation. Managed network policy is still
restricted, no live credentials assumed and local official Emulator host download
remains blocked. Only repository/mock/CI Emulator development, zero extra spending.

## Implemented source

- Actual modular SDK enquiry transaction repository, default off and guarded to demo
  loopback/test namespaces. Fresh canonical Provider identity/owner/publication/view/
  service/generation and buyer/block state are transactional. Creation persists
  private record/receipt/audit atomically; canonical buyer cancellation has scoped
  idempotency/revision/audit checks and existing HTTP composition. Verified participant
  private reads use fresh transactions and the existing DTO/state model. No new state
  machine, endpoint or real enquiry activation.
- Actual SDK Product/Store integration preparation: opaque IDs, one Store per owner,
  verified actor ownership/publication capability, private draft/public projection,
  atomic revisions/generation/audit/receipt, published Store/seller linkage, bounded
  public pagination/cursor scope and independent fresh detail checks. Private draft
  edits preserve last published text. No legacy collection/browser reads or migration.
  Raw old data URL/Cloudinary galleries stay private and unchanged; new public DTOs
  never emit them, owner identity, contact/GPS/IP or caller privilege flags.
- Durable private media association/reference/receipt/audit transactions read current
  parent and photo revisions, owner eligibility/suspension and Provider service scope.
  Atomic replacement updates references, denies deleting/foreign/stale assets and
  preserves legacy gallery fields and Provider v1 schema. No provider call. This is
  not yet the full durable upload/quota/delete worker or approved public-media release.
- Essential actual index.html Search and Login labels/placeholders/submit/toggle controls
  now bind to existing lazy gu/hi/en catalogs, explicit accessible selector and safe
  local preference. Stale catalog/storage-denied recovery preserves credentials,
  search values, authored text and focus. Browser fixtures extract actual markup but
  do not load Firebase or prove entire legacy CSS/device acceptance.
- Verified Login/Signup blocker fixed: raw password bytes are no longer trimmed.
  Registered-account/incorrect-password errors use one credential failure message.
  Tests execute actual legacy handlers with injected Auth and preserve spaces.
  Source-marker regression prevents locale binding from relabeling listing submit.

[SDK/private/photo contract and remaining work](durable-marketplace-integration-contract.md)
records exact isolation, ownership/freshness, cursor, legacy compatibility, privacy
and activation limits. [Launch register](launch-decision-register-2026-11-07.md) keeps
all Product/Store/Service/photos/Chat/Admin/locale/mobile P0 requirements and conditional
Nov 7 target; no text-only preview is counted as complete launch.

## Validation

Focused SDK mock acceptance passed for enquiries, Product/Store, photo references
and disabled/live-host rejection. New actual SDK Emulator cases reuse those scenarios
and add an enquiry/Provider withdrawal conflict before commit. Local actual Emulator
runs are not claimed; exact-source CI evidence is recorded after completion below.
One full sweep passed all 34 non-emulator commands. Focused 4-case SDK recheck passed
after the actual-Emulator-only race fixture addition. Exact command counts follow.

| Command | Passed |
| --- | ---: |
| `npm run test:emulator:safety` | 81 |
| `npm run test:profile-migration` | 11 |
| `npm run test:admin-backend` | 115 |
| `npm run test:firebase-config` | 6 |
| `npm run test:product-migration` | 11 |
| `npm run test:product-category` | 8 |
| `npm run test:product-image-classifier` | 9 |
| `npm run test:image-upload-contract` | 8 |
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
| `npm run test:service-providers` | 191 |
| `npm run test:emulator:guard` | 10 |
| `npm run test:service-preview` | 13 |
| `npm run test:service-preview:browser` | 26 |
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
| `npm run test:provider-draft:transaction` | 67 |

No test was skipped/weakened or dependency installed. `git diff --check` passed.
Existing actual Emulator suites run only in authorized GitHub CI. SDK test namespaces
remain deny-all to direct guest clients under unchanged candidate Rules. Actual SDK
success is not live Auth/IAM/rate/quota/provider/account acceptance.

Next highest-impact repository batch: durable upload budget/attempt/delete/outcome
journal and trusted public-image projection/delivery contracts, then remaining
Product/Store/Chat/Admin/settings/error locale and UI port bindings. Minimum owner
decisions remain concrete runtime/identity/commercial zero-cost eligibility, actual
schema/index binding, roles/quotas/block policy, privacy/retention and media processing/
provider/visibility; separately approve staging Rules/resources/IAM/secrets/transport/
rollback/deployment. No operational approval inferred from code/CI. No live Firebase/
Cloudinary, Rules/index deployment, IAM/secrets, billing, Vercel changes, staging/live
deployment, migration, main/merge or Full Reset. HOLD/NO-GO and deny-all remain.
