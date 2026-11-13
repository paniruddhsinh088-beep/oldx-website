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

## 2026-11-13 — Effective IAM condition interpretation

Reviewed current official Google Cloud Firestore documentation: [Native database access conditions](https://docs.cloud.google.com/firestore/native/docs/manage-databases) and [Firestore IAM](https://firebase.google.com/docs/firestore/security/iam). The verified staging project IAM expression `resource.name == "projects/oldx-staging/databases/(default)"` is consistent with the documented per-database conditional binding shape. **This is syntax/configuration-level assurance, not proof of effective runtime enforcement**. Google documents that Console database listing does not honor per-database IAM conditions; API/SDK evaluation differs. The last owner screenshot of `gcloud firestore databases list` used Yasmin's own user identity, not the runtime service account. The only database listed was `(default)`, so there is no second existing staging database available for a direct negative live probe without provisioning a new database (not approved). Policy Troubleshooter API was not found in enabled services; no permission to enable it or assume valid effective results. A `testIamPermissions` call from Yasmin's owner identity would similarly measure **Yasmin**, not the Cloud Run runtime SA, and is not an effective proof for that SA. **Status = CONFIGURATION REVIEW PASS; EFFECTIVE RUNTIME IAM PENDING.**

**Next safe gate:** separately approved bounded runtime test using the existing Cloud Run SA and the already planned synthetic, isolated Firestore fixtures, with exact read/write permissions, identity/token path, cleanup and rollback approved in advance. Do not attempt service-account impersonation, new IAM roles, enabling APIs, adding databases or any Firestore document operation under present approval. Preserve Phase A traffic and default-off state.

## 2026-11-13 — Phase B cloud-data approval packet prepared

The existing `docs/phase-b-owner-read-synthetic-acceptance-plan.md` now includes a specific future owner-decision section: propose two synthetic Firebase Auth identities, one actor document and one private product document with exact staging paths, no legacy/public writes, maximum 24h retention subject to explicit per-ID cleanup permission, and a secure real Firebase test-token provisioning method still to be identified. **Only documentation was updated; no approval to create users/documents or to activate Cloud Run has been granted.** The next authorization sought is narrowly scoped fixture preparation/provisioning, *not* IAM changes, owner-read activation, ingress change or traffic promotion. Stop before any writes if path collisions, permissions or cleanup are uncertain. Consult this packet rather than redoing previously completed Phase A and Node24 fixture work.

## 2026-11-13 — Owner approved Phase B procedure preparation

Yasmin explicitly approved preparation of the safe two-synthetic-Auth-user and two-private-Firestore-document procedure. **This is preparation-only approval, not authorization to create or delete resources or to activate enabled Cloud Run.** Updated `docs/phase-b-owner-read-synthetic-acceptance-plan.md` with a guarded Gate 0–5 sequence: exact staging project/database and identity validation, exact UID/document collision checks, create-only semantics, required approved token-provisioning path, bounded retention (proposed ≤24h), separate per-ID cleanup approval, strict stop criteria and no broad scans or edits. The four proposed entries are Auth `synthetic-seller-a`, Auth `synthetic-buyer-b`, actor `marketplaceActors_v1/synthetic-seller-a` and private record `marketplacePrivate_v1/product_synthetic-phase-b-read-01`. No actual users, records or rate counters created. Existing service-account IAM condition effectiveness and dedicated least-privilege invoker remain open; do not present plans as verified operational readiness.

**Next owner action:** review the documented execution scope and approve a separately produced exact-target create/verify/cleanup script **before running any cloud writes**; resolve real Firebase test token acquisition and cleanup permissions first. Until then, perform only local/source work. Keep Phase A disabled Cloud Run revisions/traffic unchanged and production HOLD/NO-GO.

## 2026-11-13 — Phase B offline preflight script prepared

Yasmin's approval remains **procedure preparation only**, not cloud creation/deletion or activation. A strictly local guard now exists at `scripts/phase-b-offline-fixture-preflight.mjs`, with new assertions at `tests/integration/phase-b-offline-fixture-preflight.test.mjs`. It reads the previously approved local fixture manifest, rejects wrong project/database, changed synthetic users/documents or false implied approval, and outputs a review-only action checklist. It **does not import Firebase, use a credential or call any cloud API**, and only accepts `--dry-run`. New targeted tests **have not yet been executed/verified**.

**Immediate safe next step:** In the existing Cloud Shell checkout `~/oldx-staging-build`, fast-forward pull `security-hardening-review`, run `node scripts/phase-b-offline-fixture-preflight.mjs --dry-run` plus `node --test tests/integration/phase-b-offline-fixture-preflight.test.mjs` inside already available Node 24 Docker container (read-only bind). Record the results here, not a new broad rerun. Do not run any Firebase Auth/Firestore operation; real-world identity acquisition and exact-ID cleanup approvals remain blocking. Existing `oldx-owner-read` revisions/traffic and production HOLD/NO-GO unchanged.

## 2026-11-13 21:54 IST — Phase B offline preflight executed

Owner-provided Cloud Shell screenshot: after pulling `security-hardening-review`, `scripts/phase-b-offline-fixture-preflight.mjs --dry-run` printed `phase: B`, `mode: LOCAL_PLAN_ONLY`, `project: oldx-staging`, `database: (default)`, synthetic identities `synthetic-seller-a` / `synthetic-buyer-b`, actor path `marketplaceActors_v1/synthetic-seller-a`, product path `marketplacePrivate_v1/product_synthetic-phase-b-read-01`, `cloudOperationsPerformed: 0`, and `currentPermission: PREPARATION_ONLY`. Focused Node 24 Docker test `tests/integration/phase-b-offline-fixture-preflight.test.mjs`: **3 tests, 3 passed, 0 failed, 0 skipped**. Evidence is the operator screenshot, **not** a Firebase/Auth live test. Neither IAM condition enforcement nor actual data creation/token acquisition was proven.

**Next:** design and review a secure source-only approach for obtaining authentic test Firebase ID tokens and a narrowly scoped identity/fixture cleanup procedure; verify required permissions before asking for a separate cloud-write execution approval. No Firebase user/document creates, IAM changes, activated Cloud Run revision, new API enablement or traffic routing under existing permission. Do not rerun the 3 passed offline preflight tests without a code change. HOLD / NO-GO.

## 2026-11-13 — Phase B secure test-token and cleanup design

Following owner authorization for **preparation only**, reviewed existing `product-read-server.mjs` and `runtime.mjs`; documented the two distinct credentials needed for Phase B in `docs/phase-b-owner-read-synthetic-acceptance-plan.md`: (a) Google Cloud Run IAM invoker identity token for `X-Serverless-Authorization`, (b) separate Firebase Auth user **ID token** for the `Authorization` header. Recommended (not executed) Firebase Admin create-user with exact synthetic UID, locally generated ephemeral passwords, and existing-provider-only Firebase Auth `signInWithPassword` to obtain genuine Firebase ID tokens with no secrets in repo/chat/logs. The Email/Password provider's enabled state and operator's Auth create/delete permissions are **NOT VERIFIED**; do not switch it on without explicit owner permission. The runtime service account's `firebaseauth.users.get` does not authorize creating/deleting users; do not broaden it.

The plan also now requires exact UID/document collision checks, a creation manifest, a nonsecret test-run marker, update-time-safe Firestore cleanup design, individual cleanup of any known quota-counter paths, <=24h proposed retention, and separately approved exact-ID deletes. No cloud operations, account creation, token issuance, Firebase reads/writes, IAM changes or Cloud Run activation occurred. Phase A default-off state and production HOLD/NO-GO remain.

**Next safe task:** prepare/review a dedicated **read-only source/config preflight** for determining whether staging Email/Password is already enabled and whether the named operator has approved necessary Auth create/delete permissions, without calling Auth user enumerations or creating test data. Then request exact create/delete authorization for the two users and two documents, including cleanup scope, before any cloud writes. Do not rerun passed Node preflight tests.

## The exact NEXT action at snapshot

The prior Firestore metadata command **has now been completed**, with screenshot evidence recorded in the 21:41 IST checkpoint above. Do not ask the operator to repeat it. Continue only with effective IAM condition analysis using already enabled read-only capabilities, or other safe local preparation; do not enable APIs, impersonate identities or create data without separate approval. Do **not** repeat previously passed IAM custom-role listing, direct binding checks, anonymous Cloud Run 403 tests, Node fixture test or image rebuild without a concrete change.

## Links and handoff discipline

- [Cloud Run Phase A evidence and Phase B gates](cloud-run-product-owner-read-staging-gate.md)
- [Phase B synthetic acceptance](phase-b-owner-read-synthetic-acceptance-plan.md)
- [Launch decision register](launch-decision-register-2026-11-07.md)
- [AGENTS.md](../AGENTS.md)
- [OLDX Codex interruption-safe checkpoint](oldx-codex-interruption-safe-checkpoint-policy-2026-11-03.md)

For each verified milestone, update **this living page** with date, exact revision/commit, test evidence, approvals and next action; avoid rewriting old findings. Never disclose credentials, identity tokens or personally identifying user data. A new chat should read this page from GitHub before asking the owner to restate prior OLDX work.
