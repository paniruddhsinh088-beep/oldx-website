# OLDX — Independent full-project review and handoff (3 November 2026)

## Purpose and evidence
Owner-requested durable review for Codex, ChatGPT and scheduled OLDX automations. Read this with AGENTS.md, docs/launch-decision-register-2026-11-07.md, docs/feature-completion-matrix-2026-11-02.md and docs/review-progress-2026-11-02-processing-release-batch.md. This is a status assessment and priority guide, **not** deployment authorization or evidence of live acceptance.

Review baseline: branch security-hardening-review at 52f9e6d794848a08c01508fddc7f0abd81af043e (documentation), last verified executable source 66d34d891c8dd7ef861d2c207f3cae5d1fbdbe63. Review Safety GitHub Actions 41501908059 succeeded on documentation HEAD; SDK/Rules Emulator 41501193483 and Review Safety 41501193442 succeeded on last source; Branch Security passed on prior feature source b264c38a1d90eb1f9b3fd212bb9a5bc0a1b9dd4e, but was not triggered for the narrow final follow-up. Reported local 34-command sweep, 76 integration cases, 29 browser cases and 28 actual SDK Emulator CI cases are distinct evidence; local tests were not independently rerun for this review.

## Executive assessment
Substantial source, tests and security contracts exist, but source-ready, isolated-test-ready and real-user/staging-ready are not interchangeable. Launch remains **HOLD/NO-GO**. Main remaining challenge is trusted operational integration of complete user journeys, not more synthetic-only contracts. No whole-app staging or production acceptance has been verified. Preserve all approved requirements and legacy functionality.

## Feature-by-feature status and gaps
| Area | Existing source / evidence | Remaining P0 or acceptance gap |
| --- | --- | --- |
| Authentication | Firebase login and revocation-aware/session ports | Approved real identity/runtime, token revocation, logout/cross-account/device acceptance |
| Product browse/post/edit | Legacy listings, search, edit and photo UI; bounded readers and SDK/ownership contracts | Bind secure identity/schema/Rules and curated public/private reads to real UI; actual denied-write and buyer/seller journeys |
| Store | Legacy storefront/catalogue, mobile gu/hi/en previews, sorting, share/QR/card helpers | Trusted public/private split, live-safe read/write, canonical route/OG preview, approved media, device acceptance |
| Service Providers | Multi-service profile, draft/publication, discovery, enquiry/inbox and SDK/Emulator contracts | Approved transport/identity/schema/Rules; complete real UI and public photos, private buyer contact, completion and verified reviews |
| Chat | Legacy 35-message window, ordering regression fix, privacy/block/read/delete contracts, some gu/hi/en labels | Trusted participant-scoped send/block/delete/receipt, attachments, rate limits, retention, private delivery |
| Admin | Server validation/authz models and 115 reported admin tests | Real approved roles/IAM/endpoints, safe reads/mutations, atomic audit and acceptance |
| Photos | Bounded JPEG/PNG/WebP decode/re-encode, EXIF stripping, journal, private quarantine and inactive moderated Product/Store atomic release | Real trusted scanner/proof, safe upload and delivery gateway, provider quota/eligibility, public Provider photo release, private Chat media |
| Languages and accessibility | gu/hi/en infrastructure, essential controls, 320px/enlarged-text regressions | Whole-app/first-launch/profile language wiring, native-speaker and real-device QA |
| Performance | Bounded queries, cancellation, caching and mobile regression tests | Real network/device/end-to-end performance and recovery |
| Android | Web/Capacitor compatibility requirements and roadmap | No native Capacitor project/build; packaging, deep links, permissions, signing, device and Play Store gates remain |

## Security and cost gates
- Keep staging Firestore deny-all until separately authorized changes; never weaken Rules to make UI work.
- Protect verified identity, server-side role checks, strict owner and participant access, curated public DTOs, audit, privacy/retention, abuse and account lifecycle.
- Cloudinary Free is an unapproved **candidate** for public photos, not an activated service. Verify terms, quota, abuse/moderation, real delivery, and eligible server runtime; private Chat media must not use public CDN URLs. Vercel Hobby commercial-use eligibility is unresolved. No payment, provider setup or credentials without owner approval.
- Previous npm audit reported 13 moderate development-toolchain advisories, zero high/critical in that run; reassess before release rather than assume production exposure or certification.
- Emulator and mocked scan/roles do not establish production authorization or real scanner readiness.

## Recommended implementation sequence
1. Decide and obtain separate owner approvals for zero/low-cost trusted runtime, Auth/Firestore identity, operational schemas/Rules/indexes, privacy/retention, photo provider and named synthetic staging.
2. Build and verify **one complete secure vertical slice**: login -> seller Product create/edit -> published public listing -> buyer enquiry -> seller response, including fail-closed cross-account/guest tests.
3. Reuse that proven architecture for Store and Service Provider real UI/data paths; preserve all multi-service, catalogue and sharing requirements.
4. Finish moderated photos and public/private delivery, Chat, Admin and verified buyer review eligibility with real operational enforcement.
5. Complete gu/hi/en, first-launch/profile preferences, mobile accessibility, slow/offline/retry, privacy/security, rollback and approved staging/device acceptance. Keep HOLD if any P0 remains.
6. Only after web gates and separate approval, create/test Capacitor Android build and Play submission flow.

## Schedule and decision gates
Website readiness target **7 November 2026**, conditional on P0 completion, testing and explicit owner go/no-go; not a promise to publish. Android Play Store submission target **14–19 November 2026**, conditional on website readiness and native account/signing/testing approvals; Play review timing is outside project control.

Owner decisions needed: trusted runtime/commercial/free-tier eligibility; operational identity/schema/roles/indexes; privacy, contact disclosure and retention; photo provider/scan/private delivery; separate staging and eventual production authorization. Do not treat this review as approval of any action.

## Autonomous handoff protocol
At each run read AGENTS.md and the latest remote HEAD, source and docs commits, CI, launch register and this review. GitHub is the source of truth. Avoid simultaneous conflicting changes and duplicated completed work. When coding tools/usage unavailable, conduct only permitted review, risk triage and prioritized next-batch planning; do not claim Codex quota detection or automatic reset-triggered execution. When coding is available, prioritize high-impact P0 end-to-end integration, focused tests and clean reviewable commits **only on security-hardening-review**. Record exact verified SHA, executed tests, remaining blockers and next action. No main merges, deployment, provider calls, live/staging Firebase changes, Rules/IAM/secrets/billing, migrations or paid services without explicit owner approval.
