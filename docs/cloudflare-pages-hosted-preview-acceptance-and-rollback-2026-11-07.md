# OLDX Cloudflare Pages — hosted preview acceptance and Vercel rollback checklist

Date: 2026-11-07
Source reviewed: `a2effbfcb84108c67a6e93272c2d8ad8fa8117fe`
Branch: `security-hardening-review`
State: HOLD / NO-GO; **no Cloudflare Pages preview, Git connection, billing, Firebase, IAM or DNS action is authorized by this checklist**.

## Evidence carried forward (not repeated)
- Source-only Pages build `scripts/build-cloudflare-pages.mjs` and test `tests/integration/cloudflare-pages-build.test.mjs` in the reviewed commit.
- Codex reports: 13/13 Node tests, 24/24 loopback Wrangler 4.158.0 HTTP assertions, synthetic Chrome hash-navigation tests at 320px and 375px. A local test report is **not** hosted acceptance.
- `/api` uses a Pages-only 308 redirect to an unavailable API path; `/api/*` is intended to fail closed until an approved Cloud Run backend exists.
- Existing `vercel.json` and Vercel hosting are unchanged; no migration or production switch has happened.

## Approval gate before hosted preview
1. Owner separately approves exactly: *creating a new Cloudflare Pages staging-only project* and *publishing a preview*, with the selected deployment transport. GitHub repository integration may trigger automatic deployments: prefer an explicitly controlled one-time preview mechanism, or require configuration and branch controls reviewed first.
2. Confirm current Cloudflare plan eligibility, any applicable spend/billing requirements, limits, and whether project creation triggers costs or public accessibility. Do not activate R2 or billing as part of Pages preview.
3. Use `oldx-staging` only; obtain staging browser Firebase settings through an approved safe channel. Never put service-account keys, Cloud Run secrets, R2 API tokens or private user data in Pages variables or build artifacts. Do not display values in logs/reviews.
4. Do not modify live `oldxbazar.in` DNS, the Vercel domain, production Firebase, Auth allowed domains or deny-all staging Rules without separate explicit authorization.

## Proposed Pages configuration (only after approval)
- Build: `node scripts/generate-firebase-env.js && node scripts/build-cloudflare-pages.mjs`
- Output: `public`; root: repository root; Node runtime compatible with project `>=24.12.0` and selected Pages builder.
- Staging Firebase project must be `oldx-staging`; both generated config and Pages build should reject mixed or production config.
- Preview must not be indexed: confirm actual `X-Robots-Tag: noindex` on the hosted preview or a supported provider-level protection mechanism; document hosted response headers. An HTML robots meta alone is not a substitute for protected private data.
- No Cloud Run/API route or Pages Function is configured by default; reject requests for `/api`, `/api/`, nested `/api/*`, encoded path variants and unauthorized methods.

## Hosted acceptance matrix (record URL, timestamp, status, header subset and evidence)
- API: GET/HEAD/POST/OPTIONS/PUT on `/api`, `/api/`, `/api/staging/marketplace/owner`, encoded variants. No homepage 200, auth bypass, private bytes, success-shaped JSON or credentialed permissive CORS. Check redirect caching, `Cache-Control`, `Location`, status and body; record observed response rather than assuming Wrangler parity.
- Frontend: `/`, `/index.html`, actual Product/Store/Provider/Chat direct hash links and named static .html entrypoints; reload, back/forward and relative JS/CSS assets; absent static asset must not return sensitive content.
- Firebase: verify loaded `firebase-env.js` reports staging ID only, no production config; validate signed-out/denied states with synthetic accounts only after separately approved Auth domain/test identity setup. No real user data access.
- Security: inspect actual headers (CSP, frame, nosniff, referrer, permissions, cache), no secret/private/server files, inspect browser console for blocked assets and external CDN dependencies; do not loosen policy merely to make preview appear functional.
- UX: desktop and physical mobile or device emulation, 320/375px and 200% text, Gujarati/Hindi/English, navigation, keyboard and accessibility, later Capacitor parity. Report missing features rather than claiming synthetic shells are live features.
- Performance: capture baseline requests/bytes and core loading metrics on representative mobile network; compare with currently working Vercel snapshot without changing production.
- Acceptance: record all failures, owner reviewer decision and a tested rollback plan; a hosted preview is not a production cutover.

## Vercel preservation and rollback
- Keep current Vercel project and `oldxbazar.in` routing/DNS unchanged throughout all preview work.
- Record last known working Vercel deployment ID, current DNS records, domain settings and baseline smoke test results **read-only** before any future cutover proposal.
- Preview failures: stop preview testing, retain the Vercel endpoint, disable only newly approved preview resources if safe and authorized; no DNS or production changes needed.
- Future proposed cutover (separate approval): demonstrate route and feature parity, security acceptance, TTL/propagation assessment, rollback target, data and API consistency, owners and monitoring plan. Never assume DNS rollback is instantaneous.
- No actual rollback, deploy, account setting update, hosted traffic test or live resource change has been performed in creating this checklist.

## Cost-effective next step
Do not spend Codex credits rewriting this checklist. An independent reviewer should inspect the latest source for remaining small gaps; then seek **specific owner approval for an isolated Cloudflare Pages preview**. Cloud Run, R2, Firebase Rules/IAM/billing and production release remain distinct gates. HOLD / NO-GO.
