# OLDX Phase B — Synthetic Product Owner Read acceptance (approval packet)

**Status: preparation approved; live users/documents, IAM changes, feature activation and traffic are NOT approved.** Source plan only, 2026-11-13. Project `oldx-staging`; Firestore Native `(default)` in `asia-south1`. **Production HOLD / NO-GO.**

## Reuse and isolation

- Reuse existing fake-account identifiers from `tests/firestore-emulator/fixtures.json`: `synthetic-seller-a` (owner) and `synthetic-buyer-b` (foreign reader). They are *names in a local test fixture*, **not existing Firebase Auth users**. The `example.invalid` email addresses are not deliverable accounts. Do not use real existing users.
- Reuse native marketplace namespace constants from `scripts/staging-marketplace-context.mjs`, not legacy `products`, `stores`, or public client collections. The proposal `tests/integration/fixtures/phase-b-owner-read-plan.json` is a **design-only manifest**, not a valid Firestore write payload. `marketplacePrivate_v1/product_synthetic-phase-b-read-01` is a proposed isolated fixture path only; its schema and actor eligibility requirements must be independently validated against the existing trusted repository before any approved live write.
- The sole HTTP route in scope is `POST /api/staging/marketplace/owner`. `save`, `archive`, media, publication, chats, stores and provider endpoints are out of scope. No public Browser Rules edits and no legacy data migrations.

## Preconditions before any real synthetic test

1. Explicit Yasmin owner approval of the **actual** temporary Firebase Auth users, their creation method without passwords/secrets in GitHub/chat, exact document schemas/paths, quota-counter side effects, 24-hour-or-shorter deletion/retention decision and a reversible cleanup procedure. Verify synthetic IDs do not collide with existing records; do not enumerate or inspect existing user data without approval.
2. Independent evidence of effective database-scoped IAM for `oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com`, inherited/group grants, no accidental access to other databases. The project custom role includes `datastore.entities.create` and `datastore.entities.update`; it is *not a pure read role*, because trusted atomic rate-limit counters may write. Treat an IAM condition string as configuration evidence, not runtime enforcement proof.
3. A separately named, least-privilege Cloud Run invoker or an explicitly approved temporary tester identity. Yasmin's project-owner token can demonstrate authentication, not least privilege. Current Cloud Run ingress is `all` with IAM checks (internet-reachable endpoint, not internal-only). Any tighter ingress or new IAM binding requires separate approval and verified caller path.
4. Approve exact activation settings and image digest for a new **0%-main-traffic** revision, 200 attempts / 60 minutes / 1,000 billed instance-seconds stop limits, acceptable logging/Firestore write cost, and explicit rollback. Do not promote the currently disabled 100%-traffic revision. No keys, no credentials or real tokens in files, logs or chat.

## Acceptance matrix (not yet executed)

| Scenario | Expected outcome | Data change permitted |
| --- | --- | --- |
| `/health` on authenticated tagged revision | 200 | None |
| Owner endpoint on disabled tagged revision | 503 | None |
| Valid owner Firebase token + named authorized Google invoker + synthetic private owner record on separately approved enabled revision | 200 with bounded owner-only DTO and `private, no-store` | Only trusted quota-counter writes if explicitly approved |
| Unauthenticated invoker | Google IAM denial, before app | None |
| Missing/invalid/revoked or foreign-project Firebase token | Denied before private record exposure | No private record writes |
| Different synthetic buyer UID reading owner's private product | Denied | No private record writes |
| Wrong project/database/ADC identity or missing rate policy | Fail closed / no runtime activation | None |
| Global or actor quota exhausted | 429 (or documented fail-closed status) | Only separately approved counter operations |
| Public/legacy namespaces and unrelated operation routes | No access | None |
| Rollback | Disabled revision still gives owner 503 | No new private reads |

## Current verified Phase A baseline

- Disabled revision `oldx-owner-read-00001-8kr` has 100% main traffic. Updated disabled revision `oldx-owner-read-00002-tid`, tag `healthcheck`, has 0% main traffic.
- Immutable updated image: `asia-south1-docker.pkg.dev/oldx-staging/oldx-staging-images/oldx-owner-read@sha256:def649753dddf65cdfbff45f5556be493f7bf69e8f1e2def033c01596f84882e`.
- Owner screenshots: authenticated tagged `/health` 200; tagged Owner API 503; anonymous tagged `/health` and Owner API 403. No Firebase Owner Read activated.

## Stop and cleanup

Stop on any unexpected 200, foreign UID acceptance, wrong project/database, unknown data, unapproved write, missing denial, observed spend/usage beyond the trial envelope, or failure to reach disabled revision. Record requests only by status and synthetic case IDs; keep tokens, record contents, PII and raw auth errors out of reports. Verify restoration to default-off before any cleanup. Synthetic user/document creation and deletion **must each be separately approved**; never use broad delete/list cleanup.

**This document and its associated local-only fixture/test are not permission to deploy or access Firebase.**
