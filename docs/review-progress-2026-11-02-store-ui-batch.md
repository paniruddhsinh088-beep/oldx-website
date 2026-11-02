# Review progress — isolated Store catalogue UI — 2 November 2026

## Verified starting point

Read AGENTS.md, Store roadmap, security implementation/release-readiness docs,
product public/private migration proposal and the previous profile-batch report.
Fetched the authorized branch before editing: clean `security-hardening-review`
at `37b1f83`, equal to FETCH_HEAD, no concurrent implementation to overwrite.
Preserved `5ed468f`, `795b921`, `4dd12d3`, `e2d73b9` and original `37209fd`.
The latest starting-head review-safety CI
[41396644782](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41396644782)
was successful. Existing completed Service sharing, Store models, localization,
security and enlarged-text fixes were reused rather than recreated.

## Completed coherent source batch

- Added `store-preview.html`, isolated synthetic fixtures and a modular catalogue
  controller/stylesheet. Uses the existing bounded Store model, six cards per
  page, title/category/availability filtering, numeric price/name/newest sorting,
  pagination, empty-shop guidance, empty search results and explicit invalid-filter
  recovery. No production HTML or Store behavior changed.
- Added direct sample Store/product routes, reload and browser history support;
  preserved filters/page on return from a product, restored result focus, and
  cleared stale identity/product fields for unknown/malformed routes.
- Added 54 matching Store keys per gu/hi/en catalog using the shared existing
  translator/DOM/preference modules. Authored sample seller/product content is
  preserved; only the existing allowlisted locale preference is persisted.
- Added semantic links, labels, status/alert regions, heading focus, keyboard
  recovery, 44px touch controls and responsive 320px/200%-text layouts across
  catalogue, product, empty and not-found views in each locale.
- Added nine Store browser flows, offline/source privacy checks, bounded route
  tests, explicit packaging and CI steps. Both browser suites share a restricted
  loopback server fixture with correct CSS/module MIME types. Static tests now
  verify HTML-linked assets as well as transitive module imports.
- Reviewed shared patterns: existing i18n, projection model and asset allowlist
  were reused; duplicated browser server code was extracted. The existing
  Service controller/layout was preserved because a broader rewrite had no
  demonstrated benefit. Service's 16 browser flows still pass. Store renders
  only six cards at once, adds no dependency and requests no remote media/fonts.
- Added an **inactive, non-browser** public-data contract: exact seller and
  publication predicates, fixed collection/order, limit+1, bounded/scoped draft
  timestamp cursors and defensive public-card response projection. Tests reject
  malformed/unpublished/mixed-seller/duplicate/oversized batches and query-path
  overrides. The contract document lists approval, query/index, publication,
  privacy, freshness/revocation, Rules and compatibility requirements.

Details: [preview guide](../features/stores/PREVIEW_CATALOGUE.md),
[inactive public-data contract](../features/stores/PUBLIC_DATA_INTEGRATION_CONTRACT.md).

## Local evidence and failure handling

One comprehensive sweep ran all 29 available non-emulator script commands,
including both browser suites. Reported aggregate: 569 tests (overlapping scripts
repeat some checks; this is not a unique-test or coverage claim). Two source-test
failures shared one cause: the old Service test assumed `modules[0]` was the
controller; adding the CSS manifest entry exposed the brittle ordering assumption.
The assertion now reads the exact controller path, preserving every security
assertion. Targeted reruns passed `test:emulator:safety` 78/78 and
`test:service-preview` 8/8. Unchanged expensive suites were not repeated.

During targeted browser development the enlarged-text harness initially doubled
styles repeatedly across fragment-only navigation (256px heading rather than the
intended 64px). It now explicitly reloads before each scale check. All original
320px, full-label and 200% scale assertions remain. A local mobile screenshot was
visually inspected. After the final initialization guards, the nine Store browser
flows and three Store source/privacy checks passed again.

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
| test:stores | 22 |
| test:stores:browser | 9 |
| test:stores:preview | 3 |

`git diff --check` passed. No local Firebase Emulator execution is claimed;
official binary downloads retain the documented environment-policy blocker.
Existing GitHub CI is used for actual isolated Emulator validation.

## Development dependencies

No package version, dependency, override or lockfile changed. Current audit:
`npm audit --omit=dev --json` zero vulnerabilities; full `npm audit --json`
13 moderate, zero high/critical. This is a new registry snapshot, **not** a claim
that this batch fixed five advisories compared with the previous report of 18.
Direct advisory roots remain glob GHSA-3g3m-2fjr-6pw4 and minimatch
GHSA-g3hv-75wg-m249, propagating through Firebase CLI development tooling.
Registry metadata still identifies installed CLI 15.34.2 as current. No verified
compatible update was available; forced major overrides were not applied.

## Safety, blockers and exact next task

This is a synthetic preview, not a production-ready or live Store catalogue.
Main, legacy production HTML, live Firebase data/rules, deployments, provider
accounts, secrets, resources, billing and paid APIs were untouched. The review
branch's deployment-disabled source configuration is preserved.

HOLD / NO-GO and D1–D12 approval gates remain. Native-speaker review is pending;
real seller profiles/media/contact, trusted search/sort/cursor adapters, approved
publication policy, sanitized public/private split, index/Rules authorization,
revocation handling and compatibility migration require separately reviewed work.
Do not filter private legacy documents in a public browser or confuse local sample
pagination with server queries. Draft contract tests are not actual Rules tests.

Next safe task: prepare synthetic query-scope/cursor and publication-revocation
regressions for the inactive Store adapter contract, including category,
availability and sort changes. Do not activate a backend or modify live Rules.

## Resumed draft review

This session found the above batch present as uncommitted working-tree changes,
with HEAD still `37b1f83` and equal to the freshly fetched remote. Preserved and
reviewed that draft rather than duplicating it. Inspected the retained regression
logs and successful targeted reruns; these are existing local evidence, not a
claim of a new comprehensive sweep in the resumed review. No background writer
was observed modifying the files during review.

A new keyboard regression reproduced an accessibility issue: activating the
skip link changed the hash to `#main`, which the Store router treated as invalid.
The link now focuses/scrolls the main region without altering the active Store
or product route. The new regression preserves the skip link's keyboard behavior
and asserts both route and view identity.

Exact commits, final targeted results and CI evidence follow after reviewed push.

## Reviewed source checkpoint and CI

`0ab408d9ed1b462283f8d72241deb0b40a939531` commits the preserved Store UI draft,
reviewed boundary contracts and keyboard skip-link correction. Pushed normally
only to `security-hardening-review` after checking FETCH_HEAD ancestry and the
branch's deployment-disabled configuration. Local resumed checks passed:
`test:stores:browser` **10/10**, `test:stores:preview` **3/3**,
`test:static-build` **3/3**, plus `git diff --check`.

Exact-source CI all passed:
- [Branch security 41399403064](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41399403064).
- [Service 41399402994](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41399402994).
- [Review safety 41399403039](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41399403039).

These workflows include the new Store tests and retained Service, locale,
security and actual isolated Firebase Emulator checks. Vercel metadata lists
zero deployments for this exact commit. No live Firebase was accessed.

## Continued inactive contract hardening

Continued automatically with the documented next independent task. The contract
now describes optional server-side category/availability predicates with newest
ordering; unsupported search/sorts fail closed rather than implying that filtering
one page searches a whole Store. A versioned cursor binds seller, category,
availability and order; changes require a new first page. `nextCursor` anchors the
last returned card, preserves nanoseconds/ID ties and excludes the lookahead.

Defensive response tests reject mismatched query membership, replayed anchors,
unsorted rows and publication withdrawn between pages (including lookahead).
Invalid record IDs are rejected before comparisons can coerce an object. Errors
return no cards or continuation cursor. These tests do not establish cache erasure,
snapshot isolation, approved publication policy, Store publication resolution,
actual SDK query/index correctness or Rules authorization. All remain approval
and implementation gates. No adapter or server/browser integration was added.

Store UI category choices and the contract reuse the model's frozen category IDs,
removing the duplicate 12-category list. The relevant comprehensive sweep passed:
`test:stores` **27/27**, `test:stores:preview` **3/3**, `test:stores:browser`
**10/10**, `test:static-build` **3/3**, `test:i18n` **11/11**,
`test:emulator:safety` **78/78** (source/policy checks, not local emulators).
The final additional ID-coercion regression passed in the focused contract suite
**6/6**, bringing the Store unit suite to 28 cases. Earlier unchanged expensive
checks were reused from the previous sweep and exact-source CI.

Remaining development advisories are unchanged by this source batch; dependency
versions/lockfile are untouched. Do not force major overrides. Native-speaker
review and real public-data integration approvals remain outstanding.

Next safe task: synthetic asynchronous adapter-response lifecycle tests for
out-of-order requests, scope changes, revocation and clearing stale card/detail
state, without fetching real data or activating a backend. Store share posters,
real media/contact and social crawler routes remain separate gated roadmap work.

## Final follow-up checkpoint

`632fe83eb4b2fb5321f223248033e571322c5c3d` contains the inactive scoped-cursor
and revocation hardening plus shared category IDs. Final local `test:stores`
passed **28/28** after the ID-coercion regression. Exact-source
[review-safety CI 41399934739](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41399934739)
completed successfully, including both browser suites and isolated Emulator steps.
Vercel metadata lists zero deployments for this source commit. All required
Service/Store/locale checkpoints and `37209fd` remain unchanged ancestors;
branch-only normal pushes succeeded and the working tree was clean. This final
verification entry changes documentation only.
