# Product existing-UI integration — 3 November 2026

Base/remote reviewed: `2249791fc50bfc65017fd108a43585a264fa7098`, authorized
`security-hardening-review` only. AGENTS, full-project review/handoff, launch
register, matrix and P0 Product/media checkpoint read. No concurrent source edits, dependency installation, PR merge or force push.
Before commit, remote added `22ba218b0bfb7ea84d7e4df4b7d21a5202f6f314`
(owner visual-design target only). It was read and fast-forwarded without touching
local source changes. The proposed design remains preserved for the UI roadmap.

## Source delivered

- `features/marketplace/product-integration.mjs`: default-disabled portable Product
  controller using existing bounded-read and Chat text modules. Injected verified
  server ports compose private draft/create/edit/publish/withdraw/archive, bounded
  discovery/pagination/detail, private buyer enquiry, seller inbox and reply.
  Session is only cancellation scope, never authorization. Exact public DTOs reject
  private extras; history is participant/revision scoped and emitted only through
  a private callback, not general state. Same-body/key retries survive uncertain
  outcomes; duplicate writes are blocked. Logout/scope/offline/page exit clear
  stale results; cancelled or delayed operations cannot repaint another account.
- `features/marketplace/product-integration-dom.mjs`: explicit opt-in binding of
  existing index Product wizard, grid/detail, inbox and Chat composer. No auto mount,
  endpoint, global enabling flag, SDK initialization or credential/storage handling.
  Existing form mapper omits contact/IP/GPS/admin/boost claims; approved coarse
  city/state only. Injected photo-reference preparation is mandatory; publish does
  not silently drop required photos. Pending photo preparation is rejected after
  account/navigation scope change. Legacy contact/voice/media actions cannot fall
  through from the mounted private Chat/detail. Legacy mode is untouched when off.
- `index.html`: hidden trusted controls, accessible live recovery status, next page,
  private enquiry and safe mobile controls. Verified legacy decimal price submit
  blocker fixed with 0.01 step and bounded nonnegative values. Public price/title/
  description use text DOM APIs. Existing local image preview is reused, not replaced.
- `features/i18n/*`: matching gu/hi/en Product action/recovery strings; existing
  locale binding emits a locale event so mounted dynamic states follow switching.
  Authored descriptions/messages and credentials are never translated.
- Static browser allowlist includes only portable feature modules, not server SDKs.
  No Capacitor/native packaging or Node/browser cross-import is introduced.

## Isolated acceptance and limitations

Actual existing markup is extracted into loopback-only browser fixtures (not a new
page). Injected SDK repositories and private HTTP composition exercise draft save,
edit, publish, discovery/detail, real file selection/local preview, enquiry, seller
inbox/reply at 320/375/768/1280px, gu/hi/en, 200% text, keyboard focus/narrow viewport,
back-event cleanup, offline clearing and unknown-outcome retry. A delayed private
form result cannot be submitted after an account switch. Synthetic verified sessions
are injected; no real Firebase Login, user data, endpoint or staging acceptance is
claimed. Browser CSS fixtures do not establish full deployed CSS/device acceptance.

Search is bounded filtering of the loaded curated page, not a completed global
full-text index. Public Product DTOs deliberately exclude private gallery data;
real moderated byte delivery and public media rendering remain separate P0 gates.
Current-session owner editing works; owner-private bootstrap after page reload and
complete history/deep-link restoration remain follow-up. Private inbox remains a
bounded first window. Chat deletion/receipts/review eligibility are not completed
by this controller. Hidden/inactive preparation does not complete the whole launch.

## Service concurrency diagnosis boundary

The previous failed CI only recorded a missing replay outcome, without response
codes, so its exact historical exception cannot be proven from that log. Existing
SDK callbacks ran concurrently without synchronizing their first staged-write
snapshots. New test-only `transaction-barrier.mjs` forces both first write callbacks
to finish before either commit; retry callbacks pass through. There is no sleep,
blind timeout increase, swallowed failure, new application retry or relaxed
created/replayed assertion. Sanitized status/code diagnostics were added. Ten pure
barrier repetitions and three independently namespaced full actual-SDK enquiry
scenarios are added, alongside the original case. Exact-source CI establishes the
new evidence; it must not be reported as proof of the old failure's exact cause.

## Validation and release gates

Focused Product model/browser cases passed before the coherent broad sweep.
Full sweep and exact-source CI evidence follow below. Official local Emulator
binary downloads remain blocked; no bypass/mirror/live project was used.

HOLD/NO-GO remains. Owner must separately approve operational runtime/commercial
eligibility, concrete schema/compatibility, verified Auth/eligibility/block bootstrap,
retention/privacy, same-origin transport/rate enforcement, Rules/index candidates,
photo provider/scanner/moderation/quota plan and staging deployment/acceptance.
No Firebase/Cloudinary, Rules/index, IAM/secrets, billing, Vercel, migration, main,
merge, paid service or live/staging resource action occurred. Website November 7
and conditional Android November 14–19 remain targets, not guaranteed dates.

## Local final regression

All 34 non-runtime-Emulator package test scripts passed: **867 test executions**,
zero failures. Product browser cases **6**, combined Service/browser command **35**,
private transaction integration **90**, Admin **115**, Service modules **196**,
Store **81** plus Store browser **28**, source safety **83**, i18n **11**, static
build **3**. Logs: `/workspace/work/product-ui-integration-regression/`; runner:
`/tmp/oldx-ui-regression.cjs`. Focused failures during development were fixed,
including decimal price validity. The older browser process was stopped after
that failure because its loaded source could not include the fix; corrected
focused and full sweeps passed. No failing assertion was skipped or weakened.
