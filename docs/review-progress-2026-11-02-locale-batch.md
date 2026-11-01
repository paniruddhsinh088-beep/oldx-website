# Locale and dependency development batch — 2 November 2026

Branch: `security-hardening-review`. Starting commit: `41d38317c8754e108ecf404d3117d4d797ffeb2b`. The starting documentation-only CI run `41347438275` was verified successful. Existing commits, including `37209fd`, remain unchanged ancestors.

## Completed implementation

- Added separate Gujarati, Hindi and English Service-preview catalogs: 103 keys each, including validation, accessibility labels, placeholders, notices, plurals and named interpolation. A shared module supports explicit allowlisted lazy imports, English/key fallback, safe text-only interpolation and locale-aware number/INR/date formatting.
- Added an always-available native-script language selector to the isolated preview. A local preference stores exactly one of gu/en/hi at oldx.preview.locale.v1. Invalid values, denied/quota-limited storage, missing catalogs and out-of-order async loads are handled safely. No locale is inferred from IP/GPS/browser language.
- Locale switches preserve active view, authored profile/name/description/location text, canonical service selections and independent contact choices. Drafts and contact choices remain memory-only. Focus restoration follows provider identity across rerenders/sort changes.
- Extended the explicit static asset allowlist to include all locale modules and dynamic catalog imports; test helpers still serve only the isolated preview and allowed browser assets. No server/tooling package is copied to the browser bundle.
- Fixed a verified canonical-Unicode search mismatch: precomposed Hindi nukta letters and decomposed accented Latin text did not match equivalent queries. Normalize only temporary comparison strings; original provider records remain unchanged. The new regression failed before the fix and passed afterward.
- Improved mobile navigation wrapping after the stronger real 200% computed-font-size browser test exposed overflow to 329px on a 320px viewport. Kept the test intact and fixed the navigation flex sizing. Added Devanagari alongside Gujarati system font fallbacks; both Noto script families are installed in this development environment. No font API/download was introduced.
- Added scoped development dependency overrides: gaxios@6.7.1 → uuid@11.1.1 and @google-cloud/pubsub → @opentelemetry/core@2.8.0. Verified the exact used multipart and trace-propagation APIs offline through the actual CLI dependency tree. See docs/dependency-advisory-review-2026-11-02.md for the API/major-version rationale and remaining risks.

## Regression evidence

Clean offline `npm ci --ignore-scripts --no-audit --no-fund --offline --cache /workspace/work/npm-cache` succeeded (688 packages). All three workflow YAML files parsed, 157 JavaScript files passed node --check, and git diff --check passed.

All 26 runnable non-emulator scripts passed with zero skips in the complete sweep below. This sweep preceded the final canonical-Unicode regression/fix; the full Service suite then passed again with that extra test. Targeted source/build/browser tests also passed after formatting/font/NFC updates. The four actual Emulator scripts remain under the already documented local download-policy limitation; exact-commit GitHub CI provides separate emulator evidence after pushing.

| Command | Exit | Sweep result |
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
| `npm run test:emulator:guard` | 0 | tests 10; pass 10; fail 0; skipped 0 |
| `npm run test:service-preview` | 0 | tests 8; pass 8; fail 0; skipped 0 |
| `npm run test:service-preview:browser` | 0 | tests 11; pass 11; fail 0; skipped 0 |
| `npm run test:static-build` | 0 | tests 3; pass 3; fail 0; skipped 0 |
| `npm run test:i18n` | 0 | tests 11; pass 11; fail 0; skipped 0 |
| `npm run test:toolchain` | 0 | tests 2; pass 2; fail 0; skipped 0 |

The 11 final browser flows cover existing discovery/profile/onboarding behavior; gu/hi/en switches without content changes; only selected catalogs loading; preference reload/corruption; missing catalog and denied storage fallback; a delayed older catalog losing to the newest choice; identity-based focus restoration; 320/390/768/1280px layouts and actual doubled computed text sizes. Every external browser request is blocked and asserted absent.

Locale unit tests cover exact key/plural/placeholder parity and template references, English fallback grammar, unsupported/prototype/path-like locale input, safe interpolation and storage errors. Two dependency-compatibility tests exercise real multipart preparation and trace propagation with no provider client or cloud network call. Counts overlap across suites and should not be summed as distinct coverage.

## Payload measurements

| Catalog | Raw bytes | Gzip bytes |
| --- | --- | --- |
| en | 5694 | 2104 |
| gu | 9918 | 2683 |
| hi | 10375 | 2773 |

These are local file/compression measurements, not field startup timing. English is the eager fallback; only the selected additional catalog is imported and cached.

## Dependency audit and scope limits

Full audit changed from 16 moderate to **13 moderate, 0 high, 0 critical**. `npm audit --json --fetch-retries=0 --fetch-timeout=20000 --cache /workspace/work/npm-cache` exits 1 because moderate findings remain. Remaining chains need compatible upstream glob/minimatch consumer work; replacing callable minimatch globally or downgrading the Firebase CLI would risk regressions. No force audit-fix or new paid service was used.

Translations are preview copy pending native-speaker terminology/shaping review. No main marketplace/auth localization, private account language sync, full offline app caching, Firebase data reads/writes, provider account setting changes, Rules changes, deployment or billing activation is included. The original application HTML, Firebase configuration and candidate Rules are preserved. vercel.json still disables Git deployments for this review branch.

## Next safe work

Inspect exact-commit CI for this source batch, fix verified failures if any, and record run IDs. Continue the remaining moderate CLI dependency migrations only with consumer API tests. Follow up with native-language review and a main-screen string inventory before broadening localization. Trusted contact/enquiry/review writes, media, migrations, deployment and live runtime remain gated by the existing roadmap.

Runtime-only `npm audit --omit=dev --json --fetch-retries=0 --fetch-timeout=20000 --cache /workspace/work/npm-cache` exited 0 and reported zero vulnerabilities. No full-audit success is claimed while the 13 moderate development findings remain.

## Verified locale source checkpoint: 57bbe99

`57bbe9991fd9f48db96a883e1ced5b57ec80ca0b` was fast-forward pushed only to
security-hardening-review. All three exact-commit workflows succeeded:

| Workflow | Run | Result |
| --- | --- | --- |
| Branch Security Tests | [41350267660](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41350267660) | success, including locale and scoped toolchain tests |
| Service Providers Emulator | [41350267754](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41350267754) | success; 137 Service model/QR tests and 20 actual candidate Rules Emulator tests |
| Review Safety | [41350267738](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41350267738) | success; locale/toolchain/static/browser checks plus actual Firestore baseline (8), Storage (7) and private chat state (10) Emulator tests |

Vercel listed zero deployments for this SHA. This is isolated CI test evidence,
not live Firebase or deployment evidence. The original 37209fd commit remains an
unchanged ancestor; no main ref was pushed.

### Large-text follow-up

A further browser case now checks both discovery and onboarding at 200% actual
computed text size for each of en/hi/gu at 320px. It found two additional English
discovery overflows: the hero grid's unbreakable heading and the search reset row.
Added heading overflow-wrap and search-row flex wrapping. The full browser suite
then passed **12/12**, zero skips, without weakening any assertions. This follow-up
changes only the preview HTML/CSS, its browser test and this record; it triggers a
separate review-safety CI run after push.

The follow-up source was pushed as e112c383fdfbf689fd82e5fc3b2348ee81172dae.
Review-safety run [41350834897](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41350834897)
failed the expanded 200% browser case on the runner's font metrics: the English
results heading/container extended to 341px at a 320px viewport. Added h2 word
wrapping and a min-width/max-width constraint on section-heading content. No
font sizes, test scales, assertions or privacy controls were reduced. The local
full browser suite again passed 12/12; a new exact-commit CI run is required for
the runner-specific correction. Vercel listed zero deployments for e112c38.
