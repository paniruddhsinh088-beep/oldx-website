# Store async preview progress — 2 November 2026

## Starting verification

Read AGENTS.md, Store roadmap, security/release-readiness documents and the latest
Store UI progress report. `security-hardening-review` was clean at `910744e`,
equal to the fetched remote. Exact starting-head review-safety CI 41400094365
passed. Preserved 0ab408d, 632fe83, 910744e and all earlier checkpoints. No
concurrent source changes were present, and no completed work was duplicated.

## Coherent source batch

- Added a small DOM-independent request controller with revision gating and
  AbortSignal support. Every new request clears accepted data synchronously.
  Stale success, failure and withdrawal responses are ignored even when a mock
  ignores cancellation. Explicit withdrawal and invalid routes invalidate pending
  reads and remove product/header/card state.
- Added an offline synthetic adapter and labelled normal/delayed/error/invalid/
  withdrawn simulation controls. No real-data adapter, SDK, request, endpoint,
  account resource or backend activation is introduced. Filtering/paging still
  applies to a complete bounded synthetic snapshot, not server pages.
- Added strict public snapshot validation/projection, immutable deep copies,
  bounded records and sanitized errors. Only the allowlisted locale preference
  persists. No request bodies, records or raw errors are logged.
- Reused the existing catalogue model/renderer, locale modules, asset packaging
  and loopback test server. Reviewed Service's existing latest-locale-request
  counter and stale-share-result guard; preserved those working components.
- Added 11 matching Gujarati/Hindi/English keys, accessible busy/status/error
  states, recovery, immediate stale-data removal and conditional focus restoration.
  Locale changes reformat current/loading state without another adapter read.
- Added deterministic promise-controlled browser regressions for rapid filters,
  out-of-order completion, stale pagination, withdrawal, invalid response/failure,
  history and invalid routes. Added all-locale 320px/200%-text transient-state
  checks and exercised visible offline simulation controls.

A retained history-focus regression initially failed when asynchronous loading
moved focus to the catalogue heading rather than the returning result. Fixed the
focus intent separately for history return and paging, preserving the assertion.
A new recovery test also exposed missing error focus after keyboard retry; fixed
it without stealing focus from a user who moved to a query control while waiting.

## Evidence

Final local results, exact source commits and CI are recorded below after review.
No local Firebase Emulator execution is claimed; CI supplies isolated emulator
validation. Local policy/source checks are explicitly separate from Rules tests.

## Boundaries and next safe work

Synthetic preview only. No main changes, deployment, live Firebase reads/rules,
backend, provider accounts, secrets, resources, billing or paid API changes.
D1–D12, real publication/consent, trusted Store resolution, bounded cursor queries,
indexes, Rules/compatibility evidence, cache freshness and revocation policy remain
gated. Native-speaker review remains pending. See the updated inactive
[public-data contract](../features/stores/PUBLIC_DATA_INTEGRATION_CONTRACT.md).

Next safe task: bounded request timeout and cancellation recovery tests, using
injected fake clocks and mock adapters; retain the no-backend boundary.

## Local verification checkpoint

One comprehensive sweep ran all 29 available non-emulator script commands.
28 passed immediately, including Service models 146, Service browser 16,
locale 11, static packaging 3, source/policy safety 78 and Store units 33.
The remaining new Store simulation browser case expected four book fixtures;
inspection confirmed three. Corrected that fixture expectation rather than
changing product data or suppressing the test. No prior test was skipped/weakened.

Final review also required an explicit synthetic per-listing `published` marker;
missing/pending/suspended publication now fails the snapshot closed. The mock
supplies the marker only for authored sample records. Added coverage for withdrawn
listing payloads and product removal between detail reloads. This marker is not
an authorization grant for future real data.

Targeted final reruns passed `test:stores` **33/33**, `test:stores:browser`
**17/17** and `test:stores:preview` **3/3**. All original narrow-screen,
enlarged-text, locale and history assertions remain. Unchanged broad checks were
reused rather than repeated. `git diff --check` passed.

Current dependency audit: `npm audit --omit=dev --json` zero vulnerabilities;
full `npm audit --json` **13 moderate**, zero high/critical. The remaining
Firebase CLI transitive glob/minimatch findings have no verified compatible fix
in this batch; no version, override or lockfile was changed.

## First source commit and continued safety batch

`5ba147859d9ef74484750ae2d2e2b71f4defea54` contains the asynchronous preview,
projection, locales and deterministic race regressions. Pushed normally only to
`security-hardening-review` after fetching/checking remote ancestry.

Continued with bounded timeout recovery: default five-second mock deadline,
strict 1–30,000ms test configuration, cancellation and timer cleanup on terminal
states/replacement. Fake-clock tests exercise stalled reads, late completion,
recovery and cleanup without wall-clock sleeps. A browser-clock test checks safe
error status, no stale cards and keyboard retry.

Also invalidates data on page-hide and requests a fresh sample on persisted
page-show. The deterministic browser test dispatches PageTransitionEvents to
verify handler behavior; actual cache behavior in every browser is not claimed.
No Service rewrite, real adapter or backend activation is involved.

Next safe task after this batch: a synthetic bounded detail-read contract with
independent Store/listing publication revalidation and removed-product handling,
separate from catalogue lookahead. Keep all live integration approval gates.

First exact-source CI passed:
- [Branch security 41403739929](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41403739929).
- [Review safety 41403739904](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41403739904), including Store/Service browser regressions and actual isolated Emulator steps.

Final local related sweep after timeout/cache-lifecycle changes:
`test:stores` **35/35**, `test:stores:browser` **19/19**,
`test:stores:preview` **3/3**, `test:static-build` **3/3**;
`git diff --check` passed. Existing unaffected comprehensive checks were reused.

## Final exact-source verification

`23c226d2822ff448aaa8854f52bb1a95949e8209` contains the bounded timeout and
page-cache lifecycle follow-up. Exact-source
[review-safety CI 41404106240](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41404106240)
completed successfully, including the 35 Store unit tests, 19 Store browser flows,
retained Service/browser/locale/security checks and actual isolated Emulator
steps. These are isolated test results, not deployment or live-data evidence.

Vercel metadata lists zero deployments for both source commits. The review-branch
deployment-disabled setting was verified before pushing. `37209fd`, 0ab408d,
632fe83, 910744e and earlier checkpoints remain unchanged ancestors. Branch-only
normal pushes succeeded; the working tree was clean after the source commits.
This final evidence entry changes documentation only.

Continuation: [independent Store detail contract batch](review-progress-2026-11-02-store-detail-batch.md).
