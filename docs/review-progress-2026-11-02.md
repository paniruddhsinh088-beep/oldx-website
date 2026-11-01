# OLDX review progress — 2 November 2026

Branch: `security-hardening-review`. Baseline: `15824c632d21adeab3bcd311be242640d098c84c`.

## Audit and scope

Read AGENTS.md, security implementation roadmap, release readiness, Service roadmap/feature contract, test harness documentation, workflows, and relevant module code/tests. Priorities: reproduce failures; fix existing module defects; run broader policy checks; preserve release gates.

The supplied checkout was an older two-file snapshot. Git fetching failed because the configured proxy was unreachable. The GitHub connector supplied the existing review branch. All 273 file blobs were verified against their Git SHA values; the tree matched `a8202c9feb3c45b21715398f3482a5cec975d4e9`, and the exact unsigned branch-tip commit was reconstructed and hash-verified. Parent history is shallow locally. No main ref was modified.

## Verified issues fixed

- `features/service-providers/service-selections.mjs`: the allowed-character pattern rejected Gujarati/Hindi combining marks, breaking existing service/profile tests. Allow Unicode marks after the initial letter/number, normalize NFC before duplicate detection, and preserve markup/control-character rejection. Added multilingual and canonically equivalent duplicate cases.
- `features/service-providers/provider-qr-encoder.mjs`: an absent encoder export fell through to inherited Object.prototype.toString, causing the existing fail-closed test to fail and masking valid default exports. Require an own encoder export, with CommonJS default support. Added default-export and inherited/invalid-export regression cases.

## Validation

Node v24.19.0. The initial safety suite passed 17/17 files; admin passed 11/11. Initial Service suite passed 29/34 with five failed files: two from the Unicode validator, one from QR export detection, and two requiring the unavailable qrcode package.

After fixes, the targeted command passed 3/3 files (zero skipped):

`node --test features/service-providers/service-selections.test.mjs features/service-providers/provider-profile.test.mjs features/service-providers/provider-qr-encoder.test.mjs`

All non-emulator npm test scripts were attempted. Reported Node totals below are file-level runner totals; they are not assertion counts. Profile migration is also included in the safety suite, so counts overlap.

| Command | Exit | Runner result |
| --- | --- | --- |
| `npm run test:emulator:safety` | 0 | tests 17; pass 17; fail 0; skipped 0 |
| `npm run test:profile-migration` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:admin-backend` | 0 | tests 11; pass 11; fail 0; skipped 0 |
| `npm run test:firebase-config` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:product-migration` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:product-category` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:product-image-classifier` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:image-upload-contract` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:image-lifecycle` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:image-upload-abuse` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:inbox-summary` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:chat-read-receipt` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:chat-message-authorization` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:account-deletion` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:privacy-policy` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:data-requests` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:chat-privacy` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:chat-block-policy` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:chat-private-user-state` | 0 | tests 1; pass 1; fail 0; skipped 0 |
| `npm run test:service-providers` | 1 | tests 34; pass 32; fail 2; skipped 0 |

The Service suite now passes 32/34 files. Only `provider-qr-matrix-integration.test.mjs` and `provider-qr-real-integration.test.mjs` fail, both because qrcode@1.5.4 is not installed. They remain real integration tests; no mocks/skips were substituted.

`npm install --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=10000` failed reaching registry.npmjs.org through the configured proxy (EPERM). No lockfile or dependency changes resulted.

Actual emulator commands attempted: `npm run test:emulator:rules`, `npm run test:storage:rules`, `npm run test:chat-private-user-state:rules`, and `npm run test:service-providers:rules`. Each exited 127: `firebase: not found`. No Rules Emulator evidence was obtained. Policy-model tests do not establish Rules enforcement.

144 JavaScript/module/inline-script syntax checks passed using `node --check` (inline blocks checked as modules). `git diff --check` passed. No browser, live Firebase, or deployed integration tests were performed.

## Boundaries and next safe task

No deployment, rules publication, live data access, migration, billing, credentials, or paid services. Existing deny-all and candidate-rule separation remains unchanged. Release status remains HOLD/NO-GO under SECURITY_AUDIT_AND_RELEASE_READINESS.md.

Next safe task: restore dependency installation through the managed proxy, rerun the complete Service suite with the real qrcode library, then run the isolated demo-project Rules Emulator suites. Continue the existing security roadmap with source-only review while runtime/owner approval gates remain unresolved.

This is a local review batch; no PR, remote push, merge, or CI run is claimed.
