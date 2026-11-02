# Owner HTTP/UI recovery and photo audit — 2 November 2026

Started from clean `967dd8de9c40da51dd0e87c5562869223cd6d346`, source
`b0e609069867de63f9c9b647989b68e111aef670`; fetched remote before editing and read
AGENTS, roadmap, approved design/v1/bootstrap, HTTP/UI/security/release records.
Prior opaque owner allocation, all feature checkpoints and automation are preserved.

## Completed source

Disabled `owner.bootstrap` transport-independent HTTP operation reuses verified Auth,
current role/quota enforcement and read-only v1 bootstrap. Bounded request has no
caller ownership/role fields. Strict private DTO returned no-store, no credential/
UID/audit leakage. New shared validator separates editable fields from public DTOs.

Existing Service form supports explicit injected load/reconcile, private-only restore,
multiservice/language preservation and localized accessible feedback. Historical
receipt cannot regress current counters or imply current public visibility. Missing
receipt keeps unknown command/original key/body and prevents replacement mutations.
Session/page/scope/offline cancellation rejects late private callbacks. No page,
endpoint, real SDK/auth connection, persistence or publication activation is added.

[Complete photo audit and proposed architecture](photo-storage-audit-and-inactive-adapter-2026-11-02.md)
records each actual legacy upload/edit/display/removal path, official Cloudinary Free
pricing/security/terms evidence and approval gaps. Store uses unsigned Cloudinary;
Product/custom avatar/Chat use Firestore data URLs; OAuth/legacy external URLs remain;
Service photos are absent/text-only. Existing images/code paths are unchanged.

New test-only injected server media lifecycle covers verified parent ownership,
bounded bytes, trusted decode/reencode/metadata/scan attestations, quota journal,
quarantine, same-key content binding, ambiguous uploads and managed unreferenced
delete leases. It contains no Cloudinary client, credentials, decoder/scanner,
persistent journal, public delivery or network implementation. Services are excluded.
Actual provider integration, retention/CDN privacy, budget controls and all migration/
account actions remain unapproved. No new dependency or paid service.

## Verification and gates

Focused HTTP/UI/model/media tests pass; browser fixture assertions were corrected to
check both restored services and await asynchronous locale completion. No security
assertion removed. Actual SDK Emulator scenario extends existing v1 case through
owner-private HTTP restoration/current vs historic receipt and withdrawn state.
Local Emulator binary download remains blocked; use exact-source GitHub CI rather
than claiming local actual Rules validation. Comprehensive outcomes and exact-source
commit/CI evidence are recorded below after completion.

Next safe batch: reusable in-memory media journal with atomic reference/delete leases
and unknown-outcome reconciliation; no actual upload or migration. Shortest launch
path remains owner selection of concrete runtime/identity/schema/eligibility/quota/
retention, then separately authorized staging acceptance for text-only owner draft ->
explicit publication -> bounded public profile. No live Firebase/Cloudinary API,
Rules/index deployment, IAM/secrets/account changes, billing, Vercel/deployment,
main/merge, media migration or Full Reset. HOLD/NO-GO and deny-all remain.

Review also reproduced a surface-policy lookup bug: prototype names such as
`__proto__` could resolve inherited properties instead of being rejected. The shared
policy now requires an own allowlisted string property; focused 8-case upload-contract
suite and new lifecycle invalid-surface regression pass. The sweep had already run
the earlier 7-case contract suite before this small fix; that affected suite was
rerun explicitly rather than repeating unchanged browser suites.

## Local regression evidence

All 34 non-emulator test commands passed in one combined sweep. Focused final
media integration and affected shared image-policy rechecks also passed; no unchanged
expensive suite was repeated after the sweep. Exact latest command counts:

| Command | Passed |
| --- | ---: |
| `npm run test:emulator:safety` | 78 |
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
| `npm run test:service-preview:browser` | 24 |
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
| `npm run test:provider-draft:transaction` | 48 |

The final integration command has 48 cases; Service models 191, Service browser 24,
Admin 115 and Store browser 28. Local actual Emulator suites were not run (documented
network-policy blocker); exact-source GitHub results are pending. `git diff --check`
passes. Deployment remains explicitly disabled for the authorized branch.
