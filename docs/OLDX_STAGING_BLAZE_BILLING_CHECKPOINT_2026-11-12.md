# OLDX Staging Blaze billing checkpoint and next safety gates

Date: 2026-11-12
Owner-reported and approved by: Yasmin Parmar, OLDX business/technical operator
Repository: yasminparmar087-ops/oldx-website
Authorized branch: `security-hardening-review`
Release status: **HOLD / NO-GO**

## Verified via owner-led console checks (not independently queried through billing APIs)

- Google Cloud billing account "My Billing Account", ID `015623-E773BE-4AB3CB`, previously confirmed to be a free-of-charge trial and administered by Yasmin.
- The owner explicitly approved linking **only** `oldx-staging` to that billing account. Google Cloud returned: "Project oldx-staging has been moved to a different billing account."
- Firebase then displayed **"Blaze | Free-of-charge trial"**, 90 days and INR 28,569 remaining as displayed at the time. These are dated console observations, not guarantees of continued balance or eligibility.
- Firebase Storage's previous Upgrade prompt disappeared after linking. **No default Storage bucket has been created or upload functionality tested merely by this observation.**
- Monthly budget `OLDX-Monthly-Budget` was owner-created at INR 2,000 with actual-spend email thresholds INR 500/1,000/1,600/2,000. Alerts are not a hard spending cap, and invoice/credit treatment may differ.
- The owner previously observed staging Firestore `(default)` ready and its client-side rules as deny-all (`allow read, write: if false;`). The baseline was not changed as part of this review.
- Production `oldx-1c983` and testing `oldx-testing` were not authorized for billing changes. Recheck before relying on their current state.
- The owner approved this *specific staging billing-link action only*; no blanket approval for new paid provisioning, secrets/IAM, storage, live rules, Cloud Run deployment, R2 setup, source-to-live wiring or production rollout.

## Architecture to preserve

Per `docs/OLDX_FINAL_ARCHITECTURE_AND_COST_DECISION_2026-11-07.md`:
- Cloudflare Pages frontend candidate; Firebase Auth + Firestore; Cloud Run trusted backend candidate; Cloudflare R2 Standard photo-storage candidate with Firebase Storage adapter fallback; Capacitor Android from shared UI.
- Reuse existing code and tests. No unrelated rewrites or design resets.
- Site and Android design follows `docs/OLDX_UI_UX_APPROVED_DESIGN_PLAN_2026-11-08.md`.
- Keep all work in `security-hardening-review`, no automatic deployment, and preserve rollback/history.

## Post-link safety actions (review/code-only unless separately approved)

1. Confirm staging Blaze/free-trial status and linked billing account without changing configuration; periodically monitor eligible credit, consumption and trial expiration.
2. Confirm actual budget **scope**, notifications and any exclusions now that `oldx-staging` is linked. A preexisting all-project budget may cover only projects under the selected billing account; do not assume spending is blocked at INR 2,000.
3. Review existing trusted HTTP/Firebase SDK adapters for Cloud Run readiness: verified Firebase ID tokens, identity/role and ownership checks, bounded concurrency/quotas, deny-by-default, API authentication, retry/idempotency, audits, timeouts and least-privilege service-account plan. **No runtime/service/account/IAM provisioning.**
4. Compare Firebase Storage vs R2 **end-to-end** with synthetic assumptions: storage, GET/PUT ops, egress, private delivery, image scanning/transcoding/moderation, lifecycle, caching, latency, taxes and provider billing separation. Google trial credit does not fund Cloudflare R2.
5. Prepare cost model for 500/1000/1500 DAU using measured Firestore calls/chat reads plus photo-heavy scenarios, rather than assuming INR 2,000 monthly cost or that free-trial credit makes every API free.
6. Before any provisioning/activation: owner-specific approval naming provider, resource, region, paid terms, limits, rollback, secrets, identity, and staged verification. Preserve staging deny-all until explicit rules authorization and tested candidate rules.
7. Trial expiration risk: services requiring Blaze may cease to function or change behavior if trial ends without a paid conversion. Prepare an owner-approved exit/continuity decision before that date.

## Source references checked 2026-11-12

- Firebase Blaze plans: https://firebase.google.com/pricing/
- Firebase Storage billing requirements: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Cloud Run request-based vs instance-based billing: https://docs.cloud.google.com/run/docs/configuring/billing-settings
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/

## Evidence and open gates

This document records owner-reported console outcomes and planning. It does **not** certify functional staging services, security acceptance, actual costs, CI success, IAM state or production readiness. All existing HOLD/NO-GO gates remain open unless separately signed off.
