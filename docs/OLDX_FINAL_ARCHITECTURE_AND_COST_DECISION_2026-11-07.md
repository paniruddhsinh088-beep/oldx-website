# OLDX Final Architecture, Cost and Delivery Decision
Date: 2026-11-07
Owner decision: APPROVED DIRECTION AND COST PRINCIPLE
Repository: paniruddhsinh088-beep/oldx-website
Authorized work branch: `security-hardening-review`
Deployment state: HOLD / NO-GO until separate readiness and production approval

## Decision and purpose
The owner approves this target architecture and accepts the costs necessary to implement it, prioritizing a low fixed cost at startup and efficient pay-as-you-go scaling. The former INR 2,000/month target for 5,000 monthly active users is an **optimization goal, not a hard ceiling, a guaranteed quote, or permission to incur unlimited unreviewed spend**. Before enabling a paid provider, upgrading Blaze, creating billable resources, changing billing or committing to recurring charges, present the current price, projected workload cost, budget risk and proposed account/resource configuration for explicit action-specific owner confirmation. Do not infer that this architecture decision authorizes production deployment, IAM/secrets/rules changes or real-user data migration.

## Approved target architecture (subject to acceptance)
- Frontend: preserve current mobile-first OLDX UI and codebase; evaluate Cloudflare Pages static hosting/CDN as target. Retain Vercel until parity, performance, routing, commercial eligibility, and rollback tests succeed.
- Trusted backend: Google Cloud Run as the primary target for server-side authenticated APIs, privileged admin, owner authorization, transactional workflows, rate limits, audits, photo upload authorization and moderation. Assess Cloud Run CPU/memory, scale-to-zero, concurrency, region/latency, IAM and billing with measured staging workloads. Cloudflare Workers may be evaluated for narrow nonprivileged lightweight requests only, not as an unreviewed admin bypass.
- Identity: keep Firebase Authentication; validate ID tokens server-side and enforce role/ownership, revocation and session behavior.
- Database and chat: keep Firestore, including OLDX's own chat. Prefer secure bounded queries, trusted unread summaries, pagination, privacy-safe caches, data minimization and efficient rate limiting. Do not substitute WhatsApp links for OLDX chat.
- Firebase plan: Blaze when technically necessary and explicitly activated by the owner. Blaze has no mandatory flat subscription but usage charges and no universal hard billing cap; free allowances depend on service, bucket/region and current pricing.
- Images: Cloudflare R2 Standard is the primary **candidate** for photo object storage/delivery. Implement a storage-provider abstraction so Firebase Storage can remain an evaluated fallback. R2 is not yet provisioned or approved for live use. Use short-lived scoped upload grants, private quarantine, trusted byte/type/dimension verification, safe re-encoding/EXIF removal, moderation, approved derivatives, public/private authorization separation, revocation, orphan cleanup, per-owner quotas, audit and abuse controls. Browser compression is an optimization, not a trust boundary.
- Android: Capacitor from the shared frontend and API contracts; preserve Android compatibility throughout.
- Domain: retain oldxbazar.in.
- Geography: Gujarat-first; Gujarati/Hindi/English support.

## Non-negotiable product and quality constraints
Preserve agreed Products, seller Stores and shareable storefronts, multi-service Provider profiles/discovery/enquiries/buyer-only reviews, own private Chat, moderation/Admin, photos, saved items, recommendations, maps/location, localization and future Android. Do not drop features to meet a cost target. Do not weaken security, privacy, accessibility, responsiveness, user experience or performance. Favor reuse over rewrites, keep the old behavior until replacements pass regression tests, and avoid unnecessary vendor migrations.

## Cost and capacity gates
- Start with low fixed cost because launch traffic is unknown. Optimize usage-based spend; do not assume 5,000 MAU is within Firestore free quota.
- Use the existing `docs/capacity-5000-mau.md` scenario as a **model, not production telemetry**. It estimates 720k / 1.44M / 2.16M Firestore reads/day at 500 / 1000 / 1500 DAU before further optimization. Recompute using instrumented operations, indexes, retries, region, image processing, egress and provider prices.
- Focus first on chat unread history scans, N+1 product/store/provider reads, redundant auth/eligibility checks and read/write-heavy rate counters, while preserving their security semantics.
- Model 500, 1000, 1500 DAU and photo-heavy scenarios; record p95 latency, errors, costs, privacy/rule enforcement, CPU/memory, storage, egress, and peak concurrency.
- Set budget alerts, usage dashboards, abuse quotas, operational runbooks and rollback; alerts do not impose a universal hard spending cap.
- Compare Firebase Storage versus R2 end-to-end including trusted image processing, private media, requests, retention, CDN and region; choose on measured total cost, not advertised storage-only prices.
- Confirm current official provider pricing, commercial-use terms and India-specific tax/region implications before spend approval.

## Ordered execution plan
1. Audit existing app/API/data paths and preserve baseline tests, UX and feature inventory.
2. Optimize Firestore read/write patterns and chat unread strategy in isolated tests; measure cost regression and security.
3. Make existing disabled/emulator-locked trusted SDK/HTTP adapters Cloud Run-compatible without activating production; review IAM, identity, permissions, audits and transport.
4. Build/test storage-provider abstraction and R2 secure photo flow with synthetic data and approved isolated resources only after separate provider approval.
5. Build Cloudflare Pages preview and verify route parity, mobile/language accessibility, performance and Capacitor compatibility; no cutover.
6. Execute staging integration and 500/1000/1500 DAU capacity/cost tests with approved resources and synthetic/test identities.
7. Publish acceptance evidence, final priced bill-of-materials, rollback plan and owner go/no-go request.
8. Only after explicit production approval: controlled deployment and monitoring; then Android packaging/QA and Play Store submission when ready.

## Safety and ownership
All code work remains on `security-hardening-review`; do not touch `main` or production without a separate explicit approval. No implicit authorization for Firebase Blaze activation, billing, live Rules, credentials, IAM, provider account/bucket creation, production migrations, or deployment. Maintain current HOLD/NO-GO and staging deny-all protections until their separate policy and acceptance gates are met. Existing November 7 website and November 14-19 Android targets are aspirations, not overrides of acceptance requirements.

## Codex / automation handoff
Read this decision alongside `AGENTS.md`, `OLDX_LOW_COST_PLATFORM_RECOMMENDATION.md`, `docs/capacity-5000-mau.md`, and `docs/launch-decision-register-2026-11-07.md`. Treat this document as the latest owner architecture/cost **direction** where older proposals differ, but not as a waiver of safety gates. Work autonomously on the review branch for source-only/isolated tests, checkpoint results and measured costs, preserve all product requirements, and escalate actions involving billing, provider provisioning, staging/live credentials, rules, IAM or deployment for specific owner confirmation.
