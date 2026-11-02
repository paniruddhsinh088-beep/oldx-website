# Isolated first-launch language sample — 2 November 2026

## Scope and starting checkpoint

Started from the verified `security-hardening-review` head
`6f709b994ff6f74cf52a51360df741c3db1457ba`.
Read `AGENTS.md`, the feature matrix, the Service/Chat roadmaps, the
multilingual plan, i18n implementation/tests and static build allowlist.
Created an isolated feature branch to avoid overwriting ongoing Codex
buyer-enquiry work. **No merge or deployment was performed.**

## Implemented

- `features/i18n/first-launch.mjs`: reusable first-launch selection flow.
  It recognizes only gu/en/hi, distinguishes first visit from an existing
  valid local preference, loads the selected catalog before saving,
  preserves an in-memory choice when storage is denied, and rejects
  stale async results or invalid/malformed translations.
- `language-preview.html`: standalone mobile-first language chooser
  with native-script radio labels, keyboard-accessible controls, a
  visible sample-only notice, live status, local-only choice, change
  language and returning-visitor restore. It is **not wired to real
  authentication, account preferences or the main marketplace**.
- Added matching gu/en/hi first-launch copy to existing catalogs and
  kept text-only DOM rendering.
- Updated the static asset allowlist, its test, i18n README and
  full-product feature matrix. No new dependency, cloud service,
  contact data, private account data or Firebase API is used.

## Verification

Executed locally using available Node 22:
- `node --test features/i18n/first-launch.test.mjs`: **8/8 passed**,
  covering first visit, valid/corrupt stored locale, forged input,
  storage denial, unavailable/mismatched catalog, race and cancellation,
  and no-write restore.
- `node --check` on the model, test and extracted page module script:
  **passed**.

Attempted a Chromium smoke test at 320px, but the local browser
environment rejected both loopback HTTP and file URLs with
`ERR_BLOCKED_BY_ADMINISTRATOR`. **No local browser pass is claimed.**
The full repo was not available locally because GitHub DNS was blocked;
the full existing `test:i18n` and `test:static-build` suites must be
validated in GitHub Actions on the exact PR source.

## Outstanding gates

This is an isolated sample, not first-launch integration in the live
OLDX website. Whole-app/authentication/settings wiring, private
cross-device preference synchronization, native-language review,
Android device testing, release and Firebase approval gates remain
unchanged. Staging deny-all, `main` and production are untouched.

Next safe task: after review and exact-source CI, integrate the
reusable language-selection model into a separately approved,
reversible pre-auth navigation design; do not activate backend sync.
