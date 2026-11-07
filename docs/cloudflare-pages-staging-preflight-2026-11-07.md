# OLDX Cloudflare Pages staging preflight — read-only audit
Date: 2026-11-07
Branch: `security-hardening-review`
Source checkpoint audited: `ea6fff90dd6202b1b66525120ec9ffda148b3fd1`
Status: LOCAL WRANGLER CHECKED / HOSTED PREVIEW NOT APPROVED / HOLD / NO-GO

## Verified source facts
- `vercel.json` currently builds with `node scripts/generate-firebase-env.js && node scripts/build-static-assets.mjs`, output `public`. Vercel deployment from the review branch is disabled. Keep it unchanged during a Pages assessment.
- `scripts/build-static-assets.mjs` packages a strict allowlist of browser files into `public/` and rejects symlinked sources. Existing tests cover transitive module imports and excluding private/server files.
- `scripts/generate-firebase-env.js` requires `OLDX_FIREBASE_ENV=staging` and corresponding `OLDX_FIREBASE_*` browser config values, and verifies `OLDX_FIREBASE_PROJECT_ID=oldx-staging`. When `VERCEL_ENV` is present, Vercel preview/production scopes must match. Do not replace or bypass this guard.
- `firebase-env.js` is generated at build time, not checked into Git; do not use production settings for a staging preview.
- Primary Product/Store/Provider navigation has existing hash-based URL handling and separate HTML entrypoints. No Pages `_redirects`, `_headers`, or Wrangler configuration was found in the audited paths.
- Cloud Run product-owner read is a disabled-by-default local/demo HTTP entrypoint; it is not an approved deployed API.

## Candidate Pages build configuration (NOT applied)
- Git source: existing repository; do not connect without approval because Git integration can auto-deploy.
- Framework preset: None / static.
- Root: repository root.
- Node: use a version compatible with `package.json` (`>=24.12.0`) and verify Pages builder supports the selected runtime.
- Pages build command: `node scripts/generate-firebase-env.js && node scripts/build-cloudflare-pages.mjs`. The Vercel command is unchanged.
- Output directory: `public`.
- Preview environment: only approved `oldx-staging` browser Firebase config; never inject any service-account keys, R2 secret keys, or server credentials into Pages build variables.
- Do NOT attach `oldxbazar.in` or alter Vercel / DNS.

## Required fail-closed checks before any Pages preview
1. Local source/CI tests: `node --test scripts/generate-firebase-env.test.js scripts/build-static-assets.test.mjs`. Confirm missing/wrong project config fails and no private files are emitted.
2. Check entrypoints and direct links for `/`, `/index.html`, `/store-preview.html`, `/service-preview.html` and the other allowlisted HTML pages; exercise refresh, back/forward, gu/hi/en, 320px/375px, and Capacitor-oriented relative asset paths. Hash routes are navigation hints, not authorization.
3. Explicitly deny or safely proxy all `/api/*` paths. An unavailable backend MUST NOT be served `index.html`, an HTML fallback, a cached private response, or a permissive substitute. No same-origin proxy route is approved yet. Test GET/POST, wrong method, CORS, credentials, cache-control and error behavior.
4. Check client-side Firebase environment selection, allowed Auth domains, Content Security Policy, `_headers` choices, external CDN dependencies, preview robots indexing, and absence of private data in frontend assets. Do not weaken existing Firebase staging deny-all rules.
5. Preserve existing Vercel deployment until explicit performance, routing, privacy and rollback evidence and owner approval.
6. Separately price/approve Cloud Run identity/IAM, R2 subscription and photo processor/moderation before provisioning, credentials, billing changes or any staging/live deployment.

## Next action and approval boundary
Review and, when tests are available, implement minimal Pages-specific routing/config source and isolated tests ONLY on `security-hardening-review`, without triggering external deployments. A real Pages project creation, GitHub integration, preview publishing, Cloud Run provisioning, Firebase Rule changes, billing enablement, R2 activation, secrets/IAM and DNS changes each require explicit action-specific owner approval. The original audit was read-only. The local checks below supersede its test status. Keep HOLD/NO-GO.

## Local validation on the review branch

- Source base: `eef2a36`. Ran `node --test tests/integration/cloudflare-pages-build.test.mjs scripts/generate-firebase-env.test.js scripts/build-static-assets.test.mjs`: 13 passed, 0 failed. The Pages test import was corrected and the Pages build now rejects production and mixed project configuration before rebuilding.
- Generated synthetic `oldx-staging` browser config in a temporary source copy and ran the complete Pages build. Served it with Wrangler 4.158.0 using `wrangler pages dev ../public --ip 127.0.0.1 --port 18788` from a separate empty directory. Wrangler reported no Functions. Its optional request-metadata lookup timed out and fell back to placeholder metadata. No Pages project, bindings or deployment were used.
- Original output returned the homepage with HTTP 200 for exactly `GET /api`. Added a Pages-only 308 redirect to a missing path inside the existing API 404 scope. The final output passed 24 loopback HTTP assertions. On `/api`, `/api/`, a nested owner path and an encoded slash path, GET/HEAD ended in 404 and POST/OPTIONS/PUT ended in 405. API GET bodies were generic 404 pages with `no-store`. Non-GET bodies were empty and no credentialed CORS header was returned. Wrangler emitted wildcard CORS locally. Three server-file probes returned no server bytes and the generated config probe identified staging.
- Chrome with external requests blocked passed 10 direct-link checks, 10 reloads, 10 relative config asset checks and 2 Back/Forward pairs at 320px and 375px. Covered Product, Store, Provider discovery, Provider conversation and Product Chat URL shells. These were static navigation checks with synthetic config. Authenticated rendering, native-language UI, mobile-device and Capacitor acceptance remain separate.
- Next batch: prepare a reviewed hosted Pages preview acceptance checklist covering actual routing and headers, staging Auth allowed domains, locale/device behavior and Vercel rollback. Hosted preview remains subject to explicit approval.
