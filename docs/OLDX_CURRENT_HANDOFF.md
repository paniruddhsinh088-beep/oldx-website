# OLDX — Current Chat Handoff / Start Here

**Snapshot:** 2026-11-13, India time. **Source:** approved operator's screenshots and GitHub review; always distinguish verified cloud evidence from unverified plans. Update this file when a meaningful checkpoint changes. This is the **living current-state index**, not a substitute for historical evidence or owner approval.

## Quick start for a NEW Chat or coding agent

1. Read **this file first**, then [AGENTS.md](../AGENTS.md) and [Cloud Run staging gate](cloud-run-product-owner-read-staging-gate.md) before acting.
2. Current GitHub repository: `yasminparmar087-ops/oldx-website`; **only** `security-hardening-review` is authorized for code/docs work. Keep commits/history, no changes to `main`, Vercel auto-builds, production, DNS or live Firebase Rules.
3. Yasmin Parmar is the intended genuine technical/business owner and sole approval authority for new restricted actions. Previous involvement/history must remain intact. Owner consent for one scoped action does **not** imply consent for another.
4. Prioritize security, mobile-first UI, smooth performance, shared web/Android code, monthly operating target ₹1,000 (₹2,000 budget alert, **not** a spending cap), minimal repeated work and Codex credit use.
5. **Production HOLD / NO-GO**. Firestore staging client Rules are deny-all at last verified checkpoint. Firebase Owner Read is **default-off**. No live Firebase synthetic users or Firestore documents have been created in this Phase B work.

## Verified cloud status and rollback (owner screenshots, 2026-11-13)

- Staging project `oldx-staging`, Firestore `(default)` in Mumbai `asia-south1`. Google billing is now linked and Cloud Run / Artifact Registry APIs were enabled; older AGENTS.md statements that staging was unbilled or Cloud Run API disabled are **dated historical snapshots**, not current truth. Avoid unapproved additional expense.
- Cloud Run service `oldx-owner-read` uses service account `oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com`. **Ingress is `all` but Cloud Run IAM invocation is required** — not internal-network-only.
- Revision `oldx-owner-read-00001-8kr` handles **100% main traffic**, default-off; retained as fallback. Revision `oldx-owner-read-00002-tid`, tag `healthcheck`, handles **0% main traffic**, also default-off. Updated immutable image `asia-south1-docker.pkg.dev/oldx-staging/oldx-staging-images/oldx-owner-read@sha256:def649753dddf65cdfbff45f5556be493f7bf69e8f1e2def033c01596f84882e`.
- Authenticated tagged GET `/health` returned HTTP **200**; authenticated POST `/api/staging/marketplace/owner` HTTP **503**; both unauthenticated tagged requests HTTP **403**. Hosted old `/healthz` 404 previously, precise cause unresolved. These prove the tested private auth/default-off paths, **not effective Firestore IAM** or least-privilege invoker.
- Service account direct project bindings: custom `oldxProductReadAuth` (unconditional `firebaseauth.users.get`) and custom `oldxProductReadFirestore` (conditional `datastore.databases.get`, `datastore.entities.get`, `datastore.entities.create`, `datastore.entities.update`). Condition title `OLDX_Staging_Default_DB_Only`, exact expression `resource.name == "projects/oldx-staging/databases/(default)"`. Owner's latest screenshots confirm both custom roles: **ALPHA**, deleted false, exact permissions, no unexpected/missing permissions. Role is **not pure read-only** due quota-counter writes.
- IAM project audit: **2 direct project bindings** for runtime SA; **0 direct SA-level impersonation policy bindings**; `gcloud projects get-ancestors` lists project only, no parent folder/org. These do not establish all effective grants or successful condition enforcement. Do not claim IAM effective PASS.
- Owner's enabled-API list filtered for `policytroubleshooter.googleapis.com` returned **no result**; do **not** enable it without scoped approval.

## Phase B: code/fixture preparation completed, activation NOT approved

- `docs/phase-b-owner-read-synthetic-acceptance-plan.md` records synthetic identity plan, exact proposed isolated private actor/product schemas, data retention/cleanup approvals needed and forbidden actions.
- `tests/integration/fixtures/phase-b-owner-read-plan.json` + `tests/integration/phase-b-owner-read-fixtures.test.mjs` reuse offline fake `synthetic-seller-a` / `synthetic-buyer-b`. In **Cloud Shell with Node 24 Docker**, user screenshot confirmed **1 passed / 0 failed / 0 skipped** after fast-forward pull through commit `f30d60e82a6e7f5f53686db5ce23ebe1aca28a90`. This is fixture validation **only**, not real Firebase or IAM testing.
- Existing source `scripts/firebase-marketplace-repository.mjs` and `scripts/staging-marketplace-context.mjs` use actor namespace `marketplaceActors_v1`, owner record `marketplacePrivate_v1/product_{id}` and quota namespace `marketplaceRateLimits_v1`. Any actual fixture creation, Firebase Auth user, quota-counter write, cleanup, IAM mutation, enabled revision, and live traffic require **separate explicit Yasmin approval** with exact scope. No passwords/tokens in repo or chat.
- Phase B remains blocked on *effective* per-database IAM evaluation, approved exact synthetic data creation and retention, narrowly scoped invocation identity/caller path, runtime enabled-image/env plan, budget/time cap and authorized rollback. Keep all default-off.

## 2026-11-13 21:41 IST — Firestore metadata verification

Owner-provided Cloud Shell screenshot verifies **read-only** `gcloud firestore databases describe` and `list` on `oldx-staging`. The described database is `projects/oldx-staging/databases/(default)`, `locationId: asia-south1`, `type: FIRESTORE_NATIVE`, `deleteProtectionState: DELETE_PROTECTION_DISABLED`. The list returned only `(default)`; `state` was not populated/displayed in the captured output, so do not assert a particular database state. No document contents accessed, no cloud modifications made. No other database visible at this checkpoint, but this **does not prove** the Firestore IAM Condition's effective permission scope. Delete protection disabled is a separate risk requiring owner approval before any change.

**Next task:** evaluate whether the runtime service account's effective resource-scoped permissions can be assessed without enabling a new API or impersonating the service account. Use existing supported read-only means and report any unsupported/inconclusive result; do not guess PASS. Keep the two Cloud Run revisions, default-off backend, deny-all Rules and production HOLD/NO-GO unchanged.

## The exact NEXT action at snapshot

The prior Firestore metadata command **has now been completed**, with screenshot evidence recorded in the 21:41 IST checkpoint above. Do not ask the operator to repeat it. Continue only with effective IAM condition analysis using already enabled read-only capabilities, or other safe local preparation; do not enable APIs, impersonate identities or create data without separate approval. Do **not** repeat previously passed IAM custom-role listing, direct binding checks, anonymous Cloud Run 403 tests, Node fixture test or image rebuild without a concrete change.

## Links and handoff discipline

- [Cloud Run Phase A evidence and Phase B gates](cloud-run-product-owner-read-staging-gate.md)
- [Phase B synthetic acceptance](phase-b-owner-read-synthetic-acceptance-plan.md)
- [Launch decision register](launch-decision-register-2026-11-07.md)
- [AGENTS.md](../AGENTS.md)
- [OLDX Codex interruption-safe checkpoint](oldx-codex-interruption-safe-checkpoint-policy-2026-11-03.md)

For each verified milestone, update **this living page** with date, exact revision/commit, test evidence, approvals and next action; avoid rewriting old findings. Never disclose credentials, identity tokens or personally identifying user data. A new chat should read this page from GitHub before asking the owner to restate prior OLDX work.
