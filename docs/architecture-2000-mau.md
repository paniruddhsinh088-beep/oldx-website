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
