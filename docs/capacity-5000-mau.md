# OLDX 5,000 MAU capacity checkpoint — 6 November 2026

HOLD/NO-GO. Starting HEAD cdc717b1b3fe3336cd5aad5f96bd3154572a4156.
No live Firebase reads/writes, Rules, credentials, IAM, billing or deployment changes.
This document and committed focused tests are the resume checkpoint if the session ends.

## Evidence and current architecture

Existing homepage 12-record dual cursors, Store 24-record cursors, Chat 35-record
history and session guards were verified present and not rewritten. Search remains
loaded-subset search, not a server search index. Legacy direct access remains blocked
by deny-all; the scenarios below model its workload/equivalent future trusted APIs,
NOT a claim that the legacy application is authorized or deployed.

New instrumentation executes the existing repository/transaction code with SDK doubles.
Counts are attempted document reads/writes, not measured production billing; index-entry
charges, contention retries, actual encoding and provider CPU need staging measurement.
Empty queries count at least one read-equivalent. No security checks were removed.

| Executed isolated journey | Reads / writes, excluding HTTP quota counters |
| --- | --- |
| Product create private draft + audit/receipt | 4 / 3 |
| Same-key Product retry | 4 / 0 |
| Product publish transaction (synthetic media acceptance only) | 4 / 5 |
| Product public detail | 3 / 0 |
| Product page 12+1, same seller, after optimization | 30 / 0 |
| Provider draft / owner bootstrap / publish | 6/5 ; 7/0 ; 9/6 |
| Provider discovery with ONE returned fixture | 12 / 0 |
| Buyer Provider enquiry | 13 / 4 |
| Admitted native atomic rate check | 2 / 2 |
| Rejected native atomic rate check | 2 / 0 |
| Legacy exact unread: four rooms, 100 incoming messages each | 412 reads, 17 bounded SDK calls |
| Same unread with 1,000 incoming messages per room | 4,012 reads, 89 calls |

Major remaining costs: exact unread still scans all incoming history; trusted summaries
are not connected. A message also needs thread/message/receipt/audit operations.
Per-request Firestore rate counters create writes even for read-only API requests.
Public queries validate private projections, seller eligibility, generations and Store
publication; bounded pages do not make these reads free. Media needs manifest/byte/
revocation checks. Authenticated user profile refreshes, own-ad queries, and room metadata
listeners remain legacy integration/cost risks. Admin legacy reads/deletes stay disabled;
secure Admin pages are bounded but require active-role/case/audit integration.

## Baseline model: assumptions, not telemetry

5,000 MAU; 30-day month; 500/1,000/1,500 DAU. Per active day: two home pages,
three details, 0.2 Store directory/detail/catalogue journeys, 0.5 Provider discovery
pages, 0.05 enquiries, two sent messages, two unread refreshes over four rooms with
100 incoming messages, ten viewed images averaging 120 KB, 0.1 uploaded photo,
0.02 owner updates and 0.001 Admin cases. Admin page allowance: 30 reads/case.
Store directory/detail/catalogue budget: 76 reads/journey; Provider discovery budget
50 reads/page is an unverified full-page allowance, not the measured one-row cost.
Media manifest/byte checks budget 140 reads/day. These estimates may be LOW for real
media processing or heterogeneous schemas. About 31 API calls/day, each conservatively
charged the measured 2-read/2-write quota pattern. Round total to 1,200 reads and
75 writes/day, then add 20% for retries/abuse: **1,440 reads / 90 writes per DAU**.
This is a workload scenario, not a MAU-to-bill conversion or traffic restriction.

| Scenario | DAU | Reads/day | Writes/day | Backend calls/month | Image GB/month | DB egress GiB/month* |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10% | 500 | 720,000 | 45,000 | 558,000 | 21.6 | 20.6 |
| 20% | 1,000 | 1,440,000 | 90,000 | 1,116,000 | 43.2 | 41.2 |
| 30% | 1,500 | 2,160,000 | 135,000 | 1,674,000 | 64.8 | 61.8 |

*1 KiB average DB response/read; actual transfer encoding/cache/region differs.
Media includes 20% overhead. API responses assume 2 KiB each: combined Render image
proxy + response egress is at least 22.7 / 45.5 / 68.2 GB/month; service-initiated
DB/provider traffic adds more. Approved CDN delivery is not interchangeable with
private/proxied media; bypassing required revocation checks is not an optimization.

Storage illustration after ONE month: 50 MB base; two messages/DAU/day, four 1-KiB
records per message with 2x index allowance; ten actor rate buckets/DAU/day plus
1,440 global buckets/day at 0.5 KiB each. Result: ~395 / 717 / 1,040 MB.
This is an assumption, not a real inventory. Retained history/audits keep growing;
expiresAtMs does not delete rate documents, and Spark TTL is not free. No automatic
or destructive cleanup was added. Media originals+derivatives at 240 KB/new upload
add 0.36 / 0.72 / 1.08 GB/month, before existing retained assets. Assuming one
transformation/upload, Cloudinary usage becomes ~23.46 / 46.92 / 70.38 shared credits.

## Official free limits and 70% operating budgets (checked this batch)

- Firestore Standard: 50k reads/day, 20k writes/day, 1 GiB storage, 10 GiB/month
  egress; 70% budgets: **35k / 14k / 0.7 GiB / 7 GiB**. All modeled scenarios fail
  the read/write/egress budget. Baseline storage is already near its budget.
  https://firebase.google.com/docs/firestore/quotas
- Render Free: 750 pooled hours/month (70%=525), sleeps after 15 idle minutes,
  cold start about a minute, ephemeral disk; no production recommendation from Render.
  5 GB Hobby egress (70%=3.5 GB) and 500 build minutes (70%=350). A continuously
  running 30-day instance uses 720 hours, already above the requested 70% target.
  https://render.com/docs/free ; https://render.com/docs/outbound-bandwidth ; https://render.com/docs/build-pipeline
- Cloudinary Free: 25 shared credits (70%=17.5), production use allowed within limits.
  One credit=1 GB storage OR 1 GB image delivery OR 1,000 transformations; usage adds
  across categories. All unoptimized scenarios exceed the 70% credit budget.
  https://cloudinary.com/pricing ; https://cloudinary.com/documentation/billing_and_plans ; https://cloudinary.com/documentation/developer_onboarding_faq_free_plan
- Vercel Hobby is non-commercial/personal only; excluded as a commercial OLDX solution.
  https://vercel.com/docs/plans/hobby
- Workers Free: 100k requests/day (70%=70k), 10 ms CPU/request (70%=7 ms), 128 MB
  memory (70%=89.6 MB). Modeled front-door requests fit, but native Firebase Admin/
  Firestore/sharp compatibility and trusted processing throughput are NOT established.
  https://developers.cloudflare.com/workers/platform/limits/
- Firebase Storage/Functions, SMS, managed backups/PITR/TTL, domains, scan add-ons and
  paid overages are not included in a promise of zero spend. Free quotas mean service
  failure/suspension on exhaustion, not unlimited scale. No billing upgrade proposed.

## Two verified safe changes

1. Public list transactions reuse identical actor/Store reads ONLY inside a single
   transaction attempt. Prior inspected same-seller page cost =13 query+13 private+
   13 actor+3 generation reads=42; instrumented new cost=30, a 28.6% reduction for
   that fixture. Unique sellers may save nothing. Suspension, withdrawal and retries
   still revalidate; no cross-request/time-based authorization cache or audit changes.
2. Approved galleries defer the WHOLE existing verified fetch until within 200px of
   viewport, with single dispatch per scope. Unseen seven-image album: 2 manifests+
   7 byte requests -> 0; visited album retains all 9 requests and both manifest checks.
   Browser fixture measured 0 offscreen vs 2 manifests+1 byte after visibility.
   Revocation/pagehide cleanup remains; WebViews without IntersectionObserver fall
   back to immediate loading. No global bandwidth-saving percentage is claimed.
   Example only: if 40% of albums are never approached, image delivery drops 40%; at
   1,000 DAU, 43.2 ->25.92 GB/month, still far beyond Render's 3.5 GB budget.

The capacity table deliberately does not assume favorable seller mix or unseen-album
rate. Removing legacy history scans alone still leaves roughly (1,200-824)*1.2=451
reads/DAU/day, far over 35k/day at 1,000 DAU. Current modeled first bottleneck permits
only ~24 DAU at the 70% read budget; this is not a measured production capacity.

## Validation / resume state

Final focused runs: 13 Node integration/security tests (capacity-read-cost, store-ui,
staging-public-query); 16 browser tests (approved-photo-view including deferral,
revocation, gu/hi/en and Android fallback; provider-media); 5 static packaging tests;
1 selected REAL Auth/Firestore Emulator native public Browse test. **35 pass, 0 fail,
0 skip**. Initial browser verification caught missing observer-state initialization;
it was fixed and all affected tests rerun, without removing security assertions.
Command for native test: validated admin-runtime plan with
`node --test --test-name-pattern="REAL native public Browse" tests/firestore-emulator/admin-runtime-native.test.mjs`.
`npm run test:capacity` reproduces five instrumented measurement cases.

## Decision and next three tasks

Existing architecture at 5,000 MAU / 1,000 DAU / all features / 70% headroom / unchanged
performance / permanent zero cost: **NOT FEASIBLE as currently evidenced**. This is
not a theorem about all possible lighter workloads. Current live staging remains
blocked on full inventory/Rules snapshot, trusted credentials/hosting acceptance and
media processing; no runtime was activated. No production or live changes.

Staging candidate: static frontend + Firebase Spark Auth/Firestore + isolated Render
Free Node backend + Cloudinary Free; cold starts, low traffic and quota stops must be
accepted explicitly. This is not an equivalent production performance guarantee.
For commercial production no complete drop-in zero-cost architecture has been verified.
Workers/static assets + Spark + Cloudinary is a research candidate, not a validated
port; preserve trusted server authorization and investigate commercial terms before
selection. Do not use Vercel Hobby or remove features to claim feasibility.

1. Replace full-history counting with existing trusted unread summaries/read cursors,
   atomic idempotent updates and legacy reconciliation; leave disabled until tested.
2. Design audited distributed abuse protection that reduces per-request Firestore
   counter writes; preserve global/actor atomic limits and rate abuse tests.
3. Measure approved thumbnail/detail derivatives, private/public delivery and real
   retention/index costs in authorized staging, then evaluate a commercially eligible
   free runtime with native media/Auth compatibility and 70% resource headroom.
