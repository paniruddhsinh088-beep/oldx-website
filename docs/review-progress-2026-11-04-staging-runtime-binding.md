# Staging runtime binding — source checkpoint, 4 November 2026

Baseline: clean remote/local 0425550f01551c11ea2f5ecc44ee292cd28aa791.
Owner prioritizes proposed oldx-staging namespaces/routes for SOURCE implementation,
not operational activation. No live SDK call, credential setup, Rules/index/data/
provider/billing/production change. Existing Products/Stores/Provider/Chat/Admin kept.

## Implemented

- Separate branded oldx-staging-only native Admin API facade: fixed new namespaces,
  bound references, native snapshot/transaction normalization and project revalidation.
  No app/client initialization. Old demo/loopback constructors/guards stay strict.
- Same repository transaction implementation reused for staging owner/create/edit/
  receipts/audit; no competing schema. Mandatory photo policy forced; publication
  disabled by default and withdrawal/archive denied without atomic media interfaces.
- Private path dispatcher for exactly save/owner/archive under /api/staging/marketplace.
  This is a server LIBRARY, not deployed api/ handlers; static Preview excludes it.
  Verified/revocation-aware Auth, audience/issuer/expiry checks, server UID ownership,
  revision/idempotency/atomic audit and shared bounded HTTP boundary are reused.
- Durable atomic actor/global rate counters on marketplaceRateLimits_v1; configuration
  required, malformed/unavailable enforcement fails closed. Expiry metadata does NOT
  activate TTL/deletion. Counter retention/cleanup still needs reviewed policy.
- Pure non-secret environment parser: Preview + oldx-staging only, two operational
  flags default false. No automatic process.env/credential reads or public startup.

## Evidence and limits

Final focused regression command covers staging-runtime, command HTTP, Provider
verification, atomic photo publication and durable repository tests: **25/25 pass**.
Earlier related provider-repository sweep passed **32/32** before the environment
parser test was added. Build **3/3 pass**. New runtime cases **8** cover valid owner,
other owner/guest/revoked/foreign/expired tokens, create/edit/retry, withdrawal/replay,
transaction rollback including atomic-hook audit, wrong project/production, quotas,
namespace agreement and config fail-closed behavior.

New native tests use an Admin-API-shaped SDK DOUBLE, not a real Admin SDK, Emulator
or staging. Atomic media test hook proves same-transaction rollback, NOT actual
staging photo moderation. Existing isolated Rules/SDK Emulator CI remains separate.
No claim of native SDK/provider/staging acceptance. No new dependency installed.

Actual media bindings remain a trusted injection interface; existing isolated media
factories cannot simply be relabeled as staging. The branded facade currently permits
only marketplace + rate namespaces. Exact media namespace scope/native adapter and
real provider byte inspection must be reviewed/implemented before photo publication.
Do not set publicationEnabled true with test/no-op photo hooks.

## Exact operator checklist (no operations performed)

1. Review updated proposals/product-staging-activation-review.json: source target is
   acknowledged, operational activation remains unapproved. Confirm new marketplace
   and rate namespace mapping, exact private routes, allowed staging runtime and region.
2. Supply EXISTING oldx-staging-scoped Admin Firestore/Auth instances and FieldValue
   through the approved server SDK/secure manager. The runtime does not install or
   initialize Firebase Admin. Pin/validate the actual SDK and test native bindings on
   an isolated Emulator before deployment; SDK dependency/runtime entrypoints remain
   packaging work. No secrets in chat. New IAM/secret provisioning needs approval.
3. Proposed non-secret config is explicit in the JSON. Keep both enabled flags false.
   Rates 10 actor/60 global per 60 seconds are review defaults, not approved operating
   quotas. Approve counter cleanup/retention, verify staging-only access/network and
   current deny-all Rules release/rollback evidence. Do not enable TTL/billing/jobs.
4. Cloudinary tfizvbzc Free: provide authorized server-only credential getter, bounded
   signed multipart transport, independent authenticated asset/digest inspection,
   exact derivative reader, quota/retention/moderation/consent decisions. Current
   upload bridge is isolated-test-only; no real provider transport is activated here.
5. Approve any staging handler deployment, operational flags and exact synthetic data/
   photo acceptance manifest separately. Test two accounts, revoked/session/foreign
   denials, private draft/photo -> approved atomic publication -> guest display ->
   edit/replace -> withdrawal and rollback, gu/hi/en, 320/375px and refresh/logout.
6. Rollback configuration: enabled=false, publicationEnabled=false; restore captured
   prior handler/config and deny-all Rules ONLY through separately approved operator
   action. Cleanup only the approved exact synthetic manifest, not legacy data/images.

Next safe source task: actual pinned Admin SDK Emulator validation/packaging, then
native media namespace/atomic binding and approved provider transport. No broad Rules
relaxation or public publication to make the legacy Post Now bypass this integration.
HOLD/NO-GO; November 7 remains a target, not verified real-world acceptance.
