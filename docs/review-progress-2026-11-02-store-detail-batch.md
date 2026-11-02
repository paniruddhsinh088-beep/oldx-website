# Store product-detail contract progress — 2 November 2026

## Starting verification

Read AGENTS.md, Store roadmap, security/release-readiness documents and the latest
Store async progress report. The authorized branch was clean at `a6955a7`, equal
to freshly fetched remote. Exact starting-head safety CI 41404355335 passed.
Preserved 23c226d, a6955a7, 0ab408d, 632fe83, 910744e and all earlier checkpoints.
No concurrent implementation was present and no completed work was recreated.

## Coherent source batch

- Added an inactive pure synthetic detail-read plan and strict public projection.
  Scope is exactly seller-based Store UID plus requested product ID, with one
  logical Store and one listing document per future trusted attempt. No SDK,
  network, real collection/provider selection or backend activation is added.
- Independently checks Store publication, immutable seller association, listing
  publication/ownership and requested product identity. Removed/withdrawn data
  returns an unavailable state; malformed or mismatched input has no snapshot.
- Offline detail adapter selects one authored sample directly. The UI now renders
  its accepted public DTO instead of searching the first 24 catalogue cards.
- Reused the existing controller via read/projection injection; preserved its
  deadlines, cancellation, revision gating, cache invalidation and keyboard focus.
  No duplicate request controller or Service rewrite was needed.
- Added gu/hi/en unavailable recovery copy. Original sample content is preserved;
  language changes reformat the accepted product price without another read.
- Added pure contract/lifecycle tests and controlled browser regressions for
  independent publication, wrong identity/owner, removed products, out-of-order
  details, stale results, cancellation, timeout/retry and back/forward navigation.
  Unavailable text is checked at 320px and 200% computed text in all three locales.

Existing browser mock responses were updated to the new independent detail DTO;
all original stale-data/privacy assertions remain. The prior withdrawn-listing
case now checks the unavailable view rather than a malformed-snapshot error,
reflecting explicit publication denial. No test was skipped or weakened.

## Evidence and remaining gates

Local results, commits and exact-source CI follow after the batch verification.
No local Firebase Emulator execution is claimed. Existing CI supplies isolated
Emulator evidence, separately from pure policy/contract and offline browser tests.

Synthetic preview only. Main, live Firebase/rules, provider resources, credentials,
billing, paid APIs and deployments remain untouched. The backend/schema, public
publication/consent, trusted Store resolution, query/index, freshness/revocation,
Rules and compatibility gates remain HOLD/NO-GO. Native-speaker review is pending.
See the [inactive detail contract](../features/stores/DETAIL_READ_CONTRACT.md).

Next safe independent task: verify cancellation settles request callers promptly
even when a mock ignores AbortSignal; retain bounded timers and late-result guards.

## Comprehensive local sweep

All 29 available non-emulator commands passed, reporting 601 tests in aggregate
(overlapping scripts repeat checks; this is not unique-test coverage).

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
| test:stores | 41 |
| test:stores:browser | 22 |
| test:stores:preview | 3 |

`test:emulator:safety` and policy models are local source/contract checks, not
actual emulator execution. `git diff --check` passed. No dependency version,
override or lockfile changed; unchanged advisory/toolchain work was not repeated.
