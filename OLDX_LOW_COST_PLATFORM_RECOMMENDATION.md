# OLDX Low-Cost Platform Recommendation (Decision Proposal)

Reviewed: 2026-11-01  
Branch: `security-hardening-review`  
Status: recommended architecture only. This document does not authorize account creation, billing, resource provisioning, secret creation, IAM changes, Firebase Rules changes, data access/migration or deployment.

## Owner's priorities

1. Keep incremental monthly cost at or near zero during early growth.
2. Keep the app fast and smooth on mobile networks and lower-end Android devices.
3. Protect user data, uploads, chats and admin operations.
4. Avoid architecture lock-in and allow future feature changes.
5. Scale only when measured usage justifies it.

No provider can guarantee zero cost, zero downtime or unlimited free capacity. Free-tier limits can cause requests to fail when exceeded. We should fail safely rather than silently bypass security.

## Recommended direction

### A. Frontend: keep the current Vercel hosting for now

- Do not migrate the existing website just to chase a free tier; migration creates regression and downtime risk.
- Continue static asset caching, compression, lazy-loaded images and small JavaScript bundles.
- Confirm the current Vercel account plan and commercial-use eligibility before treating it as a production assumption. Vercel's published pricing describes Hobby as for personal, non-commercial use; Pro is currently listed at USD $20/month before taxes. Do not upgrade without owner approval.
- Do not add Vercel Blob for images in this phase; R2 is the lower-cost candidate for large public image delivery.

### B. Future lightweight API: Cloudflare Workers Free as a narrow pilot candidate — not the privileged Admin backend

The follow-up compatibility review in `CLOUDFLARE_WORKERS_FIREBASE_COMPATIBILITY_REVIEW.md` narrows this recommendation. Workers Free may be evaluated for small user-scoped API requests, but it is not approved as the privileged Admin backend. A Worker forwarding a verified Firebase ID token to Firestore REST remains subject to Firestore Security Rules; a service-account OAuth token bypasses Rules and relies on IAM. Do not add a service-account private key as a shortcut.

Why it is a promising initial cost candidate:
- Published Free plan: 100,000 requests/day across Workers, 10 ms CPU per invocation, with no duration charge.
- Global execution network and no general cold-start delay, useful for short authentication/authorization and upload-grant requests.
- Static assets are free and unlimited under the Workers pricing documentation.
- If the app grows beyond the free request/CPU ceiling, stop and review measured usage before enabling a paid plan. The published Workers Paid plan has a USD $5/month minimum plus usage pricing; no automatic upgrade is approved.

Important limits:
- Free Worker CPU is only 10 ms per request. It is suitable for short control-plane tasks, not decoding/re-encoding large images.
- Free plan limits are hard limits; over-limit requests can fail. User-facing errors should be clear and retryable.
- Keep heavy image processing outside the request path; use an approved managed image transformation service or a separately costed asynchronous processor only after testing and approval.
- Worker must verify Firebase ID tokens (including RS256 signature, exp, iat, aud, iss, sub and auth_time), derive UID only from verified claims, and forward the user's original ID token for user-scoped Firestore REST calls so Rules remain in force. Never trust a browser-supplied UID.
- Keep the current deny-all Staging Rules in place until a separate collection-specific rules plan is approved. The Worker must not bypass them.
- Do not put a service-account private key in the Worker as a shortcut. Privileged Admin operations requiring IAM/Admin SDK access need a separate managed-runtime or workload-identity design, dedicated staging identity and explicit owner approval.
- Benchmark JWT verification CPU time, Firestore REST transaction behavior, region/latency and emulator/integration coverage before implementation. If the design cannot be safely proven within Free limits, do not force this architecture.

### C. Image storage: Cloudflare R2 Standard as the leading pilot candidate

Published Standard free allowance:
- 10 GB-month storage.
- 1 million Class A operations/month.
- 10 million Class B operations/month.
- Internet egress free.
- Above the allowance, published Standard rates include USD $0.015/GB-month, $4.50/million Class A and $0.36/million Class B operations.

Security shape:
- Private bucket by default; no public bucket-wide write access.
- Worker authorizes a single object upload only after authentication, parent ownership and atomic quota reservation.
- Upload to private quarantine; validate actual bytes and decoded image, normalize/re-encode, strip EXIF/GPS, and publish only approved derivatives.
- Product images may become publicly readable only after listing publication and moderation. Chat/profile images stay private and participant/owner-authorized.
- Never store base64 image bytes in Firestore documents.
- No direct account-wide R2 token in browser code.

Caution:
- R2 does not perform trusted image decoding/re-encoding by itself. A safe processor and lifecycle/cleanup path are still required.
- Free R2 quota is not an abuse-control mechanism. Enforce per-user quotas, rate limits, storage retention and cost alerts.
- Do not assume the free quota will cover actual usage; measure upload bytes, image views and operations.

### D. Keep Firebase Auth and Firestore as the current identity/data system

- Avoid migrating users or listing data to a second database.
- Keep Staging Firestore rules deny-all until collection-specific rules, migration tests and approval are ready.
- Use a trusted server boundary for privileged operations. The existing browser Admin UI stays disconnected.
- Do not enable Firebase Storage merely because it is integrated with Firebase: the user's console showed an upgrade requirement and the current cost/billing choice is not approved.
- Firebase Cloud Functions/Storage Blaze may be a simpler same-vendor alternative, but requires billing-enabled plan and may incur costs. It is not the first recommendation under a strict near-zero-incremental-cost priority.

## Cost and performance safeguards

- No paid service or plan without explicit owner approval.
- Set hard spending limits/alerts where the provider supports them; if no hard cap exists, use quotas and a manual kill switch.
- Start with synthetic tests and measured staging traffic only.
- Cache public, approved image derivatives at the edge with immutable versioned URLs; avoid caching private chat/profile media publicly.
- Use responsive sizes (thumbnail/list/detail), modern WebP/AVIF where supported, lazy loading, width/height to avoid layout shift, and avoid loading full-resolution originals into listing grids.
- Paginate listings and avoid N+1 Firestore reads; use field projection and bounded queries.
- Avoid polling for chat/online status; use bounded realtime subscriptions only where needed.
- Track Core Web Vitals, image transfer size, API latency, error rate and per-user storage usage.
- Fail closed on quota/auth/provider errors. Do not fall back to public uploads or direct client writes.

## Proposed image UX defaults (still pending approval)

Keep the current draft in `IMAGE_UPLOAD_POLICY_PROPOSAL_V1.md` as a starting point only:
- Product: up to 6 images, 5 MiB each.
- Store: 1 image, 5 MiB.
- Profile: 1 image, 2 MiB.
- Chat: 1 image, 3 MiB.

Use client-side resize/compression for speed and reduced mobile data, but repeat all validation on the trusted backend. Consider lowering upload caps after observing real user devices and network conditions.

## Rollout stages

1. **Now — no-cost source-only work:** finish policy models, tests, architecture notes, bundle/image performance audit and staging safety checks. No provider resources.
2. **Decision checkpoint:** verify Vercel plan eligibility, confirm Cloudflare account/terms, choose region, set monthly budget, retention and final image limits. Owner approves in writing.
3. **Synthetic pilot:** only after approval, create isolated staging resources and test with synthetic images; no real user content. Keep Production untouched.
4. **Staging integration:** dedicated staging-only identity, verified Firebase auth, atomic Firestore quota ledger, private R2 quarantine, validation/derivatives, monitoring and rollback.
5. **Production proposal:** separate security review, cost estimate, owner approval and explicit deployment plan. No automatic promotion from Staging.

## Current recommendation register

| Area | Recommended option | Why | Gate |
|---|---|---|---|
| Existing frontend | Keep current Vercel hosting | Avoid disruptive migration; use CDN/static optimization already in place | Verify plan and commercial eligibility |
| New lightweight API | Cloudflare Workers Free, narrow user-scoped pilot only | Low entry cost; short requests may fit free limits | Verify Firebase token claims, Rules-preserving REST access and CPU budget; not privileged Admin backend |
| Image object storage | Cloudflare R2 Standard | 10 GB free allowance and free internet egress | Private bucket, processing, quotas, cost controls; owner approval |
| Identity | Existing Firebase Auth | Avoid user migration | Verify ID tokens server-side; never trust client UID/role |
| Marketplace data | Existing Firestore | Avoid duplicate database and migration | Keep deny-all until rules/audit ready |
| Heavy image processing | Defer; evaluate managed transformations separately | Avoid CPU-heavy work in 10 ms Worker | Measure costs and approve |
| Privileged Admin backend | Defer; later compare Cloud Functions/Cloud Run with a safe Worker federation design | Service-account access bypasses Firestore Rules and needs IAM | Do not implement until platform, billing, identity and owner approval are explicit |
| Firebase Storage/Cloud Functions Blaze | Not first choice for image storage; managed Google runtime may be appropriate for privileged Admin work | Billing-enabled plan creates cost risk | Revisit only after security and cost comparison |

## Official pricing and limits reviewed

- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Vercel pricing and plan purpose: https://vercel.com/pricing
- Firebase pricing: https://firebase.google.com/pricing

Prices and quotas were checked on 2026-11-01 and can change. USD amounts exclude taxes, currency conversion and payment fees. No exact monthly OLDX bill can be estimated without traffic, retention and image-view assumptions.

## Explicit non-actions

This recommendation does not:
- create a Cloudflare account, Worker, R2 bucket, token or secret;
- enable billing or upgrade Vercel/Firebase/Cloudflare plans;
- alter Firebase projects, rules, IAM, users, data or Storage;
- change upload behavior or migrate image data;
- deploy or modify Production, `main` or `oldxbazar.in`.

Current Staging Firestore rules remain deny-all. Work stays on `security-hardening-review`.
