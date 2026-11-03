# Durable atomic photo-publication checkpoint — 4 November 2026 (Asia/Kolkata)

Authorized branch: security-hardening-review only.
Preserved base: 39793aa4fa78f7a1aa006b65850b7d3261ac864c.
Verified pushed implementation: 17376cd233075d779f610fae1dc4d19e9531b11d.
Push succeeded and git ls-remote confirmed that exact SHA before further work.
No concurrent commits, force push, main modification, merge or reset.

Completed opt-in/default-disabled source: existing parent transaction now stages
Product/Store state, exact approved managed photo selection, private association
revision binding, public derivative metadata, reference revocation, generation,
receipt and audit together. The independent moderator's approval is not rewritten.
Private draft edits retain the previously approved public version; replacement,
withdrawal and archive commit together with media changes. Failed staged writes
roll back everything. Lost acknowledgements retry without duplicate publication;
old receipt replay cannot resurrect withdrawn images. Legacy path stays unchanged.

Initial focused evidence: 10/10 pass via node --test --test-isolation=none
 tests/integration/atomic-photo-publication.test.mjs
 tests/integration/mandatory-photos.test.mjs tests/integration/media-release.test.mjs.
Log /tmp/oldx-atomic-photo-focused.log. Related focused regression 21/21 also
passes: node --test --test-isolation=none tests/integration/atomic-photo-publication.test.mjs
 tests/integration/durable-repositories.test.mjs tests/integration/media-delivery.test.mjs
 tests/integration/product-ui.test.mjs tests/integration/store-ui.test.mjs
(log /tmp/oldx-atomic-photo-regression.log). Counts overlap, not unique coverage. Actual SDK case is wired into existing CI;
local tests are mocks, never live Firebase. Detailed implementation/limits:
[atomic milestone](review-progress-2026-11-04-atomic-photos.md).

Exact-source CI for 17376cd233075d779f610fae1dc4d19e9531b11d:
- Branch Security 41707371087: success.
- Service SDK/Rules 41707371193: success (37/37 actual Emulator cases).
- Review Safety 41707371171: success.

Next P0 (outside this batch; do not start without the required scope/approval):
1. Provider public-image DTO/delivery and trusted byte/provider release integration.
2. Approved Auth/runtime/revocation/rate enforcement, operational media/schema/
   Rules/indexes/IAM/secrets and media/privacy/retention/moderation policy.
3. Chat retention/deletion/account lifecycle and minimum trusted Admin enforcement.
4. Real staging/mobile/accessibility/WebView/device and rollback/cost acceptance.
5. Separate explicit release authorization. November 7 is a target, not a guarantee.

No actual image provider, automated content detector or real moderation approval
is activated. Tests use isolated synthetic proof fixtures; those are not claims
of working production scanning. Public descriptors are not public byte URLs.
All endpoints/transports remain disabled; existing images are not migrated,
remotely deleted or automatically unpublished. No live/staging Firebase/Storage/
Cloudinary/data, deployed Rules/indexes, IAM/secrets/billing/paid services,
main/merge, migration, native packaging or deployment. HOLD/NO-GO.

Exact safe resume: fetch branch and read this ledger; inspect exact-source CI and
working tree first. Do not rebuild the completed Product/Store atomic transaction,
selectors or messaging. Preserve all history; only fix demonstrated CI failures.
