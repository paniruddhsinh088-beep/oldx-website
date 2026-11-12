# OLDX — One consolidated launch execution plan (13 November 2026)

**Purpose:** Review every material workstream and release gate once, then execute the existing approved product/design/architecture with minimum repeated Codex work, fastest responsible path to a secure complete website, then Android via Capacitor. This is an **execution consolidation, not a new architecture, design reset, feature reduction, or cloud approval**.

Repository: `yasminparmar087-ops/oldx-website`; only code-work branch: `security-hardening-review`.
Review baseline: exact branch SHA `557e2505183ac2d7968ae46c98019d9fadaa1cbc`; same-SHA Safety CI **success**, [run 43305668880](https://github.com/yasminparmar087-ops/oldx-website/actions/runs/43305668880). Production: **HOLD / NO-GO**.
Future operational approval authority: Yasmin Parmar; existing historical contributors and commit trails preserved.

## 1. Reuse these binding decisions, do not reopen them

- Source of truth, in order: `AGENTS.md` (safety + ownership); `docs/OLDX_FINAL_ARCHITECTURE_AND_COST_DECISION_2026-11-07.md` (architecture + cost direction); `docs/OLDX_UI_UX_APPROVED_DESIGN_PLAN_2026-11-08.md` (design); `docs/launch-decision-register-2026-11-07.md` and `SECURITY_AUDIT_AND_RELEASE_READINESS.md` (P0 features + security); latest verified account/console evidence in Issues #17/#21/#22 supersedes older **observational** statements, not owner approval boundaries.
- Features cannot be silently dropped: Products, listing/edit/withdrawal, Stores/catalogue/share, multi-service Provider discovery/enquiry, internal Chat, Admin/moderation, mandatory safe photos/media, multilingual gu/hi/en, maps/location, consent/privacy, account deletion, performance, Android code sharing; no fabricated reviews/Featured Ads/notifications.
- Approved visual identity Blue–White–Orange, compact header/categories, products visible promptly, Home/Search/Sell(+)/Chat/Profile, no unnecessary redesign. Featured section stays hidden until trustworthy curated ads; bell stays unavailable until genuine scoped notifications.
- Preferred architecture: reuse frontend; Cloudflare Pages target **after** acceptance, keep Vercel meantime; Firebase Auth + Firestore; private trusted backend candidate Google Cloud Run; R2 Standard photo **candidate** with Firebase Storage adapter fallback; Capacitor later. No forced migration for cosmetic reasons.
- Cost objective: aim ₹1,000/month, preferably within ₹2,000, with upfront owner-priced review, **not a hard cap**; Google free-trial credits don't cover external R2; budgets are alerts not spending ceilings. No new paid resource without action-specific approval.
- Never treat code/model/emulator/old preview as current live staging or production proof.

## 2. Verified current status — avoid duplicated work

| Workstream | Reusable source or evidence | Still missing to be considered operational |
| --- | --- | --- |
| Git/review safety | Yasmin GitHub repository and admin, preserved review branch; HEAD `557e250` CI PASS | Local Codex checkout reported behind remote on Batch L; cleanly fast-forward before editing; no forced push. GitHub previous operator still has write. |
| Product browse & sell | Working legacy UI and source-tested paging, category/search, listing/details, seller write/publish design, mobile product-first improvements | Secure trusted Product DTO/read/write/owner transport wired into actual Website; real staging identities, rules/indexes, update/withdrawal, failures |
| Store | Existing create/catalogue/share UX and isolated published Store projection/ownership tests | Legacy route uses owner UID; canonical trusted Store ID separately allocated; **no trusted Product-to-Store mapping**. Keep Product Detail Open Store hidden until server-published storeId + current matching Store projection + approved transport |
| Providers | Multi-service concepts, provider draft/publication, discovery and enquiry/Chat modules and synthetic browser/emulator checks | Real approved repository/identity/indexes, publication freshness, private send/read transport, mobile and consent acceptance |
| Chat & inbox | Legacy UI + private receipt/participant/block/unread policy, notification outbox and source tests; some per-send reads optimized | Actual secure participant messaging, blocking, revocation, unread, data lifecycle and device test; no fake bell/push |
| Admin/privacy | Admin source validators, audit/RBAC, policy tests, account/export/deletion contracts | Owner-proved server authorization, bounded actual reads/actions, retention, consent, right-to-delete/moderation operational proof |
| Mandatory photos | Photo reference classification, quota/lifecycle/moderation/projection contracts and tests | Provider selection/priced approval, private quarantine, trusted actual byte processing and safe derivatives, delivery/purge/rollback, photos in Product/Store/Provider and relevant Chat |
| UI/i18n | Approved design docs, gu/hi/en components, 320/375 px tests; recent permission/autocontact/visual corrections | Complete actual website (not mock) gu/hi/en, accessibility, keyboard, 200% text, navigation and real-device review |
| Firebase security | Staging (default) deny-all source **visible in Console**, offline exact ruleset checker exists `scripts/check-staging-deny-all-rules.mjs` | Actual deployed Release API metadata + matching ruleset **unknown**; owner declined broad API Explorer OAuth; no widening IAM just to read |
| Backend/Cloud Run | Disabled owner-read slice source, tests, Dockerfile, baseline private invocation/gate and rollback docs | No Cloud Run service/dedicated runtime SA seen at staging; exact least-privilege **database-scoped** IAM, named invoker, audience token plus Firebase token, container image/current CVE/pricing/region; direct synthetic acceptance; Pages→private-Run keyless identity unresolved |
| Billing | Owner-observed `oldx-staging` linked to Yasmin-managed Blaze free trial, approx ₹28,569 trial and ₹2,000 alerts; project access confirmed; zero Cloud Run services at inspection | Recheck current credit/trial, Firestore and Run region, total Cloud Run + Firestore quota write/read + image/R2 + logs/registry/egress/tax, stop plan and expected usage. Alerts no ceiling |
| Hosting and ownership | Yasmin GitHub admin, Vercel dashboard project `oldx-website` Project ID `prj_9KFanf1b89OO0KeuJwrXmXgrJX3A`; custom domain observed; Vercel protection on; review branch `vercel.json` disables deployment | Vercel Git link displays transferred repo label but historical URL; API connector lacks Yasmin workspace access (404 even after attempted authorization); immutable repo ID match unconfirmed; keep current connection unchanged. Former GCP Owner and GitHub Write not removed until dependency/recovery acceptance |
| Android and launch | Website/Capacitor reuse design agreed | Actual packaged Android, deep links/GPS/permissions, signing, privacy/device tests, Play Store review only after website acceptance and separate signoff |

**Recent small corrections:** Notification request no longer automatic (commit `9e91d6c`); homepage GPS auto-request changed to permissions-granted-only (commit `557e250`), with current CI PASS. No source-backed guarantee every detail page never requests GPS. Batch L intentionally had **no commit** because trusted Store mapping was absent. Do not repeat these batches.

**Important contradictions / dated reports:** `AGENTS.md` historical sections say staging Spark/no billing, but newer owner's November 12 signed-in Console and billing checkpoint show staging Blaze linked to trial; treat date-specific observations accurately. Older Vercel documentation mentions original GitHub owner name; do not infer broken integration from a historic transfer hyperlink. Source-only audit documents often describe source-ready but no operational acceptance.

## 3. Critical dependency chain (must be followed in this order)

**A. ONE focused preflight and approval decision, not endless research.** Reuse Issues [#17](https://github.com/yasminparmar087-ops/oldx-website/issues/17) (Cloud Run cost/IAM/private staging), [#21](https://github.com/yasminparmar087-ops/oldx-website/issues/21) (published Rules release proof), and [#22](https://github.com/yasminparmar087-ops/oldx-website/issues/22) (trusted Store link gap), plus existing `docs/cloud-run-product-owner-read-staging-gate.md`. Consolidate exact missing **owner decisions** rather than creating more plans/duplicate checkers. No broad OAuth consent. Until official release metadata is attainable with existing grants and safe scoped access, mark that sub-gate unknown; do NOT quietly bypass it. No production changes.

**B. Separately authorized minimal private *staging* backend.** After owner approves specific account/project, DB, named runtime/deployer/invoker identities and least-privilege grants (must pass DB scope gate), region, itemized pricing, bounds and rollback, prepare isolated private Cloud Run revision **activation off**. This is *not* yet authorization; approvals for IAM/provision/deploy/test are separate. Start with existing Product owner-read slice only and direct named Google invoker; no Pages proxy, public ingress, embedded SA keys or unverified Cloudflare workload assertion. Check container digest, CVEs, secret-free layers, quota, logs and 503 disabled state.

**C. Prove one genuine end-to-end thin vertical slice, then repeat the proven pattern.** With separately approved synthetic/test identities and transport, prove Firebase login+revocation → trusted actor/permission → Product owner read/write/list/publish/withdraw → strictly minimized published buyer read/detail → error/quota/rollback; both positive/negative cross-account cases, privacy-safe logs and metrics. Keep old legacy UI until replacement passes. Do not conflate a 503 health endpoint with an authenticated usable API. Avoid building all features on unvalidated transports.

**D. Expand in launch-blocking order:** (1) Product seller→buyer loop, (2) Store create/publish/discover/catalogue and **server-trusted** linked Product relationship, (3) Provider multi-service publish→discover→enquiry, (4) internal Chat/block/unread/participant privacy, (5) photo byte validation/quarantine/delivery for all required surfaces, (6) Admin/moderation/privacy/account deletion. Interleave essential gu/hi/en and approved design tests on the *real* integrated UI—never defer all visuals to a rewrite. Feature order may overlap where common backend adapters reduce work; all P0 requirements must pass before launch.

**E. Deploy only with exact acceptance and explicit owner approval.** Isolated emulator/browser → private staging IAM/identity+cost+real-device acceptance → staged safe website preview and parity/rollback → production GO decision → single controlled website release. Retain Vercel until Cloudflare Pages parity and cutover safely approved. Then Capacitor Android test/sign/release from shared code. No promised calendar deadline; November 7 website target passed and November 14–19 Android target is not a license to waive readiness.

## 4. Concurrency / credit-saving delivery policy

1. One **ordered master backlog**, not a new methodology every day. Mark each step `DONE-evidence`, `SOURCE-ONLY`, `BLOCKED-owner`, `BLOCKED-provider`, `READY`, `ACTIVE`. No unsupported percentage-complete estimates.
2. Each Codex batch must name **one P0 dependency resolved**, exact reused code, two or three pass/fail acceptance cases, affected paths, max one focused patch, and a simple stop condition. If no trusted data/provider/approval, record blocker and stop without pointless commit. Do not repeat Batch L.
3. Browser/UI/translation improvements only when directly tied to accepted journey or independently reproducible P0 regression, not incidental polishing. Keep accepted Home product-first and five-tab structure intact.
4. Run targeted regression then existing exact-SHA Safety CI; if it fails, prioritize first failure and don't claim PASS. Avoid full suite re-runs outside normal CI if nothing changed.
5. Before a new local batch, non-destructively fast-forward `security-hardening-review` and verify clean tree; preserve `.firebaserc` and history. Never change `main` or automatically deploy.
6. Report per batch: evidence / what actually works in UI vs isolated code, remaining blocker, current review branch SHA, exact CI status, new cost and next action. Stop rechecking Vercel/GCP access screens unless a specific new evidence path or discrepancy warrants it.
7. Maintain 2 parallel lanes **only when independently unblocked**: primary staging identity/private backend integration (owner-gated); secondary truly launch-blocking real website/i18n/mobile regression fixes (source-only). Do not spend entire remaining Codex limit on source-only scaffolding that cannot integrate.
8. Existing 52% limit was user-reported at Batch L time; **not** verified as current. Avoid precise credit/cost/time promises. Save at least a meaningful share for integration failures and final acceptance; no need to invent a quota split.

## 5. Explicit owner decision queue — requests NOT approvals

- Confirm Yasmin's authority for a single **priced minimum staging trial** of named Project/DB/region and max traffic, expected cost and abort procedure; no activation implied by this document.
- Confirm service-account design (deployer / runtime / invoker / tester), exact effective database-scoped IAM and admin-user handover order; retain old-owner access until recovery/dependencies proven and separately authorized.
- Confirm least-privileged path for **published Rules Release GET + exact ruleset** without Google API Explorer's overly broad consent; if unavailable, STOP and retain unknown state.
- Confirm first valid **private Cloud Run Google invoker** test; Pages external keyless identity remains a separate later security design approval.
- Confirm photo provider/cost & moderation/retention/privacy and separate rollback/deletion responsibilities before real uploads.
- Confirm website cutover, usage alerts/thresholds, production migration and Android signing as distinct later release approvals.

## 6. Master acceptance gates

- **Source tests:** Latest HEAD exact-SHA CI pass; no P0 regression, Android-friendly shared modules, gu/hi/en and mobile viewport, accessibility, sanitized data.
- **Security & identity:** denied guest/private access, cross-owner deny, revocation, stale publish/link deny, bounded reads and rate writes, data minimization, no client secrets, scoped database IAM, true deployed Rules evidence, keyless private invoker proof.
- **Product:** real buyer/seller can complete logged-in actions, trust boundaries and persistence, accurate cost/metrics, recovery after errors and account changes.
- **Stores & Services:** valid publish, withdrawal, multi-service discovery, verified relationship, no fake storeId or reviews.
- **Chat & photos:** actual participant-private messages and media, block/read/unread, safe uploads and moderation, byte delivery, purge/revoke, bounded costs.
- **Operations:** tested moderator/admin, retention/export/delete, backups, logs, rollback, observed billing and spend controls.
- **Design/device:** shared web app works gu/hi/en at 320/375px and large text, all bottom routes, Seller/Buyer journeys, real Android-compatible device/browser trials.
- **Release:** independent staging evidence and explicit Yasmin GO. Until every P0 passes, **HOLD/NO-GO**.

## 7. Immediate next move (single next step)

**Do not begin Batch M of random source-only changes.** First use the existing owner gate Issue #17 to identify one **minimal separately approvable staging-only preflight**: exact currently verified database/Rules release evidence, IAM scoped runtime plan, direct invoker and inclusive budget/stop rules, with a single owner decision packet. Concurrently preserve latest CI-passing branch and avoid unnecessary deployment. Once owner approves exact action(s), perform and test the smallest private staging slice before adding further UI transports. If approvals are not yet possible, only fix a demonstrable P0 journey regression already covered by a focused test; don't build duplicates.

**Boundary:** This file records a strategy and verified source/console observations, **not** authorization for any Firebase, Google Cloud, Vercel, Cloudflare, GoDaddy, billing, IAM, secret, deployment, migration, new resource or Production operation.
