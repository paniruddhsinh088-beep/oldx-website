# Provider profile-image contract — durable checkpoint, 4 November 2026

Branch security-hardening-review only. Preserved base:
9791e65c232800ae340be9778247729b5bd08814.
Pushed implementation: 5a4c54fa80dcb2436ad36317bc222589a0195fe8.
Remote git ls-remote verified exact source SHA; no concurrent history replaced.

One small batch completed: default-disabled read-only Provider profile-image
sidecar contract, canonical identity/owner/publication/eligibility/generation
checks, existing independent media approval/release validation, strict profile
limits and allowlisted derivative result. Provider v1 DTOs and all writes unchanged.
No real URL/byte delivery, endpoint, SDK reader, public activation or scanner added.

Focused 10/10 passed:
node --test --test-isolation=none tests/integration/provider-photo-contract.test.mjs
 tests/integration/media-delivery.test.mjs tests/integration/atomic-photo-publication.test.mjs
Log /tmp/oldx-provider-photo-contract.log; git diff --check passes. New Provider
cases use synthetic snapshots; they are NOT actual Provider SDK/Rules evidence.
No full local sweep or unrelated UI/dependency work. Product/Store and private
media contract regressions remain passing in the selected tests.

Exact-source CI for 5a4c54fa80dcb2436ad36317bc222589a0195fe8:
- Branch Security 41709300810: success.
- Service SDK/Rules 41709300484: success (existing integrations only).
- Review Safety 41709300653: success.
The existing SDK suite covers existing integrations, not a new Provider image
snapshot adapter. Distinguish those checks from the synthetic new contract tests.

Required next step: owner-approved Provider media-sidecar design, then an inactive
atomic/fresh SDK snapshot and release adapter bound to canonical PUBLIC publication
epoch; require existing identity/owner/actor and current review/publication checks.
Never use cached public DTOs or browser filtering of private documents. Provider
write/release currently remains unimplemented; no release approval is manufactured.
See [contract details](review-progress-2026-11-04-provider-photo-contract.md).

Other blockers: actual media bytes/storage/moderation/privacy/consent/retention;
Auth/runtime/rates/Rules/indexes/IAM/secrets; Chat deletion/retention and Admin;
real staging/mobile/Android-WebView acceptance and separate launch approval.
No live Firebase/Cloudinary/data, Rules/indexes, secrets/IAM/billing, paid services,
Full Reset, main/merge, native packaging, migration or deployment. HOLD/NO-GO.
Stop here after checkpoint; preserve the remaining weekly allowance.
