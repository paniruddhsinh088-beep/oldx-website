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

## Continued development batch — 2 November 2026

Preserved `37209fdc874de321445b9be37647128003614a72` unchanged as an ancestor. Branch verified as `security-hardening-review`; remote was fetched and verified at `15824c632d21adeab3bcd311be242640d098c84c` before new work. No rebase, amend, reset or force push was used.

### Completed work

1. Restored dependency access using the executor network permission, without changing proxy/network policy. All original QR integration tests now pass with qrcode@1.5.4. Added exact development test dependencies, package-lock.json, reproducible npm ci workflows and ignored generated local artifacts. An offline clean npm ci installed 736 packages successfully. Firebase CLI 13.35.1 emits a superstatic Node-24 engine/deprecation warning; local CLI startup succeeds, but emulator behavior remains unverified until binaries can be downloaded.
2. Added a fixed-suite emulator runner that validates known demo projects, expected rule files, exact loopback hosts/ports and absence of Hosting/Functions. Unexpected project environment variables, remote emulator hosts, extra config and unknown CLI arguments fail closed before startup. Root Firebase configuration and candidate rules were not changed.
3. Fixed a verified consent defect: WhatsApp inherited phone-call consent. It now requires separate whatsappConsent and hasPublicWhatsapp flags, defaulting off when absent. Phone-only, WhatsApp-only, blocked, own-profile and guest gates remain covered. This is a pure policy model, not live enforcement.
4. Completed the next safe Service UI slice: modular synthetic fixtures and DOM behavior, shared profile validation, required-field completion, readable field errors, independent contact-choice preview, experience/availability/description preview, availability discovery filter, search reset and keyboard focus restoration. Invalid partial numeric input is rejected even when the browser exposes an empty value. No local draft persistence or live save is added.
5. Fixed a verified packaging defect: the homepage linked to service-preview.html but the old static build omitted it. Added an explicit browser-asset allowlist and tests for its transitive imports, private/server artifact exclusion, stale-output removal, missing config and symlink refusal. This changes build source only; no build was deployed.
6. Added five isolated Chromium browser tests covering the synthetic discovery/profile/onboarding flow, XSS-safe text, phone/WhatsApp choice independence, no persistence, no remote requests, labels/focus and layouts at 320/390/768/1280px. Existing Chromium is used; playwright-core downloads no browser.
7. Inspected existing Vercel Git deployment evidence read-only. Deployment dpl_XwnA35L6zSeZJJCjh6S8bzrCeHkL was a Git-source preview for this review branch at older commit 171024988fe20aeddd73f757621d2b50a9178beb. To honor the no-deploy instruction when pushing, vercel.json now explicitly disables automatic Git deployments only for security-hardening-review. The supported git.deploymentEnabled branch mapping was checked in the published Vercel documentation. No provider account setting was written.

### Latest complete local test batch

All 24 runnable non-emulator scripts passed, zero failures/skips. Totals below are the actual latest runner output; suites overlap (for example, profile migration and preview source tests also run inside safety). Do not sum these as distinct coverage. Earlier history in this document reported file-level summaries from the initial runner; the network-enabled final run reports individual tests.

| Command | Exit | Latest result |
| --- | --- | --- |
| `npm run test:emulator:safety` | 0 | tests 78; pass 78; fail 0; skipped 0 |
| `npm run test:profile-migration` | 0 | tests 11; pass 11; fail 0; skipped 0 |
| `npm run test:admin-backend` | 0 | tests 108; pass 108; fail 0; skipped 0 |
| `npm run test:firebase-config` | 0 | tests 6; pass 6; fail 0; skipped 0 |
| `npm run test:product-migration` | 0 | tests 11; pass 11; fail 0; skipped 0 |
| `npm run test:product-category` | 0 | tests 8; pass 8; fail 0; skipped 0 |
| `npm run test:product-image-classifier` | 0 | tests 9; pass 9; fail 0; skipped 0 |
| `npm run test:image-upload-contract` | 0 | tests 7; pass 7; fail 0; skipped 0 |
| `npm run test:image-lifecycle` | 0 | tests 8; pass 8; fail 0; skipped 0 |
| `npm run test:image-upload-abuse` | 0 | tests 12; pass 12; fail 0; skipped 0 |
| `npm run test:inbox-summary` | 0 | tests 5; pass 5; fail 0; skipped 0 |
| `npm run test:chat-read-receipt` | 0 | tests 5; pass 5; fail 0; skipped 0 |
| `npm run test:chat-message-authorization` | 0 | tests 15; pass 15; fail 0; skipped 0 |
| `npm run test:account-deletion` | 0 | tests 7; pass 7; fail 0; skipped 0 |
| `npm run test:privacy-policy` | 0 | tests 12; pass 12; fail 0; skipped 0 |
| `npm run test:data-requests` | 0 | tests 7; pass 7; fail 0; skipped 0 |
| `npm run test:chat-privacy` | 0 | tests 9; pass 9; fail 0; skipped 0 |
| `npm run test:chat-block-policy` | 0 | tests 12; pass 12; fail 0; skipped 0 |
| `npm run test:chat-private-user-state` | 0 | tests 9; pass 9; fail 0; skipped 0 |
| `npm run test:service-providers` | 0 | tests 136; pass 136; fail 0; skipped 0 |
| `npm run test:emulator:guard` | 0 | tests 9; pass 9; fail 0; skipped 0 |
| `npm run test:service-preview` | 0 | tests 8; pass 8; fail 0; skipped 0 |
| `npm run test:service-preview:browser` | 0 | tests 5; pass 5; fail 0; skipped 0 |
| `npm run test:static-build` | 0 | tests 3; pass 3; fail 0; skipped 0 |

Further targeted safety and static-build checks passed after formatting/source-test updates. All 149 tracked/new JavaScript files passed node --check; all three workflow YAML files parsed successfully; git diff --check passed. npm audit --omit=dev reported zero runtime dependency vulnerabilities. This audit excludes the development toolchain and is not a full dependency/security clearance.

### Remaining external blocker

Firestore startup used demo-oldx-emulator and Storage startup used demo-oldx-storage; both attempted only official Firebase emulator binaries and exited with 403 Domain forbidden from storage.googleapis.com. The baseline command was repeated through the new guarded runner and hit the same policy boundary. Chat and Service Rules suites were not rerun against an unavailable Firestore binary; no runtime Rules success is claimed.

The owner approved HTTPS downloads from storage.googleapis.com only for official Firebase Emulator binaries in this isolated environment. Available cloud-environment tools expose status/diagnostics, not host-policy mutation, so the approval could not be applied here. No network bypass, policy-file edits, alternate mirror, live Firebase read, login, billing or deployment was attempted.

### Review and continuation

The source batch is ready for a normal fast-forward push to security-hardening-review after final diff/branch checks. Preserve 37209fd and never push main. Remote/CI observations will be recorded separately after the push. No PR or merge is needed for this branch-only batch.

Next safe tasks: inspect the exact-commit branch CI results and fix any verified source failures; complete offline language-catalog architecture for gu/en/hi without claiming translation review or changing user content; continue bounded Store/Service public-view work. Trusted runtime, media uploads, live enquiry/review writes, migrations and actual deployments remain under the existing owner approval gates. Release status remains HOLD/NO-GO.

### Push and exact-commit CI follow-up

`37209fd` and source batch `07746c874cc7285e8417b4f2be5d79671fc6f8c7` were pushed by a normal fast-forward to `security-hardening-review`. Remote SHA was verified after the push. Vercel listed zero deployments for that exact commit; the repository-only branch guard is in the pushed tree. No provider settings were changed.

- [Branch Security run 41346585782](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41346585782): success.
- [Review safety run 41346585815](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41346585815): success, including the isolated browser, static build and actual demo-project Firestore, Storage and chat-private-state Emulator steps. This is CI emulator evidence, not deployment evidence.
- [Service emulator run 41346585777](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41346585777): failed before rule assertions. Its fixture callback destructured the firestore method and passed that function to doc(), rather than calling context.firestore(). All 20 tests reported hookFailed with invalid-argument. Corrected the callback without changing or weakening any assertions or candidate rules. A new exact-commit CI run is required to validate this correction.

### Harness correction and development dependency security batch

Pushed `b36154444f470d81ffc76b95cf4ba8b114bbf672`, preserving `37209fd` and `07746c8`. The corrected Service suite passed 20/20 with zero skips in [run 41346766884](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41346766884). [Review safety run 41346766816](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41346766816) also succeeded. Vercel listed zero deployments for b361544.

The full npm audit of the initially pinned legacy test toolchain found 36 advisories (1 critical, 11 high, 24 moderate), all in development dependencies. Upgraded only the development Firebase SDK to 13.1.0, rules-unit-testing to 6.0.0, and Firebase CLI to 15.34.2. Set the private test package's Node requirement to >=24.12.0, and aligned all CI jobs to Node 24. The production browser SDK CDN references and live Firebase configuration are unchanged.

The current Firestore test SDK still pinned vulnerable grpc-js 1.9.16, so added a scoped @firebase/firestore override to patched same-major grpc-js 1.14.7. This affects the development emulator client only. Latest full audit: **0 critical, 0 high, 16 moderate**. The remaining moderate advisories are in CLI-only transitive tooling (including older OpenTelemetry, glob/minimatch and uuid chains). No automatic audit-fix downgrades or breaking global overrides were applied. These residual advisories remain a development-toolchain maintenance task; no claim of a clean full audit is made.

`npm audit --json --fetch-retries=0 --fetch-timeout=20000 --cache /workspace/work/npm-cache` exited 1 because moderate advisories remain; the separate runtime-only audit previously reported zero vulnerabilities. All 24 non-emulator test scripts also passed with the upgraded Firebase stack before the scoped gRPC override; targeted checks and exact-commit emulator CI are required for the final override.

The emulator runner now defaults to a repository-local ignored CLI config/cache and noninteractive CI mode, while preserving explicitly supplied XDG_CONFIG_HOME and FIREBASE_EMULATORS_PATH. This avoids the read-only home/update-notifier failure observed when directly running the new CLI with --version. With CI=true and workspace XDG config, firebase --version reports 15.34.2 successfully. Added a process-boundary test rejecting attempted --project overrides before Firebase can start.

Final local checks for this dependency batch: clean offline npm ci installed 689 packages; npm ls confirms every installed grpc-js is 1.14.7. The new process-boundary test initially encountered the executor's restricted subprocess permission (EPERM); rerunning with the already authorized executor permission passed all 10 guard tests without changing assertions. Targeted Service (136 tests) and static-build (3 tests) checks passed on the final locked tree. New exact-commit emulator CI remains the authoritative check for the changed development gRPC transport.

## Verified source checkpoint: 6c3de7e

All three exact-commit workflows succeeded for `6c3de7ed2f5390fcf03bb58b302895bca64fab9e`:

| Workflow | Run | Result |
| --- | --- | --- |
| OLDX Branch Security Tests | [41347260054](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41347260054) | success |
| Service Providers emulator security tests | [41347260069](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41347260069) | success; Service models/QR 136/136, candidate Rules 20/20, zero skips |
| OLDX review-branch safety tests | [41347260171](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41347260171) | success; includes actual Firestore, Storage and chat-state Emulator suites, five browser flows, build and safety checks |

This validates the upgraded test stack and scoped gRPC override against isolated demo-project emulators in CI. It does not demonstrate deployment, live Rules enforcement, backend readiness or production acceptance. Vercel listed zero deployments for each pushed source SHA: 07746c8, b361544 and 6c3de7e. Branch-only deployment suppression remains present.

The normal fast-forward push preserved the original `37209fd` unchanged. No main ref, existing production application HTML, Firebase configuration or candidate/live Rules file was modified in this batch. No PR merge, provisioning, paid API/service, live Firebase data access, deployment or network-policy bypass was performed. The final documentation checkpoint changes only documentation; the last verified source commit remains 6c3de7e.

### Remaining work / next safe batch

1. Review the remaining 16 moderate CLI-only transitive advisories and assess compatible upstream fixes; keep runtime and development audit scopes distinct.
2. Implement and test the gu/en/hi locale/catalog foundation in the isolated preview; human-reviewed complete translations and global account preference sync remain separate work. Do not translate user-generated content.
3. Continue bounded Store catalogue and public-field projection work under the existing contracts.
4. Local Emulator downloads remain blocked by environment policy despite the owner's narrow approval; the toolset cannot apply host-policy changes. CI Emulator evidence is available as recorded above.
5. Live provider contact/enquiries/reviews, media processing/uploads, migrations, backend provisioning, data retention/deletion and any deployment remain under existing owner gates. Current release decision remains HOLD/NO-GO.

## Locale and dependency continuation batch

The next substantial batch implements review-only gu/hi/en catalogs and language
switching, canonical Unicode search comparisons, large-text navigation recovery,
and scoped development-tool dependency fixes. See
`docs/review-progress-2026-11-02-locale-batch.md` for the latest exact test/audit/CI
evidence. Earlier checkpoints above remain historical results for their named SHAs.
