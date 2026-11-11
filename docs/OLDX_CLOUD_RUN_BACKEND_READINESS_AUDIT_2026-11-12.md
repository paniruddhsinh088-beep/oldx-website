# OLDX Cloud Run backend readiness — source-only audit

Date: 2026-11-12
Repository: `yasminparmar087-ops/oldx-website`
Branch: `security-hardening-review`
Status: **SOURCE-READY FOR CONTROLLED PRIVATE STAGING PREFLIGHT; LIVE ACTIVATION HOLD / NO-GO**
Scope: owner-read Product API only, not the complete OLDX production backend.

## Method and evidence

Read the current branch's `AGENTS.md`, `docs/OLDX_FINAL_ARCHITECTURE_AND_COST_DECISION_2026-11-07.md`, `docs/cloud-run-product-owner-read-staging-gate.md`, `Dockerfile.product-read`, `functions/staging-marketplace/product-read-server.mjs`, `functions/staging-marketplace/runtime.mjs`, `scripts/staging-marketplace-context.mjs`, `scripts/staging-marketplace-rate.mjs`, `scripts/marketplace-command-http.mjs`, `scripts/verified-operation.mjs`, `package.json`, and existing media comparison. This is a static source inspection. **No tests, builds, Docker runs, Cloud API calls, or live security checks were executed by this audit.** Prior evidence quoted in the existing gate belongs to its own recorded commits.

## Existing assets to reuse

1. `Dockerfile.product-read` provides Node 24 production container, allowlisted source COPY, non-root `USER node`, port 8080 and SIGTERM declaration.
2. `product-read-server.mjs` binds to `0.0.0.0:$PORT` in non-emulator mode, validates port, has `GET /healthz`, enforces exactly `POST /api/staging/marketplace/owner`, rejects duplicate security-relevant headers, parses max 32 KiB JSON, sets private/no-store and drains connections.
3. By default the owner API returns unavailable. Real staging init requires the exact `OLDX_PRODUCT_READ_ACTIVATE_STAGING=true` switch plus `OLDX_PRODUCT_READ_STAGING_ADC=true`, `oldx-staging` project, `(default)` database, named staging service-account address, `K_SERVICE`, rate config, metadata project check and pinned compute ADC checks. Emulator and credential-file override variables are rejected.
4. `runtime.mjs` composes existing marketplace repository, enforcement, atomic-rate quotas and HTTP projection. Only the named owner network route is exposed in this container; save/archive are not registered. `verified-operation.mjs` covers authenticating injected identities, timeouts, cancellation and unknown write outcomes. These are source-level controls; correct live IAM and all edge cases are not yet accepted.
5. `staging-marketplace-rate.mjs` uses Firestore atomic counters with actor and global windows. Owner-read therefore consumes writes as well as reads, even though it is a read API.
6. Existing `docs/cloud-run-product-owner-read-staging-gate.md` already contains a private-only test plan with isolated IAM identities, no Pages proxy in phase one, region/resource sizing proposals, negative tests, rollback and prior local packaging/emulator evidence. Reuse and update this gate rather than writing new architecture.

## Open blockers and review results

- **Identity and IAM (P0):** Need approved dedicated staging runtime/deployer/tester identities and validated least-privilege grants. Firebase Admin bypasses Firestore client Security Rules; deny-all client Rules do not by themselves protect privileged server reads. No IAM changes were made.
- **End-to-end transport (P0):** A Cloudflare Pages Function must not be treated as Google workload identity by default. No confirmed keyless external service-to-service invocation from Pages to private Cloud Run; keep Pages route off. First test directly via a named Google invoker.
- **Activation and data (P0):** Live staging ADC, database IAM, Firebase token verification/revocation, synthetic fixtures, auth/foreign-owner denial, quotas, logs and rollback remain unverified. Blaze status is an owner-observed billing checkpoint only, not deployment approval.
- **Runtime packaging (P0 before deployment):** Validate actual container build and image-layer secret absence on the new commit. `npm ci --omit=dev --ignore-scripts` is used. Existing gate reports 6 moderate production dependency advisories from an earlier audit; rerun audit in CI and review actual exploitability before approving any deployed image.
- **Costs (P0):** Confirm Firestore region, Cloud Run selected region and tariffs, Artifact Registry storage/scan, logs, egress, Cloud Run max instances, zero minimum, IAM test traffic, Firestore atomic quota writes and retry amplification. INR 2,000 budget alerts are **not** a hard cap; trial credit and eligible usage must be rechecked before provisioning.
- **Media (separate gate):** Cloudflare R2 remains an unprovisioned primary candidate; Firebase Storage remains optional fallback. Storage, CDN, processing, malware/abuse checks, quarantine/private delivery, purge/orphan cleanup and tax/requests must be priced together. Google Cloud credit does not pay for R2.
- **Product scope:** This Cloud Run container is a narrow private Product owner-read slice; do not claim that Stores, Providers, Chat, Images or full Admin APIs are deployed or complete.

## Next safe work, in order

1. Code-only: expand or rerun (in Codex/CI) `tests/integration/staging-marketplace-packaging.test.mjs`, `tests/integration/staging-marketplace-handler.test.mjs`, `tests/integration/staging-marketplace-runtime.test.mjs`, `tests/integration/verified-operation.test.mjs`, plus existing Linux Docker smoke, verifying denied/default-off states, oversized JSON, wrong-project/ADC, duplicate credentials and SIGTERM. Report exact commands and pass/fail; do not assert success without running.
2. Recheck latest dependency advisories without forcing breaking major upgrades.
3. Reprice a *single* private staging trial proposal using 1 vCPU, 512 MiB, min 0 / max 1, bounded test traffic and an approved region. Prices and spend guardrails need owner confirmation, not assumption.
4. Only with **separate action-specific Yasmin approval**: create named staging resources/IAM and run direct private synthetic testing with a rollback.
5. Later, separately solve the Pages-to-Run trusted identity. Do not enable a public ingress workaround, embed service-account keys in Pages or relax Firebase Rules.

## Change control

This commit is documentation only. No modifications to `main`, runtime source, Firebase, billing, storage, Cloudflare, IAM, DNS, secrets, Cloud Run service, deployment or production environment. Existing HOLD/NO-GO remains.
