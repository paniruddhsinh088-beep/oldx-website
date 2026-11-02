# Review progress — preview profiles and Store ordering — 2026-11-02

## Starting evidence and scope

Read AGENTS.md, the previous progress checkpoint, Service vision/roadmap,
independent MVP scope/integration plan, Store roadmap and security/release
readiness audit before changing implementation. Release status remains
**HOLD / NO-GO**; D1–D12/backend approval gates are unresolved.

The authorized branch was safely fast-forwarded to `34c14c6`, preserving another
actor's `9b7580a` isolated Store model and `34c14c6` CI integration. Their exact
head CI runs 41389749064 (safety), 41389749001 (branch) and 41389749022 (Service)
were successful. Existing `37209fd` and all prior review commits remain ancestors.
No existing Store model was recreated or connected to legacy live reads.
Baseline checks: Service 137/137, Store 14/14, preview browser 12/12.

## Completed repository-only work

- Added a strict public Service profile projection with private/trust-field
  exclusion and malformed/sparse multi-service/language validation.
- Integrated synthetic public profiles into the existing preview discovery,
  direct profile links, history navigation and accessible not-found recovery.
  Invalid profiles clear stale data and sharing state.
- Added same-origin preview copy/native share with query-token stripping,
  cancellation without silent copy, manual recovery and stale async-result
  protection. The proposed production profile route/QR helpers remain inactive.
- Added 15 matching locale keys per Gujarati, Hindi and English catalog. Sample
  provider content, drafts, independent consent controls and disabled contact
  actions are preserved. Expanded browser regressions cover sharing and routes.
- Explicit static packaging includes only required pure browser dependencies.
- Added optional strict `availableOnly` filtering before Store pagination and
  allowlisted gu/hi/en numeric price formatting, preserving authored titles and
  numeric sort values. Defaults preserve the prior API behavior.
- Reproduced incorrect Store newest/availability ordering when Firestore
  timestamps differ within a millisecond. Preserved integer milliseconds and
  nanosecond remainder separately; public fields, batch limits, pricing and
  authorization prerequisites are unchanged. Regression failed before the fix
  and passed after it.

Implementation notes: [preview profiles](../features/service-providers/PREVIEW_PROFILES.md),
[Store boundary](../features/stores/README.md).

## Validation

Source commits pushed only to `security-hardening-review`:
- `5ed468f`: synthetic Service profile routes, sharing and public projection.
- `795b921`: Store timestamp precision correction.
- `4dd12d3`: Store availability filtering and locale-aware price labels;
  incremental `npm run test:stores` passed 17/17 after adding two feature tests.

All 26 available non-emulator check commands passed, reporting 534 tests total
(the aggregate includes checks repeated by overlapping scripts). Final
`npm run test:service-preview:browser` passed 16/16, including all previous
mobile/large-text/locale cases. Individual final results:

| Command (`npm run …`) | Passed |
| --- | ---: |
| test:emulator:safety (source/policy checks, not emulators) | 78 |
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
| test:static-build | 3 |
| test:i18n | 11 |
| test:toolchain | 2 |
| test:stores | 15 |
| test:service-preview:browser | 16 |

`git diff --check` passed. Latest `npm audit --omit=dev --json`: zero
vulnerabilities. Full `npm audit --json`: 18 moderate development-tool findings,
zero high/critical, changed from the previous 13-moderate advisory snapshot with
no dependency changes in this batch. Current direct advisory roots are minimatch
GHSA-g3hv-75wg-m249 (<11.0.1) and glob GHSA-3g3m-2fjr-6pw4 (9–14.0.1), with
Firebase CLI transitive propagation. No verified compatible patch is offered
for the pinned CLI; unverified major transitive overrides were not applied.
The CLI is local/CI development tooling, not a runtime browser dependency.

Vercel metadata listed zero deployments for exact source `795b92198ad346938415d6ab99bd8010db2137ed`.
The branch deployment-disabled configuration was verified before the push.
Exact-source `795b921` CI **all passed**:
- [Branch security 41396271157](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41396271157).
- [Review safety 41396271053](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41396271053): browser, Store, locale/static checks and real isolated Firestore baseline, Storage and private-chat-state Emulator steps.
- [Service 41396271106](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41396271106): Service models and real isolated Firestore Rules Emulator step.

The additional `4dd12d3` changes only the isolated Store model/tests/docs; its
17/17 local Store checks passed. Final checkpoint CI is recorded separately.
No local emulator result is claimed: official binary downloads remain blocked
by environment policy. Existing CI provides isolated real Emulator evidence;
new exact-commit CI must be assessed separately.

## Remaining blockers and next safe work

Native-speaker review of Gujarati/Hindi copy remains pending. Preview-only
profiles do not provide production crawler metadata, real contact, account sync,
persistence, uploads or live discovery. Store UI integration requires an approved
public/private product boundary, publication policy, trusted bounded reads,
indexes and compatibility/Rules Emulator tests; legacy products must not be
exposed to a public client and filtered after reading.

Next safe task: add an isolated synthetic Store catalogue view and mobile
coverage using synthetic fixtures, while preserving the approved read-path
gate. Broader app localization and remaining moderate development-tool advisories
remain tracked separately. No deployments, main changes, live Firebase access,
live rule changes, paid services or provider-account changes were performed.

## Final verified checkpoint

Exact combined checkpoint `e2d73b9a4af77eceaafef1152be984b61877bc4d`
passed [review-safety CI 41396444284](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41396444284),
including the 17 Store tests, 16 browser flows and isolated real Emulator steps.
Vercel listed zero deployments for the Service, Store follow-up and documentation
checkpoints. The working tree was clean after the push, and `37209fd` remains an
unchanged ancestor. This final evidence update changes documentation only.

Dependency follow-up: registry metadata confirms the installed Firebase CLI
15.34.2 is current. Its graph uses glob 10.5.0 and minimatch 3/5/6/9; the registry
fix lines glob 14.0.3 and minimatch 11.0.1 are major jumps for those consumers.
Preserve the pinned tooling until a compatible upstream update or separately
verified migration is available. Runtime audit remains zero; do not use a forced
major override merely to suppress the development audit report.


Continuation: [isolated Store catalogue UI batch](review-progress-2026-11-02-store-ui-batch.md).
