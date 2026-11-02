# Publication fixtures and Store sharing progress — 2 November 2026

## Verified starting point

Read AGENTS.md, relevant Store/Service/security/Chat/Admin/localization/Android
roadmaps and the detail-batch report. Clean `security-hardening-review` at
`f8429c8`, equal to fetched remote; starting-head safety CI 41412615129 passed.
Preserved 710d1a2, 498e3a0, f8429c8 and all earlier checkpoints. No concurrent
implementation was present; existing detail/lifecycle tests were reused.

## Batch A — inactive publication/authorization evidence

Added deterministic catalogue/Store/listing/publication-change timelines,
28 proposed public-detail actor/scenario cases and 12 denied-surface fixtures.
Guest, seller, other-seller and moderator labels never provide authority to the
projector. Tests exercise the existing public request schema, exact field
allowlists, private-field exclusion, Store/listing withdrawal, owner/product
mismatch, removed records, malformed IDs and pagination-to-detail revalidation.

A limitation test explicitly shows that an old published Store plus a fresh
published listing cannot prove freshness. Revalidated Store state rejects an
intervening suspension. Actual consistency, backend/Rules enforcement and role
verification remain inactive/approval-gated; these fixtures are not authorization
middleware. The public path never grants private/moderator access.

Targeted `npm run test:stores` passed **74/74** (42 retained + 32 new matrix/contract
cases). No backend, Rules, index, dependency or production HTML change.

## Batch B selection

Reviewed current implementation across Service, Store/sharing, Chat, Admin,
localization and future Android. Added the
[feature matrix](feature-completion-matrix-2026-11-02.md), distinguishing existing
source, synthetic-only behavior, missing integration and approval gates without
percentages or live claims. Selected synthetic Store copy/native sharing as the
highest-value safe UI step. Existing Service share transport will be reused;
real OG metadata, route/media/poster work remains separately gated.

Final source commits, tests, CI and next task follow after verification.

## Implemented Store sharing

Added canonical same-origin Store preview link construction, stripping query
parameters and unrelated product/filter state. The public sample header offers
copy/native share and manual copy fallback. Existing Service transport and generic
localized share feedback are reused; no duplicate OS/clipboard implementation,
new dependency, production route or Service rewrite is introduced.

Sharing is available only for an accepted public sample. Loading, invalid or
unavailable detail, withdrawal and cache/route changes disable controls and clear
URL/status state. Revision checks ignore late share feedback. Native cancellation
does not copy; denied clipboard shows honest manual recovery. A URL already sent
to OS/clipboard cannot be retracted later; this is not a freshness guarantee.

Added seven matching Store keys in gu/hi/en and corrected the locale README's
stale Service-only/key-count description. Updated the feature matrix to mark this
preview behavior complete, retaining real route/OG/media/poster approval gaps.

Focused checks passed `test:stores` **76/76**, all retained **22** Store browser
flows and three new sharing integration cases. The cases cover canonical links
without query tokens, keyboard copy, cancellation, all-locale clipboard denial,
unchanged authored Store names, pending/withdrawn controls and late feedback.
All prior 320px/200%-text and labels/touch-control checks include the new controls.
The full combined regression sweep is recorded below after completion.

Remaining gates: D1–D12, real backend/public schema, trusted role and Store/seller
resolution, consistent publication/freshness, sanitized public/private separation,
indexes/actual Rules/compatibility tests, native-language review and deployment.
No live reads, main, Rules, secrets, provider resources, billing or paid API changed.

Next high-value safe task: a clearly synthetic Store share-card preview/export
using the canonical sample URL and existing safe rendering helpers; keep actual
shop photos, real QR/canonical routes and crawler metadata separately gated.

## Combined local regression evidence

All 29 available non-emulator script commands passed. Policy/source checks are
not actual Firebase Rules execution; no local emulator run is claimed.

| Command (`npm run …`) | Passed |
| --- | ---: |
| test:emulator:safety | 78 |
| test:profile-migration | 11 |
| test:admin-backend | 108 |
| test:firebase-config | 6 |
| test:product-migration | 11 |
| test:product-category | 8 |
| test:product-image-classifier | 9 |
| test:image-upload-contract | 7 |
| test:image-lifecycle | 8 |
| test:image-upload-abuse | 12 |
| test:inbox-summary | 5 |
| test:chat-read-receipt | 5 |
| test:chat-message-authorization | 15 |
| test:account-deletion | 7 |
| test:privacy-policy | 12 |
| test:data-requests | 7 |
| test:chat-privacy | 9 |
| test:chat-block-policy | 12 |
| test:chat-private-user-state | 9 |
| test:service-providers | 146 |
| test:emulator:guard | 10 |
| test:service-preview | 8 |
| test:service-preview:browser | 16 |
| test:static-build | 3 |
| test:i18n | 11 |
| test:toolchain | 2 |
| test:stores | 76 |
| test:stores:browser | 25 |
| test:stores:preview | 3 |

`git diff --check` passed. No dependency versions, overrides or lockfile changed;
unchanged expensive dependency investigations were intentionally not repeated.
Actual CI and commit evidence follows after the combined push.

## Exact commits and CI checkpoint

- `d8c7a5a`: publication timelines, executable proposed matrix and feature inventory.
- `12984c66b47ee5b1829fab031d057c7f1abe6d4a`: privacy-safe localized Store preview
  sharing, updated feature matrix and combined regression evidence.

Both were pushed together normally only to `security-hardening-review` after a
fresh fetch/ancestry check, avoiding redundant intermediate CI. Exact combined
source passed:
- [Branch security 41415023475](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41415023475).
- [Review safety 41415023451](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41415023451), including Store/Service browser, locale/security checks and existing isolated Firebase Emulator suites.

New publication/role/freshness fixtures are synthetic contract evidence, not
actual Rules enforcement of a new backend. Vercel metadata lists zero deployments
for exact combined source. The deployment-disabled source setting was verified;
710d1a2, 498e3a0, f8429c8, original 37209fd and earlier checkpoints remain ancestors.
Working tree was clean after source commits. This final evidence entry changes
documentation only. No main, live data/Rules, paid services or provider resources
were changed.
