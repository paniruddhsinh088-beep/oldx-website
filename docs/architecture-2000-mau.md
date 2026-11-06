# OLDX stable architecture and 2,000 MAU checkpoint — 6 November 2026

Decision: keep the approved website/design and a shared web/Capacitor client, with
one modular trusted Node backend and existing Firestore/media ports. No microservice,
new database, frontend framework or paid dependency. Cost acceptance is separate from
security/feature acceptance; neither currently authorizes launch. Starting HEAD:
3d85bd24c395381c87e1cf0bbbbde686bfeb8edb. This file is the resume checkpoint.

## Stable boundaries (existing code reused; target is not a live-service claim)

| Domain | Stable responsibility |
| --- | --- |
| Products / Stores | Existing private drafts, versioned public projections, ownership indexes, generation-bound cursor pages and idempotent commands with atomic audit. Preserve edit/delete/withdraw, saved items, photos, catalogue, categories, map/sharing and approved galleries. |
| Service Providers | Existing multi-service profile/catalogue, scoped portfolio/media, private enquiries and conversations. Buyer-only review authorization must use trusted completed interaction evidence, never a browser role or rating. |
| Chat | Verified participants/publication/blocks; immutable sequenced messages, server counters, bounded history, signed delivery receipts, monotonic read state and atomic receipts/audits. Never derive a total badge from one limited page. Product and Provider adapters retain their domain authorization. |
| Admin | Existing secure API, current active-role resolution, bounded projections and atomic mutation/audit. No legacy direct Firestore fallback. |
| Media | Existing quarantine, verified processing, independent moderation and version-bound delivery contracts. Original/detail/thumbnail derivatives must be approved together; preserve quality and revoke on scope/logout. No unsigned private URLs or automatic provider activation. |
| Authentication | Existing Firebase Auth; verified/revocation-checked server identity. UI session IDs only cancel work. Roles, owner/participant identities, counts and moderation come from trusted server records. |
| Notifications | FCM-compatible notification adapter; plan an idempotent transactional outbox tied to committed events. Delivery retry must not alter unread truth. Store device tokens privately; avoid private message text in background payloads by default. This outbox/production delivery remains to be implemented. |

Keep DTO/schema versions, command request IDs and expected revisions stable. Hosting
adapters own HTTP/CORS/credentials; domain code has no platform SDK initialization.
Same backend contracts serve browser and future Capacitor; Admin keys never ship to
web/Android. Preserve existing Gujarati/Hindi/English and original responsive markup.
Existing transaction-only read reuse and visibility-deferred approved galleries remain.
No cross-request authorization cache: public cache keys must bind publication generation
and be invalidated by trusted changes; private data is session-scoped and cleared on exit.

## Implemented this batch: isolated trusted Product Chat read state

Default-off `readStateEnabled` in the EXISTING Product conversation repository. New
messages atomically update received counters and cumulative per-message prefixes in
the same existing thread/message/receipt/audit transaction (no extra send record).
Summary and bounded inbox-summary ports recheck the existing authority graph; they do
not scan message history. Reuse existing summary validator, cursor codec and monotonic
cursor policy. Summary validation now rejects foreign senders and unsafe integers.
Read acknowledgments accept ONLY server-issued, actor/thread/product-bound receipt
proofs. Counts/identities are not accepted from the browser. Acknowledging a visible
page cannot jump over unseen incoming messages (READ_GAP); gaps containing only own/
already-counted messages are safe. Concurrent/stale/lost acknowledgments are monotonic
and idempotent; each actual advance atomically writes thread state + receipt + audit.
Missing/corrupt legacy state fails closed, never guesses zero. Mode downgrade cannot
append messages without maintaining already-present counters. Existing default-mode
HTTP/UI shapes and authorization remain intact; NO new HTTP route, runtime gate,
Rules, SDK initialization or environment was enabled.

IMPORTANT: this is a functional isolated server core, not live Chat completion. Legacy
reconciliation, Provider adapter integration, sparse visible-read behavior across gaps,
Delete for Me/Everyone preview/counter semantics, global unread totals and UI transport
binding remain release gates. Existing legacy behavior was not switched or removed.
Current prepared conversation revision limits also need review before large-history
acceptance; do not truncate old messages or silently reset a conversation.

## Measured evidence versus estimates

The shared workload case runs 103 real repository messages, alternating direction at
the end, page delivery, concurrent/lost ack, block/foreign/guest denial, invalid proofs,
read gaps, corrupted legacy state and default-off compatibility. It runs with an SDK
double AND actual isolated Firestore transactions. Identity is injected by a test
server boundary; this does NOT establish a signed-token/live staging end-to-end flow.

Measured: summary costs 8 point reads at both 1 and 101 messages, zero history reads
or writes. A 20-message read advance creates 3 committed records; duplicate ack creates
0 writes. Transaction retries can increase attempted operations; tests separately
verify the committed receipt/audit and bounded retry intents. Send retains its existing
four-record atomic transaction. Actual Emulator direct client reads/writes of trusted
threads/messages/receipts/audits are denied even with owner/admin-like claims.
This is not a billing measurement or a hosted 2,000-user throughput/load test.

Compare previous legacy four-room/100-incoming-message count: 412 read-equivalents
per refresh. Hypothetically four migrated Product summaries require 32 point reads
plus query rows for a paginated inbox (~36 total), independent of history length.
This is NOT a whole-site saving claim or a Provider/global aggregate implementation.
All 5k-MAU workload assumptions remain in capacity-5000-mau.md and are reused below.

## 2,000 MAU: 10% / 20% / 30% activity

Baseline estimates include 20% retry/abuse allowance: 1,440 reads, 90 writes per DAU
per day; 31 pre-overhead API calls/day; ten viewed 120-KB images/day; 0.1 upload/day.
The earlier model includes backend/audit/rate costs, not just client SDK operations.
No favorable seller mix or unseen-album rate is assumed. New counters are not enabled,
so the baseline does not pretend to have already removed legacy history scans.

| DAU | Reads/day | Writes/day | Calls/month | Image GB/month | DB egress GiB/month |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 200 | 288,000 | 18,000 | 223,200 | 8.64 | 8.24 |
| 400 | 576,000 | 36,000 | 446,400 | 17.28 | 16.48 |
| 600 | 864,000 | 54,000 | 669,600 | 25.92 | 24.72 |

A fully adopted summary path might reduce the read component to roughly
(1,200-824+72)*1.2=537.6 reads/DAU/day: 107,520 / 215,040 / 322,560 reads/day.
This counterfactual is NOT achieved end-to-end and still exceeds the 35k read budget.
Acknowledgment/audit and rate writes still need budgeting; do not subtract them away.

Peak scenario: 20% of daily requests in one hour and a further 5x short burst yields
~2.1 / 4.1 / 6.2 backend requests/sec. The shared global rate bucket is a contention
hotspot. These are modeled arrival rates, not demonstrated host capacity. Free-host
CPU/RAM, cold/warm p50/p95/p99, failure/retry behavior and moderation throughput must
be tested in an approved staging host before any reliability/performance claim.

Storage illustration after one month: ~201 / 330 / 459 MB, based on 50 MB starting
metadata, two messages/DAU/day, four 1-KiB records/message, 2x index allowance, ten
actor rate buckets/DAU/day and 1,440 global buckets/day at 0.5 KiB. Retention continues
to grow; expiresAtMs alone does not delete counters, and no destructive cleanup was
added. Media new originals+derivatives: 0.144 / 0.288 / 0.432 GB/month. Shared Cloudinary
usage with one transformation/upload: ~9.384 / 18.768 / 28.152 credits/month, before
existing retained assets. Media proxy + API response Render egress lower bound is
~9.10 / 18.19 / 27.29 GB/month; DB/provider outbound requests add more.

## Verified limits and commercial/reliability decision

- Spark free 50k reads/day, 20k writes/day, 1 GiB storage, 10 GiB/month egress; 70%
  budgets 35k /14k /0.7 GiB /7 GiB. All baseline scenarios fail reads/writes/egress.
  https://firebase.google.com/docs/firestore/quotas
- Render Free: 750 pooled hours/month (70%=525); 5 GB egress (70%=3.5 GB); 500 build
  minutes (70%=350). Idle sleep/cold starts and suspension cannot satisfy an unchanged
  production reliability promise. Always-on 30-day service is 720 hours, above 70%.
  https://render.com/docs/free ; https://render.com/docs/outbound-bandwidth ; https://render.com/docs/build-pipeline
- Cloudinary Free: 25 shared credits (70%=17.5), production permitted within limits.
  At 400 DAU the modeled media budget already exceeds 70%; 600 DAU exceeds 25 credits.
  https://cloudinary.com/pricing ; https://cloudinary.com/documentation/billing_and_plans ; https://cloudinary.com/documentation/developer_onboarding_faq_free_plan
- Vercel Hobby is not eligible for commercial OLDX. Workers Free is a research candidate
  (100k req/day, 10 ms CPU/request) but current native Firebase Admin/Firestore/sharp
  compatibility and workload QoS are not demonstrated. No forced rewrite is recommended.
  https://vercel.com/docs/plans/hobby ; https://developers.cloudflare.com/workers/platform/limits/
- Spark does not supply the required Cloud Functions/Storage production runtime;
  SMS, managed backup/PITR/TTL and paid scan add-ons cannot be promised at zero spend.
  https://firebase.google.com/pricing

Conclusion: 2,000 MAU /400 DAU/all features/unchanged quality/70% headroom at permanent
zero additional cost is NOT demonstrated and fails this realistic modeled workload.
No free commercially suitable production stack has been proven to meet these combined
requirements. Security/normal feature development continues; this is a separate cost gate.
Smallest evaluated compatible paid Node entry tier is Render 512 MB at $7/month
(~Rs630 using an illustrative Rs90/USD, plus usage/taxes). This is NOT a validated
full-site cost or a load-certified memory size. Vercel Pro is $20/month before usage.
Firestore/media capacity may require additional paid allowance; no upgrade is approved
or performed. https://render.com/articles/render-vs-netlify ; https://vercel.com/docs/plans/pro-plan

## Deployment / migration path without a website rebuild

1. Keep existing canonical schemas and versioned command/read DTOs. Use a deployable
   Node host adapter around current libraries, separate staging/production config and
   identities, a stable API origin, explicit web/Capacitor CORS and no browser secrets.
   Native staging/production project checks must remain explicit, never an implicit
   fallback or a client-supplied target. Upgrading Node capacity does not change UI APIs.
2. Preserve full Rules snapshot/release and verified inventory including orphan child
   collections. Independently verify rollback, credentials/permissions and cost eligibility.
   Confirm canonical namespace compatibility before any write. Staging gates remain blocked.
3. Enable only approved private save/owner paths first; keep publication/media/Chat/Admin
   gates closed until each acceptance journey passes. Paid Firestore quota expansion in
   the SAME database should not require a data-model or client rewrite, but needs separate
   owner billing approval. Other database engines remain behind repository adapters;
   migration is still real, verified work, not a promise of a free drop-in replacement.
4. For Chat v1 counters, offline reconcile complete history/visibility and trusted actor/
   block/participant state; preserve originals, audit hashes/counts and migration receipts.
   Shadow-compare summaries against complete history, then cut over by server configuration
   only after deletion/read-gap compatibility, drift/rollback tests and acceptance. Do not
   dual-write asynchronously or allow downgrade writers to corrupt counters. No migration
   runs in this batch. Production still waits for successful staging acceptance.
5. Notifications use a later bounded retrying outbox worker, not untrusted browser events.
   Retention/archive policy must preserve history, audit integrity and privacy obligations;
   do not delete data merely to fit a free quota. Monitor quota/latency/contention before
   70%, with truthful retry/unknown states, never optimistic success or weaker authorization.

Scale design: same APIs/repositories for 2k/5k/10k+ MAU; first buy capacity only if later
approved, then scale stateless Node instances and measured DB/index/worker capacity.
At 20% DAU the old workload model is 1.44M reads/90k writes/day for 5k MAU and
2.88M/180k for 10k. More instances do not fix per-request DB costs or global hot keys.

## Focused verification / next three development tasks

Final focused results: **53 passed, 0 failed, 0 skipped**; no full-suite reruns.
- 46 Node tests: product-read-state, product-conversation, product-ui, service-conversation,
  inbox-summary-policy, chat-read-receipt-policy, provider-discovery-cursor and emulator-test-plan.
- 2 actual Firestore Emulator cases: product-read-state-runtime, using the existing
  validated loopback baseline plan, unique test collections and synthetic data. The
  103-message workload completed in about 9 seconds locally; this is not hosted QoS.
- 5 static-build tests: server code and test signing material stay outside browser assets.
Exact Node command: `node --test tests/integration/product-read-state.test.mjs tests/integration/product-conversation.test.mjs tests/integration/product-ui.test.mjs tests/integration/service-conversation.test.mjs tests/firestore-emulator/inbox-summary-policy.test.mjs tests/firestore-emulator/chat-read-receipt-policy.test.mjs tests/firestore-emulator/provider-discovery-cursor.test.mjs scripts/emulator-test-plan.test.mjs`.
Exact narrowed Emulator child command: `node --test tests/firestore-emulator/product-read-state-runtime.test.mjs`.
Packaging: `node --test scripts/build-static-assets.test.mjs`. Ignored local evidence:
`.firebase/read-state-focused.log`, `read-state-native-final.log`, `read-state-static.log`.
No browser suite rerun: no UI binding changed, and new routes are not exposed. UI,
Provider and deletion/visibility acceptance is deliberately still outstanding.
1. Integrate shared read-state semantics with Provider Chat and sparse/deleted/hidden
   legacy reconciliation; add full inbox total and existing mobile UI acceptance before
   exposing trusted summary/read-cursor routes.
2. Implement and test an audited distributed quota approach that reduces per-request
   Firestore counter writes without weakening global/actor limits; include notifications'
   atomic outbox/worker budget rather than treating delivery as free backend work.
3. Complete remaining Product/Store/Provider/Admin/media acceptance and authorized staging
   workload/peak/retention tests, including buyer-only reviews, galleries, moderation and
   Capacitor device behavior. Keep original approved design and all feature gates distinct.

## 6 November follow-up — Provider trusted read-state acceptance

Starting commit: `6285e7b560246946bdbfbb52a21c4041b672628c`.
Provider conversations now share Product's server-only read-state validation. Explicitly
opt-in repository/HTTP ports provide authorized summaries and signed contiguous delivery
acknowledgments. Fresh participant/publication/block checks run on every operation;
actor-bound cursors cannot clear unseen incoming gaps. Read advances atomically update
thread, idempotency receipt and audit. Concurrent devices, rollback, lost responses,
retries, forged cursors and legacy/downgrade writers are tested. No route/host/UI gate
was activated, no live resource changed, and existing three-language messaging remains.

Measured locally: Provider summary uses 12 point reads at both 1 and 61 messages, zero
history queries/writes. A committed read advance uses 3 records; duplicate acknowledgment
writes 0. Message send still uses its existing 4 records, including atomic audit.
The prior 8-read Product result does not apply to Provider's additional authority checks.
A hypothetical mixed four-room inbox (2 Product, 2 Provider, plus 4 listing reads) costs
44 reads/refresh, 88 for two refreshes versus the old model's 824. Substituting only that
term gives `(1200 - 824 + 88) * 1.2 = 556.8` reads/DAU: 111,360 / 222,720 /
334,080 reads/day at 200 / 400 / 600 DAU. This is a counterfactual future integration,
NOT achieved website usage or a proven free-tier capacity. The existing write, image,
storage, abuse and quota budgets remain; 2,000 MAU at zero cost is still unproven.

Exact focused verification: **40 passed, 0 failed, 0 skipped**.
- 28 Node: `node --test tests/integration/provider-read-state.test.mjs tests/integration/product-read-state.test.mjs tests/integration/service-conversation.test.mjs tests/integration/service-conversation-client.test.mjs tests/firestore-emulator/provider-discovery-cursor.test.mjs scripts/emulator-test-plan.test.mjs`.
- 4 actual loopback Firestore Emulator: guarded baseline runner narrowed to
  `node --test tests/firestore-emulator/product-read-state-runtime.test.mjs tests/firestore-emulator/provider-read-state-runtime.test.mjs`.
  SDK transactions use synthetic data; server token verifier is an injected test port,
  so this is not hosted identity/credential acceptance. Deny-all client reads/forgeries fail.
- 3 Chrome browser locale cases and 5 packaging cases:
  `node --test tests/browser/service-messaging-integration.test.mjs scripts/build-static-assets.test.mjs`.
Local ignored logs: `.firebase/provider-read-focused.log`, `provider-read-native.log`,
`provider-read-browser.log`. No full-suite rerun, new dependency or UI design change.

Resume / next work: connect bounded unified inbox/read-cursor UI with exact totals and
unread-first ordering only after sparse/deleted/hidden history reconciliation and
multi-device compatibility pass. Product/Store private saves/publication, Provider
buyer-only reviews/galleries, real Media processing/moderation, Admin runtime roles and
atomic operations still need hosted acceptance. Notifications still need the trusted
retrying outbox/delivery integration. Existing scoped staging Rules snapshot, complete
inventory, rollback, runtime permissions and zero-cost host eligibility remain unverified;
do not repeat unavailable access investigation or activate routes by inference.
Next priorities: (1) unified inbox/deletion parity acceptance, (2) bounded audited quota
and notification outbox budget, (3) remaining feature and staging/device workload acceptance.
Launch remains HOLD/NO-GO; retain all disabled gates pending those checks.

## 6 November — unified Inbox, quota and notification batch

Start: 2866e19239a9185b28afe3cf810c5f6b5ed2dd69; default-off gates unchanged.
- Existing Product/Provider conversation UI now consumes signed delivered-page read
  receipts, acknowledges only visible rendered history, retries the same proof after
  unknown outcomes, and clears proof/retry state on scope/logout. No browser counts.
- Optional existing-host unified Inbox owns the current list/next/badge nodes and
  shared Auth lifecycle. Strict maximum-20 pages, unread-first/newest/stable ordering,
  exact server total, snapshot-bound pagination, stale-session suppression, single
  flight, offline/focus recovery and read-ack refresh events are implemented. Unknown
  totals display '?' rather than zero. Localized existing status strings and text-only
  user content preserve mobile layouts. Trusted mounting stops legacy scans/listeners
  and prevents Product rerenders/legacy badge callbacks overwriting its state.
- IMPORTANT unfinished backend gate: loadPage still needs a trusted cross-kind index
  with exact authorized global totals, signed snapshot/cursor validation and atomic
  updates. Existing Product id-order pages/Provider partial lists cannot safely
  supply unread-first global pagination. Browser tests use synthetic snapshot pages;
  do NOT interpret those pages as a deployed/complete index. Hidden/deleted/sparse
  legacy reconciliation, typing/deletion parity, real-time multi-device refresh and
  staged migration remain acceptance gates; no legacy feature was removed or bypassed.
- Atomic rate core reads the actor before the global counter: exhausted/malformed
  actor rejection 2 -> 1 document reads, still 0 writes; accepted requests remain
  2 reads + 2 atomic writes. Global exhaustion remains 2 reads/0 writes. No leasing,
  in-memory allowance, audit removal or changed quota/window semantics. Allowed-path
  sequential-read latency and transaction retry overhead still require hosted testing.
- Isolated notification queue is optionally staged in SAME Product/Provider message
  transaction: 4 -> 5 committed records, +1 existence read. Existing send audit binds
  the event; replay creates no second event. Only participant/thread/sequence metadata
  is stored, no text/contact/token. Worker-role/privacy ports must authorize freshly
  within each transaction; missing policy fails closed. Fenced leases, bounded attempts,
  audited retry/suppression/settlement, orphan detection and database/namespace guards
  are implemented. There is NO worker transport, actual push or notification activation.
  Stable provider idempotency keys plus delivery-time privacy checks are mandatory
  before real dispatch; leases alone do not guarantee exactly-once external delivery.

Cost model update (assumptions, NOT demonstrated hosted capacity): each successful
queued notification adds 1 queue write plus 2 claim and 2 settlement writes, and at
least 1 + 4 + 4 reads in the test worker policy; real block/visibility/auth checks and
retries add more. Assuming 5 notifications/DAU/day adds 25 writes and at least 45 reads
per DAU. Prior 90-write baseline would become at least 115 writes/DAU: 23k/46k/69k
writes/day at 200/400/600 DAU if enabled, before extra retries. No claim of aggregate
quota reduction or proven 2,000-MAU zero-cost operation. Images/storage assumptions
remain unchanged; no pricing, live telemetry or hosted QoS was reverified this batch.

Focused final evidence: 80 Node/static checks (75 Node + 5 packaging), 24 Chrome
checks, 5 distinct actual loopback Firestore Emulator cases; zero final failures/skips.
During development tests exposed a missing enqueue invocation, focus rerender click
race and raw-result/HTTP-result retry discrimination; all fixed with regressions.
Node/static command: node --test tests/integration/unified-inbox.test.mjs tests/integration/chat-outbox-rate.test.mjs tests/integration/product-ui.test.mjs tests/integration/service-conversation-client.test.mjs tests/integration/staging-marketplace-runtime.test.mjs tests/integration/provider-journey.test.mjs tests/integration/store-ui.test.mjs tests/integration/product-conversation.test.mjs tests/integration/service-conversation.test.mjs tests/integration/provider-enforcement.test.mjs scripts/emulator-test-plan.test.mjs tests/integration/marketplace-session.test.mjs tests/integration/staging-marketplace-packaging.test.mjs tests/firestore-emulator/legacy-performance.test.mjs scripts/build-static-assets.test.mjs.
Browser: node --test tests/browser/unified-inbox.test.mjs tests/browser/service-messaging-integration.test.mjs tests/browser/product-integration.test.mjs tests/browser/legacy-performance.test.mjs.
Guarded baseline Emulator child: node --test tests/firestore-emulator/product-read-state-runtime.test.mjs tests/firestore-emulator/provider-read-state-runtime.test.mjs tests/firestore-emulator/chat-outbox-rate-runtime.test.mjs. Only the last file was rerun after canonical event hashing/fresh worker-policy assertions. Synthetic identity ports are not live JWT/runtime acceptance.
Ignored evidence: .firebase/unified-verified-node.log, unified-verified-browser.log, unified-native.log, unified-outbox-final.log.

Resume priorities: (1) trusted cross-kind index + deletion/visibility reconciliation
and exact-total acceptance; (2) concrete worker/privacy/provider-idempotency transport
and bounded queue discovery/retention with delivery STILL off; (3) remaining Product,
Store, Provider reviews/media, Admin and staging/device/capacity acceptance. Staging
Rules/inventory/rollback/runtime gates remain unverified; do not repeat unavailable
access investigation. No live Firebase, Rules, IAM, credentials, billing, deployments
or production operations. Launch HOLD/NO-GO.

## 6 November — trusted index and recording-worker checkpoint

Start: 3d3d16e864c9c07d98bf3a292d2c3d9e427dd0ad. New paths remain OFF.
Trusted cross-kind index now stores actor-scoped rows plus an exact aggregate head.
Product/Provider send and read acknowledgments optionally stage index writes in the
SAME message/audit transaction; downgrade and unreconciled indexed-thread readers
fail closed. Signed actor/generation cursors, maximum-20 pages (+1 lookahead),
single-field actor-prefixed ordering and a head-generation fence avoid repeated
row reads/history scans. Existing verified-token/revocation/quota HTTP wrapper
exposes only the page port, with no live route or maintenance endpoint created.

Nonempty inventory stays unavailable until every row has reconciled against a
verified inventory epoch/count. Pure complete-history reconciliation handles read
cursors/readBy, deleted-for-everyone, per-user hidden messages and either block
direction. Source-epoch invalidation prevents off-page stale totals; every row must
be revisited before finalization. Raw legacy Chat history/write continuation is
intentionally BLOCKED until its sparse-message/read-prefix compatibility is accepted,
not silently re-enabled from a repaired Inbox row. No migration ran against real data.

Disabled worker now has fresh transactional worker-role/participant/recipient/block/
visibility checks, fenced leases, stable idempotency keys, bounded 20-item discovery,
retry recovery and held exhausted attempts. Only a branded recording transport is
accepted: actual notification delivery is structurally unavailable. Terminal payload
retirement replaces participant metadata with an idempotency tombstone and audit;
no document is deleted. Cleanup defaults to dry-run and excludes pending/held/unknown
events. Audit/tombstone growth remains a storage/retention cost, not a bounded total
record-count claim. Durable real-provider deduplication and dispatch-time privacy
acceptance remain required; in-memory recording deduplication is not production proof.

Measured with synthetic facts on real Firestore Emulator: 41 mixed Inbox rows across
3 pages consume 43 query documents + 52 point reads (95 total), 0 writes/history
scans, including fresh fixture authorization. The fixture policy is not a substitute
for a complete production authorization adapter. Indexed read acknowledgement has
3 -> 5 domain writes; message send with queue has 5 -> 9 (two rows/two heads added).
Standalone indexed summaries add 2 head/row checks: Product 8 -> 10, Provider 12 -> 14
point reads, independent of history length. Duplicate acknowledgments still write 0.
A lost recording-delivery acknowledgment + retry measured 40 point reads, 2 query
documents, 6 attempted domain writes and exactly 1 recording delivery. These counts
exclude HTTP quota writes, external token verification and additional transaction
retries. Terminal retirement adds 2 writes/event; fresh privacy reads cannot safely
be cached across claim/dispatch/settlement. No aggregate savings/hosted QoS claimed.

Capacity assumption update only: retaining the prior 90 writes/DAU baseline, assuming
5 queued notifications/DAU including successful claim/settlement/retirement adds 35
writes; index send stages add 20, three read acknowledgments add 6 => 151 writes/DAU
before potential batching savings, extra retries or real-adapter costs. At 200/400/600
DAU this is 30.2k/60.4k/90.6k writes/day. This is NOT measured user traffic or a proven
2,000-MAU zero-cost workload. Bulk Inbox APIs may reduce quota calls versus per-room
requests, but that saving must be measured on the same real journeys before crediting it.

Verification: 75 focused Node/security + 5 static packaging, 19 Chrome browser and
7 distinct actual Firestore Emulator cases passed, no final failures/skips. A Product
retry assertion initially counted only three records; now it counts all five while
retaining the same three-attempt bound, audit and duplicate-write assertions.
Node/static: node --test tests/integration/inbox-worker.test.mjs tests/integration/product-read-state.test.mjs tests/integration/provider-read-state.test.mjs tests/integration/chat-outbox-rate.test.mjs tests/integration/product-conversation.test.mjs tests/integration/service-conversation.test.mjs tests/integration/provider-journey.test.mjs tests/integration/provider-enquiry-transaction.test.mjs tests/integration/product-ui.test.mjs tests/integration/store-ui.test.mjs tests/integration/unified-inbox.test.mjs tests/integration/provider-enforcement.test.mjs tests/integration/staging-marketplace-runtime.test.mjs tests/integration/staging-marketplace-packaging.test.mjs scripts/emulator-test-plan.test.mjs scripts/build-static-assets.test.mjs.
Browser: node --test tests/browser/unified-inbox.test.mjs tests/browser/service-messaging-integration.test.mjs tests/browser/product-integration.test.mjs.
Guarded baseline Emulator child: node --test tests/firestore-emulator/product-read-state-runtime.test.mjs tests/firestore-emulator/provider-read-state-runtime.test.mjs tests/firestore-emulator/inbox-worker-runtime.test.mjs.
Final local logs: .firebase/inbox-worker-focused.log, inbox-worker-last-node.log, inbox-worker-browser-final.log, inbox-worker-native-final.log. Tokens/worker identity ports remain injected test verifiers, not real deployed Auth acceptance.

Next: (1) bind verified canonical inventory/history/authorization adapters and atomic
hide/delete/block/source-epoch writers, complete legacy message/read/write parity;
(2) approved hosted worker/provider idempotency, queue retention/held recovery and
notification/device acceptance, keeping real delivery OFF; (3) remaining Product/Store/
Provider reviews/Media/Admin hosted acceptance and staging inventory/Rules/rollback/
permissions plus realistic cost/peak/device workload. No live access was retried.
No live Firebase, Rules, IAM, credentials, billing, production, deployment or main
changes. Launch HOLD/NO-GO. Checkpoint is sufficient to resume without repeating audits.

## 6 November — scoped worker batches and contiguous receipt recovery

Start 03c9f72c28f2f95b51a9339180ec88aa4a706a59; branch/remote were clean and equal.
Reviewed AGENTS, security/Store/Service roadmaps, launch register and prior evidence.
Fixed worker result sharing across overlapping credentials: concurrent run/cleanup now
returns generic BUSY, not another request's private results. Whole-batch deadline
(default 10s, bounded configuration), parent cancellation and strict cleanup intent
stop further work; existing leases/idempotency preserve recovery. Recording-only and
default-off remain unchanged. No real notification service/host was activated.
Chat now keeps up to 20 contiguous queued signed receipts, preserves the original
unknown-outcome retry, applies history paging backpressure and clears everything on
scope/logout/denial. A server-confirmed monotonic sequence suppresses re-signed old
pages ONLY in the same conversation/session: test API calls 3 -> 1, without editing
counts, weakening verification or caching authorization. Cross-room/session calls
still execute. Browser evidence: delayed receipt pages 20/40/60 processed in order,
server unread 61 -> 1. Fixed a browser wait race; exact count/order assertions remain.

57 distinct focused checks pass: 28 Node/integration + 5 packaging + 20 Chrome +
4 actual loopback Firestore Emulator, no final failures/skips. Commands:
- node --test tests/integration/worker-batch.test.mjs tests/integration/unified-inbox.test.mjs tests/integration/inbox-worker.test.mjs tests/integration/service-conversation-client.test.mjs tests/integration/product-ui.test.mjs tests/integration/store-ui.test.mjs scripts/build-static-assets.test.mjs
- node --test tests/browser/unified-inbox.test.mjs tests/browser/service-messaging-integration.test.mjs tests/browser/product-integration.test.mjs (only unified-inbox was rerun after correcting its async wait).
- Guarded baseline Emulator child: node --test tests/firestore-emulator/inbox-worker-runtime.test.mjs
Logs: .firebase/batch-recovery-focused.log, batch-recovery-browser.log,
batch-recovery-browser-final.log, batch-recovery-native.log. Synthetic server identity
ports/recording transport are not real Firebase Auth/provider/staging acceptance.

No new dependency, design, database schema/Rules or cloud changes. Remaining priorities:
canonical inventory/privacy adapters + all visibility/block/delete writers and legacy
Chat parity; approved worker/provider/device acceptance; Product/Store/Provider reviews,
Media/Admin and realistic staging/cost/Capacitor acceptance. These live/approval gates
were not retried or bypassed. Readiness remains pre-staging integration, HOLD/NO-GO;
no defensible launch percentage/date or proven 2,000-MAU zero-cost capacity yet.

## 6 November — canonical Product notification and visibility boundary

Start 8cc041f9c684d2fae99358f1b3730864c9cd107a; remote/branch clean and equal.
Product repository now supplies concrete transactional thread/message/block readers
for the existing notification privacy policy, reusing Product/Store eligibility and
participant authorization. Worker-role and recipient-preference readers are still
mandatory server ports. No invented live policy schema or provider transport.
Known private-message schemas reject malformed/unknown fields; hidden/deleted raw
text and stale latest-message previews fail closed instead of escaping via prepared
Chat reads. Missing legacy prefixes remain unavailable to notification delivery.
This does NOT complete legacy tombstone rendering, unread reconciliation or writers.
Fixed read-ack Inbox titles reverting from the Product name to a generic label.
Existing fact caching now serves the whole SDK transaction/attempt, preserving fresh
revocation/block/source checks across transactions and avoiding duplicate title reads.

Measured: canonical policy 11 point reads with thread read once; successful recording
worker 39 point reads + 1 query document, 4 domain writes, enqueue/quota excluded.
Summary visibility intentionally adds one latest-message point read: Product 8 -> 9
(or indexed 10 -> 11), independent of history length. Tests require that exact latest
document, not a history scan. No aggregate cost saving or zero-cost capacity claimed.

79 distinct checks pass, 0 final failures/skips: 53 Node/integration + 5 packaging,
17 Chrome and 4 actual loopback Firestore Emulator cases. Synthetic identities and
recording-only delivery are not staging/Auth/provider acceptance. Exact commands:
- node --test tests/integration/canonical-product-notification.test.mjs tests/integration/product-read-state.test.mjs tests/integration/product-conversation.test.mjs tests/integration/product-ui.test.mjs tests/integration/inbox-worker.test.mjs tests/integration/worker-batch.test.mjs tests/integration/unified-inbox.test.mjs tests/integration/store-ui.test.mjs tests/integration/service-conversation.test.mjs tests/integration/staging-marketplace-packaging.test.mjs scripts/emulator-test-plan.test.mjs scripts/build-static-assets.test.mjs
- node --test tests/browser/product-integration.test.mjs tests/browser/unified-inbox.test.mjs
- Guarded baseline Emulator child: node --test tests/firestore-emulator/canonical-product-notification-runtime.test.mjs tests/firestore-emulator/product-read-state-runtime.test.mjs
Only affected tests were repeated after title/cache corrections. Evidence logs:
.firebase/canonical-product-focused.log, canonical-product-final-node.log,
canonical-product-browser.log, canonical-product-browser-final.log, canonical-product-native-final.log.

Next safe task: equivalent Provider canonical-domain adapter, then authoritative
inventory/visibility/block/delete writers and legacy parity. Remaining gates include
real worker roles/preferences, durable provider/device acceptance, Store/Provider
reviews/Media/Admin/Maps acceptance, staging inventory/Rules/rollback and realistic
capacity. No live access/deployment/Rules/IAM/billing/secrets/main changes, no new
dependency or design change. All new runtime paths remain OFF; HOLD/NO-GO.

### 2026-11-06 — canonical Provider notification boundary (repository only)
Start: 142f29e31f30904d20379d5bc28b9514e95e85a1; fetched remote equal before commit.
Provider notification readers now reuse the canonical publication, multi-service,
enquiry, participant and Chat authorization graph. Public reads/sends retain both
block-edge gates; notification policy evaluates the actual edges and fresh worker/
recipient ports. Strict shared message facts suppress hidden/deleted content and
reject unknown/private fields, foreign participants, stale services and missing
legacy prefixes. Provider Chat raw reads also fail closed for invisible messages.
Two-way recording delivery is verified; real provider delivery remains disabled.
Transaction-local facts are reused, never cached across requests or retry attempts.
No history scans: measured Provider policy 15 point reads; message+queue 16R/5W;
successful single-event worker 52R/4W (including 1 query document, enqueue excluded).
This adds a missing secure integration, not a proven before/after aggregate saving.

62 distinct checks passed, 0 final failures/skips: 45 Node/static, 12 Chrome,
4 actual baseline Firestore Emulator, 1 native Admin SDK/Auth Emulator. An initial
Emulator failure exposed a missing delete method in the metered SDK test wrapper;
the wrapper was fixed, security assertions retained, and affected checks repeated.
Commands/evidence:
- Focused Node command: .firebase/provider-canonical-focused.log (45)
- node --test tests/browser/service-messaging-integration.test.mjs tests/browser/provider-conversation-integration.test.mjs tests/browser/unified-inbox.test.mjs (12)
- Baseline Emulator child: node --test tests/firestore-emulator/canonical-provider-notification-runtime.test.mjs tests/firestore-emulator/provider-read-state-runtime.test.mjs (4)
- Native Emulator child: node --test --test-name-pattern="REAL native Provider contact" tests/firestore-emulator/admin-runtime-native.test.mjs (1)
- Logs: .firebase/provider-canonical-browser.log, provider-canonical-baseline.log, provider-canonical-admin-runtime.log.

2,000 MAU trace model is regression-tested, NOT hosted traffic or complete capacity
acceptance. Assumptions: 5 messages/DAU/day, 50:50 Product/Provider, 20% retry/abuse,
one discovery/retirement candidate per query, index OFF; lifecycle includes enqueue,
worker, assumed retirement 5R/2W and API quota 2R/2W. Mixed message: 67R/13W.
DAU 200 / 400 / 600 => daily reads 80,400 / 160,800 / 241,200; writes
15,600 / 31,200 / 46,800. Excludes browsing, images, storage, read acknowledgments,
index operations, idle polling, hosting/Auth/provider costs. All exceed the 70%
Firestore free operating budget (35kR/14kW); zero-cost success is NOT established.
Official quota checked 2026-11-06: https://firebase.google.com/docs/firestore/quotas
(50k reads and 20k writes/day). No billing or architecture change made.

Next: authoritative legacy hide/delete/block writers with index invalidation and
signed-cursor/unread/tombstone parity; then real worker roles/preferences and
provider/device acceptance. Store/Media/Admin/Maps and staging inventory/Rules/
rollback acceptance still gate launch. Synthetic worker identities, recording
transport and loopback Auth are not staging/live acceptance. No live access,
deployment, Rules, IAM, credentials, billing, main or runtime activation; HOLD/NO-GO.

### Updated owner planning budget — 6 November 2026
Preferred <= INR 1,000/month; planning maximum INR 2,000/month for initial 2,000 MAU.
This supersedes zero-cost as a mandatory target, NOT any spending/activation gate.
New offline calculator: scripts/operating-budget.mjs; focused test command:
node --test tests/integration/operating-budget.test.mjs tests/integration/notification-capacity.test.mjs
Result: 4 pass, 0 fail/skip. No runtime security boundary changed; no Emulator/browser
rerun needed for offline arithmetic. Initial floating-point display assertion was
fixed by deterministic financial rounding, then both focused files passed.

Assumptions: measured mixed Chat 67R/13W per message, 5 messages/DAU/day;
additional browsing/detail/owner/admin/inbox allowance 100R/4W per DAU/day (UNMEASURED),
20% retry/abuse overhead, 30 days. Index/ack/idle polling amplification may exceed
that allowance. Rates use official Firestore billing EXAMPLE $0.06/100k reads,
$0.18/100k writes after DAILY 50k/20k free quotas, not an OLDX regional quote.
Backend planning candidate $7/month Render Starter, not purchased or load-tested.
INR conversion ASSUMED 90/USD, 18% tax buffer, INR250 contingency (not a quote).

| DAU | Reads/day | Writes/day | DB USD/month | Partial INR/month |
| --- | ---: | ---: | ---: | ---: |
| 200 | 104400 | 16560 | 0.98 | 1097.39 |
| 400 | 208800 | 33120 | 3.57 | 1372.20 |
| 600 | 313200 | 49680 | 6.34 | 1666.74 |

Partial = backend + DB operations + assumed tax/FX + contingency. NOT all-in:
media overage, persistent/index/audit storage growth, network egress, SMS/email,
backup/restore, domain renewal, Maps paid SKUs and extra worker instances are not
priced. FCM transport is listed no-cost, but worker/database operations still cost.
No full capacity/reliability acceptance yet; single-instance failure remains a risk.

Media sensitivity, not a quality reduction: 20 delivered images/DAU/day at average
120KB => 14.4/28.8/43.2 GB/month; with 3GB managed storage + 2000 transformations,
Cloudinary usage is 19.4/33.8/48.2 credits. Free25 is exceeded at 400/600 DAU; all
exceed 70% headroom17.5. Do not assume Cloudinary Free fits production. Measure
existing approved derivatives/cache hits first; never reduce approved quality or
retain less user data silently. R2 is only an alternative to evaluate through the
existing media port: egress-free storage is not image transformations/privacy/media
acceptance and would require separate resource/credentials approval.

Priority: finish legacy Chat visibility/block writers and exact unread parity;
measure idle discovery and batch amortization with audit/auth intact; then measure
real image bytes/storage and choose a media option before any paid approval.
No measured runtime savings in this arithmetic-only batch. Preferred INR1000 is
not established; INR2000 is conditional on media, region, retention, network and
hosted peak tests. Launch remains HOLD/NO-GO independently of this budget update.
Official sources checked 2026-11-06:
- https://firebase.google.com/docs/firestore/billing-example
- https://firebase.google.com/pricing (FCM)
- https://render.com/pricing
- https://cloudinary.com/pricing
- https://cloudinary.com/documentation/developer_onboarding_faq_credits
- https://developers.cloudflare.com/r2/pricing/

### 6 November — Product legacy privacy writers (isolated, default-off)
Start: 532756bfaa6c08ffbbdac940ab02ee584b53dee5, clean/equal fetched remote.
Existing Product repository now exposes changeVisibility and changeBlock behind
legacyMutationsEnabled=false. Hide-for-self derives UID from verified identity;
delete-for-everyone requires the canonical sender; block/unblock derives the other
participant and uses expectedBlocked CAS. Unknown command/message fields fail closed.
Actor/product/participant authorization is retained. Privacy edits and unblock may
run during invalidated inventory; normal send/read/ack still require a ready,
canonical index. No route, UI integration or feature activation was added.
Each mutation atomically writes source + exact idempotency receipt + action/sequence
audit + both participant inventory heads (5 writes). Global actor invalidation
covers all affected conversations without scanning histories. Hide point-reads one
message; block reads no messages. Exact replay writes zero. No before/after live
cost saving claimed; this supplies the previously missing atomic writer boundary.

Focused acceptance covers unauthorized deletion, foreign/revoked actors, client
visibility-target injection, unknown private fields, atomic rollback, lost commit
ack/replay, request-ID conflict, self-only hide, tombstone immutability, both block
edge ownership, unblock CAS and concurrent-device CAS. Existing reconciliation is
fed actual source records: exact unread/previews recover, both blocked views vanish,
unblock restores visibility, stale Inbox cursors are rejected and old signed read
receipts cannot advance stale canonical counters. Maintenance inventory facts in
these tests are fixture-scoped; no real deployment inventory is established.

48 distinct checks pass, 0 final failures/skips: 27 focused Node/integration,
17 Chrome Product/Inbox, 4 actual loopback Firestore Emulator. Final mutation-only
Emulator cases repeated after concurrency/audit additions; no unrelated full run.
- node --test tests/integration/legacy-product-mutations.test.mjs tests/integration/product-read-state.test.mjs tests/integration/product-conversation.test.mjs tests/integration/canonical-product-notification.test.mjs tests/integration/inbox-worker.test.mjs tests/integration/inbox-backfill.test.mjs scripts/emulator-test-plan.test.mjs
- node --test tests/browser/product-integration.test.mjs tests/browser/unified-inbox.test.mjs (installed Chrome via CHROMIUM_PATH)
- Emulator child: node --test tests/firestore-emulator/legacy-product-mutations-runtime.test.mjs tests/firestore-emulator/product-read-state-runtime.test.mjs
- Logs: .firebase/legacy-product-focused.log, legacy-product-browser.log,
  legacy-product-emulator.log, legacy-product-emulator-final.log.
An initial fixture clock mismatch and browser executable variable were corrected;
no assertions or security checks were weakened.

NOT full legacy Chat completion: reconciled rows remain unavailable to canonical
send/read/ack until legacy tombstone/history/read-prefix cursor compatibility is
implemented and accepted. Provider writers, real complete source-inventory/epoch
binding and gated UI/HTTP/rate-limit integration remain. Unsupported attachments/
unknown message schemas are deliberately unavailable to these writers. No live
Firebase/Rules/deployment/billing/main changes. Next safe task: reconciled-history
cursor/tombstone adapter, then equivalent Provider source writers. HOLD/NO-GO.

### 7 November — reconciled Product send/read-ack adapter (OFF)
Start 75a4127ee06a21a21cd9d4213cb608a086f44171; clean and equal fetched remote.
Existing Product repository/index now support reconciled-history send/read/ack via
reconciledHistoryEnabled=false, requiring trusted read state and index. Counts stay
visibility-aware in reconciled rows; physical prefixes remain separate server facts.
Send atomically increments only recipient visible unread and retains both row modes.
Bounded reads scan <=20 physical messages, omit invisible text and return a validated
throughSequence, including empty pages. Epoch/actor/Product-scoped signed receipts
advance only contiguous delivered ranges. Gaps fail closed; older completed receipts
are no-ops; privacy/inventory epoch changes invalidate all previous receipts.
Ack atomically updates physical read cursor, reconciled row/aggregate and receipt/
audit, preserving newer incoming messages and later source reconciliation. No
browser counts or identities trusted. Existing Product model/DOM accepts sparse
pages only with explicit opt-in, paginates empty pages and clears on logout.
No existing legacy writer was reimplemented, no route or live flag activated.

Measured: two-message page exactly 2 message reads, 0 writes; send 8 atomic writes
and 1 message-existence read; ack 5 atomic writes, 0 message/history reads; exact
send/ack replay 0 writes. These are adapter-operation counts, not whole-site savings.
65 distinct checks pass, 0 failures/skips: 43 Node/static, 18 Chrome, 4 actual local
Firestore Emulator. Coverage: hidden/deleted/empty pages, epochs, foreign actor,
block/unblock, missing prefixes, lost-ack, concurrent devices, new messages during
ack, repeated reconciliation, bounded client projection and mobile DOM/logout.
Focused Node command/tests and results: .firebase/reconciled-cursor-focused.log.
Browser: node --test tests/browser/product-integration.test.mjs tests/browser/unified-inbox.test.mjs;
new opt-in DOM case run separately by --test-name-pattern="opt-in reconciled Product DOM".
Emulator child: node --test tests/firestore-emulator/reconciled-product-cursor-runtime.test.mjs tests/firestore-emulator/product-read-state-runtime.test.mjs;
only new cases repeated after final block/prefix/operation assertions.
Logs: .firebase/reconciled-cursor-browser.log, reconciled-cursor-browser-new.log,
reconciled-cursor-emulator.log, reconciled-cursor-emulator-final.log.

Scope: supported Product v1 histories with valid physical prefixes. Truly unknown/
missing-prefix history needs verified migration; no counters guessed. Provider
writers/adapter, authoritative deployed inventory/epoch binding, reconciled summary/
notification readers and trusted HTTP acceptance remain. Legacy per-thread summary
paths stay unavailable for reconciled rows; unified Inbox remains authoritative.
Transport/rate-limit/hosted/device/staging acceptance is not proven by local ports.
No live Firebase/Rules/deployment/billing/main changes. HOLD/NO-GO.
Next: equivalent Provider writer/epoch parity, then reconciled notification/HTTP
acceptance using existing contracts, without activation.

### 7 November — Provider Chat parity (local/Emulator; OFF)
Start 8e57ad0022803af48087919481cca9141052d6cb; clean, fetched remote equal.
Provider now reuses Product's shared prefix/proof checks and reconciled Inbox stages.
Default-off privacy writers perform self-hide, sender-only deletion and own-edge
block/unblock CAS, atomically updating source, exact receipt/audit and both inventory
heads. Publication, selected service, participant eligibility and fresh block checks
remain mandatory. Privacy edits/unblock may run during invalidation; read/send/ack
require ready canonical or explicitly gated reconciled server rows.
Reconciled Provider send/summary/read/ack preserve exact visible unread totals,
physical read prefixes, scoped signed epochs, bounded/sparse/empty pages, gaps,
newer incoming messages, lost acknowledgments and multi-device idempotent retries.
Old canonical receipts are rejected after reconciliation. Unknown block fields are
preserved by rejecting writes; unknown messages/missing prefixes stay unavailable.
Existing Provider HTTP/DTO/model/DOM accept these paths only with explicit gates.
No live route or default changed. Multi-service profiles and existing locales remain.

Measured: privacy 5 atomic writes; reconciled send 8 writes + 1 message existence
read; ack 5 writes + 0 message/history reads; exact replay 0 writes. Pages read at
most 20 physical messages. No hosted capacity or aggregate cost saving is claimed.
62 distinct checks pass, 0 final failures/skips: 42 Node/static, 13 Chrome,
6 actual baseline Firestore Emulator + 1 native Provider/Auth Emulator smoke test.
New parity cases cover rollback (including failed ack audit), unknown commit replay,
concurrent block CAS/read ack, foreign/revoked users, service tampering, missing
prefixes, privacy epochs and the actual gated HTTP-to-mobile-DOM flow. Fixture
identities/inventory are synthetic; native Auth smoke covers the existing native
Provider journey, not deployment acceptance of these new paths.
Focused commands/evidence:
- Node focused file list/result: .firebase/provider-parity-focused.log (42).
- node --test tests/browser/service-messaging-integration.test.mjs tests/browser/provider-conversation-integration.test.mjs tests/browser/unified-inbox.test.mjs (13).
- Baseline child: node --test tests/firestore-emulator/provider-chat-parity-runtime.test.mjs tests/firestore-emulator/provider-read-state-runtime.test.mjs tests/firestore-emulator/reconciled-product-cursor-runtime.test.mjs (6).
- Native child: node --test --test-name-pattern="REAL native Provider contact" tests/firestore-emulator/admin-runtime-native.test.mjs (1).
- Logs: .firebase/provider-parity-browser.log, provider-parity-emulator.log,
  provider-parity-native.log; only new browser/Emulator cases repeated in *-final.log
  after stale-proof/unknown-edge/audit-rollback hardening. No weakened assertions.

Remaining: complete revision-fenced inventory/missing-prefix legacy migration,
authoritative cross-kind source/block/epoch mapping, reconciled notification readers
and real provider/device/hosted staging acceptance. Unknown legacy attachments and
schemas are not guessed. Next smallest safe task: isolated missing-prefix migration
planner/rehearsal using complete canonical inventories; no live migration approval
inferred. New backend/transport gates remain OFF. No live Firebase/Rules, deployment,
production/main, billing, IAM, credentials or dependency changes. HOLD/NO-GO.

### 7 November — bounded missing-prefix recovery and canonical mapping (OFF)
Start e1f27eb59569128c25f8053be027e21d97562959; clean/fetched remote equal.
Added an isolated metadata-only prefix planner/worker using the existing Product/
Provider canonical server readers, actual participant/source identities and Inbox
inventory heads. Begin requires both ready inventories with complete counts and
matching rows/revision/read cursors. Both heads are atomically invalidated. Job
checkpoints fence source state, actor membership counts and inventory epochs.
Each step reads <=20 physical messages and adds only missing readPrefix fields;
text, sender, timestamps, visibility and source read state remain byte-equivalent.
Known existing prefixes must match; ambiguous schemas/counters/ownership fail closed.
Four explicit, correctly directed Product/Provider block records must agree; missing
or conflicting facts stop with no writes. No block record is inferred or rewritten.
Audit failure rolls back source metadata/checkpoint/receipt together. Restart and
lost-commit replay are idempotent. Changed source/membership/epoch stops the job;
no destructive reset/rollback is attempted. Partial progress remains fenced.
Finishing prefixes does NOT enable an index: existing verified reconciliation and
finalization still run, preserving unread/newer messages and invalidating old signed
receipts. Maintenance job inventory verification in tests is fixture-scoped, not a
new deployed completeness oracle. No endpoint or live mode was added.

Measured happy paths (instrumented point-read calls, not hosted billing proof):
- Product begin 20 reads / 4 writes; Provider begin 24 reads / 4 writes; no messages.
- First page: Product 35 / Provider 39 reads including 20 messages, 23 writes.
- Final one-message page: 4 writes. Exact replay: 0 message reads / 0 writes.
- 21 initially missing prefixes require 31 worker writes, excluding reconciliation,
  retries and test setup. Valid pre-existing prefixes are preserved without rewriting.
39 distinct checks pass, 0 final failures/skips: 27 Node/static, 5 Chrome,
7 actual loopback Firestore Emulator. Coverage includes original fields/privacy,
missing/contradictory blocks, unknown ownership, incomplete/changed inventories,
source-epoch interruption, failed audit, persisted restart, stale cursors and unread.
Node focused list/results: .firebase/legacy-prefix-focused.log.
Browser: node --test tests/browser/legacy-prefix-recovery.test.mjs tests/browser/service-messaging-integration.test.mjs.
Emulator child: node --test tests/firestore-emulator/legacy-prefix-migration-runtime.test.mjs tests/firestore-emulator/provider-read-state-runtime.test.mjs tests/firestore-emulator/reconciled-product-cursor-runtime.test.mjs.
Logs: .firebase/legacy-prefix-browser.log, legacy-prefix-emulator.log; only new
migration/browser cases repeated in *-final.log after inventory-count hardening.

Scope remains known indexed v1 histories with verified physical read state. Complete
REAL collection inventory, unknown/unindexed legacy schemas/attachments, live source
writer fencing and authoritative cross-kind mapping acceptance remain unverified.
This code does not discover arbitrary collections, prove deployed completeness or
approve any live migration. Conflicting block stores need separately verified owner/
server reconciliation. Next safe task: reconciled notification readers on these
accepted source boundaries, or isolated adapters for a verified additional legacy
schema. No live Firebase/Rules/deployment/main/billing/IAM/secrets/dependency changes.
All new paths OFF; HOLD/NO-GO.

### 7 November — reconciled notification readers (OFF, recording only)
Start 8e4fceba4b5a4fd6d7c4980c84e7cb66025c34ed; clean/fetched remote equal.
Product and Provider readers now support explicit reconciledNotificationsEnabled=false
without changing defaults or live composition. Both participant rows/heads must be
ready, complete, source-revision/read-state compatible and consistently canonical or
reconciled. Unknown/empty/incomplete/mixed/stale inventory fails closed. Index facts
are transaction-cached, never shared across requests/retries. No history scan.
New paths require explicit four-edge canonical Product/Provider block consensus;
missing/conflicting/contaminated mappings remain unknown. A single-store fallback
is deliberately unavailable when the new gate is on. Existing migration readers
retain their independent canonical block ports. Worker role and recipient preference
ports are still mandatory server facts. Signed read cursors suppress already-read
queued messages. Hidden/deleted/blocked/foreign or revoked records cannot dispatch.
Source/index unread and pagination state are unchanged by notification processing.
Existing recording worker/outbox preserve leases, atomic audit, idempotency and
lost-ack recovery. No actual provider transport, route or runtime was activated.

Measured: Product/Provider privacy 17/21 point reads, one message, zero writes.
Successful single-event recording worker 58/70 reads (includes one query document),
4 queue/audit writes, zero Chat/index writes. Distinct inventory/edge facts are read
once per transaction. Existing unindexed canonical baseline remains 11/15 policy
reads and 40/52 worker reads: the new complete-index/cross-kind checks add 6 reads
per privacy checkpoint, not an aggregate saving. Earlier index-OFF capacity models
do not price this new gated path; real hosted delivery/capacity is still unverified.

52 distinct checks passed, 0 final failures/skips: 37 Node/static (35 focused + 2
existing prefix-recovery regressions), 8 Chrome, 7 actual loopback Firestore Emulator.
Coverage includes no-mapping fail-closed, hidden/deleted/blocks, stale read cursors,
foreign/revoked actors, invalid inventory/edge/message facts, opt-out, recording-only
privacy, lease retry without duplicates and unchanged mobile Inbox totals/logout.
- Focused Node list/results: .firebase/reconciled-notifications-focused.log (35).
- node --test tests/integration/legacy-prefix-migration.test.mjs (2).
- node --test tests/browser/reconciled-notifications.test.mjs tests/browser/unified-inbox.test.mjs (8).
- Emulator child: node --test tests/firestore-emulator/reconciled-notifications-runtime.test.mjs tests/firestore-emulator/canonical-product-notification-runtime.test.mjs tests/firestore-emulator/canonical-provider-notification-runtime.test.mjs (7).
- Logs: .firebase/reconciled-notifications-browser.log, reconciled-notifications-emulator.log,
  reconciled-notifications-migration-regression.log; only new notification cases
  repeated in *-final.log after mandatory mapping hardening.
Offline schema/inventory checklist: legacy-offline-compatibility-checklist.md.
No live data was inspected to fill it; unknowns stay HOLD.

Remaining: real complete inventory/schema/block mapping, deployed writer fencing,
server worker/preferences bindings, durable real-provider/device acceptance, staging
and realistic hosted cost/load tests. Synthetic roles and recording-only transport
are not live delivery acceptance. No Firebase/Rules/deployment/billing/IAM/secrets/
main/dependency changes. All new paths OFF; HOLD/NO-GO. Next safe task: provider
acceptance/reconciliation contracts and bounded delivery measurements without transport
activation, or an isolated adapter for a separately verified unknown legacy schema.

### 7 November — trusted notification registry/preferences bindings (OFF)
Resume base 012b46793a1339ef6ff4d2fd83bfac60cc640d8a; fetched remote/branch clean/equal.
Concrete isolated bindings now replace synthetic worker/preference fact callbacks.
Worker identity reuses verified/revoked credential ports; a fresh strict server-owned
registry controls role/activation. No role-provisioning or browser-owned worker flags.
Recipient eligibility comes from existing canonical Product/Provider actor readers,
not another user collection or fabricated suspended=false. Transaction caches reuse
facts already read by canonical privacy authorization.
Owned preference read/update ports derive UID from verified credentials, require
atomic quota enforcement and preserve CAS, request fingerprint, receipt/audit and
safe retry. Old opt-in replay cannot reverse newer opt-out; no-op writes preserve
idempotency/audit without rewriting preferences. Unknown preference schemas fail
closed; missing new v1 documents explicitly opt out. Approved generic/full preview
choice is stored, but actual envelopes remain generic and recording-only.
No contact/location/privacy preferences or existing design were changed. No route,
worker, transport, secret, IAM, billing or live Firebase setting was enabled.

Measured: changed preference command 3 data reads/3 writes; no-op 3R/2W; replay
3R/0W. Every admitted owner read/update additionally consumes 2R/2W atomic actor/
global quota (including retries). Thus no-op avoids one preference-data write,
not audit or abuse controls. Worker remains Product 58 / Provider 70 reads incl
one discovery query document +4 queue/audit writes, zero Chat/index writes/history
scans. Account eligibility causes no extra Firestore read in the canonical policy
transaction. No aggregate/hosted cost reduction or production readiness claimed.

53 distinct checks passed, 0 final failures/skips: 38 Node/static, 8 Chrome,
6 actual baseline Firestore Emulator +1 actual Auth/Firestore Emulator identity test.
Coverage: registry/UID/version contamination, canonical account scope, missing and
malformed choices, opt-out during a lease, concurrent preference CAS, stale opt-in,
audit rollback, persisted no-op/replay, JWT issuer/revocation-check contract, actual
Emulator disabled user/worker tokens, ordinary-user non-worker authorization, mobile
Inbox/unread/logout and bounded worker retries. Initial fixture declaration/retry-
options errors were corrected; no assertions were weakened.
- Node focused file list/results: .firebase/notification-bindings-focused.log (38).
- node --test tests/browser/notification-bindings.test.mjs tests/browser/unified-inbox.test.mjs (8).
- Baseline child: node --test tests/firestore-emulator/notification-bindings-runtime.test.mjs tests/firestore-emulator/reconciled-notifications-runtime.test.mjs (6).
- Auth child: node --test tests/firestore-emulator/notification-bindings-auth-runtime.test.mjs (1), exact demo project/8088/9098 guarded.
- Logs: .firebase/notification-bindings-browser.log, notification-bindings-emulator.log,
  notification-bindings-auth.log. No repeated unrelated full suite.
Provider/device/staging checklist: notification-provider-device-acceptance.md.

Remaining: real worker principal/registry administration, deployed canonical account/
preference/inventory/block mappings, trusted HTTP/UI hosting acceptance and real
provider/device/consent-race/load/cost tests. Local ports and synthetic registry rows
are not deployed bindings; live provisioning still needs separate approval. New
paths stay OFF. No live Firebase/Rules/deployment/main/paid services/dependencies.
HOLD/NO-GO. Saved files/checkpoint permit resuming from the next verified Git HEAD;
no automatic background continuation is assumed after credit/session exhaustion.
