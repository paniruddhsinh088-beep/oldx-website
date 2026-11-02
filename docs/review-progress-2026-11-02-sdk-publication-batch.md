# SDK integration preparation and publication safety — 2 November 2026

Reviewed AGENTS.md, clean/fresh remote `4ac9c4d`, recent history, feature matrix,
transaction contract, owner decisions and latest checkpoint. Existing work and
canonical automation preserved. Owner limited approval recorded: repository-only
Firebase/Vercel architecture code plus isolated tests, zero spend. No real schema,
region, IAM/secrets/live access/Rules/deployment/billing/release approval assumed.

## Completed code

- Emulator-locked default-disabled actual modular Firebase transaction repository
  maps existing private draft and publication ports to SDK reads/writes. Explicit
  test-only collection namespaces, demo project/loopback guard, all reads before
  writes, atomic identity/draft/receipt/audit, server timestamps, bounded retries,
  cancellation/deadline preconditions. No app/credentials initialization or new SDK.
- Inactive atomic publication materialization: separate current permission plus
  ownership/identity, stored draft validation, strict public DTO/catalog relations,
  revision/generation conflicts, idempotency/audit, public-view withdrawal and
  atomic generation update. Private draft save remains separate from publication.
- Existing Service Emulator suite gains an actual SDK transaction integration test
  in a privileged isolated test context. No Rules file/config/baseline changed;
  ordinary guest access to candidate namespaces is still denied.

Full [SDK/publication contract](provider-sdk-publication-contract.md) records what
is implemented and what is not, including the snapshot/per-row generation bridge
still needed for actual multi-provider public reads. Do not call mock projection
or isolated privileged persistence proof production functionality.

## Minimum working Service slice later

Keep existing Login/Product/Store/Chat source intact. After named approvals: select
actual server SDK/runtime identity and private/public schema; implement consistent
public read bridge/canonical source and explicit owner eligibility/moderation policy;
compose verified-token HTTP handlers with request/rate limits and bounded ports;
run isolated real adapter/Rules cross-account/public-privacy/withdrawal/replay tests;
then seek separate staging data/resource/Rules/deployment acceptance. No new demo
page or speculative scaling infrastructure. Text-only keeps uploads/reviews/SMS out.

Next safe repository task: a disabled, transport-independent HTTP composition for
Provider draft/publication commands with strict JSON/request limits, shared verified
identity and unknown-outcome retry responses, using existing Admin HTTP patterns.
Do not expose endpoints or bypass the public-read consistency gate.

## Tests

Focused transaction/SDK/publication/helper command passed 20 tests. The initial
negative disabled-repository test used async rejection for a synchronous guard;
corrected the assertion to verify the guard throws before SDK calls. No security
assertions weakened. Combined regression and exact-source CI follow. Local emulator
binaries remain network-policy blocked; no local actual Emulator claim.

All 34 local non-emulator npm commands passed in one combined sweep; transaction/
SDK/publication/helper suite passed 20. `git diff --check` passed. Actual SDK
Emulator execution is pending exact-source CI, not claimed locally.

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
| `npm run test:service-providers` | 183 |
| `npm run test:emulator:guard` | 10 |
| `npm run test:service-preview` | 13 |
| `npm run test:service-preview:browser` | 20 |
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
| `npm run test:provider-draft:transaction` | 20 |

## Verified exact-source checkpoint

Executable source `d2569047b1786abd86f03daf03d2bf8db8819ad0` passed all workflows:
- [Service Providers Emulator 41456805748](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41456805748)
- [Branch security 41456805347](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41456805347)
- [Review safety 41456805345](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41456805345)

Service Emulator success covers the actual SDK integration test added to its 21-case
runtime suite: concurrent private draft creation/idempotent replay, timestamped
private persistence, public materialization/replay, withdrawal, generation and
atomic audit, followed by ordinary-client denial under unchanged Rules. It runs
only in a demo emulator with Rules-disabled test context for privileged SDK calls;
not a test of real IAM, deployed access policy or approved production schema.
Local sweep: all 34 commands passed, including 20 transaction/SDK/helper cases,
Service models 183, Admin 115 and all previous Store/Service/mobile regressions.

Fresh remote remained `4ac9c4d` before source commit and normal push. Prior history
and canonical automation preserved; no concurrent merge or force push. Branch
deployment flag stayed false, and read-only Vercel metadata found no deployment
for source SHA. No live Firebase/Rules/resource/secret/billing/main/merge/deploy/
Full Reset action occurred. This final documentation-only commit changes no
verified executable source; live approval and HOLD/NO-GO gates remain unchanged.
