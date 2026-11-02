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
