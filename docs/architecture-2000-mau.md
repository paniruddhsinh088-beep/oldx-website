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
