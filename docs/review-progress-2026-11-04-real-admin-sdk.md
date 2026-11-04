# Actual Admin SDK milestone — 4 November 2026

Baseline f3e5f775cddc53121096c533c44a1c9efa85890e, clean authorized branch.
Pinned firebase-admin 14.5.0 as runtime dependency (requires Node >=22; tests use 24).
No existing locked dependency version changed. No app/provider resource provisioning.

Actual SDK metadata inspection found native transport settings use servicePath/port,
NOT host. A separate demo-only binding checks both native settings and exact loopback
Firestore/Auth Emulator hosts. Staging binding now rejects Emulator environment
variables, so unsigned Emulator Auth tokens cannot be accepted as real staging tokens.
Existing production/project gates remain strict. No actual staged endpoint activated.

New fixed admin-runtime suite uses ONLY demo-oldx-admin-runtime, Firestore 8088,
Auth 9098, deny-all client Rules and disabled UI. Tests import the actual Admin SDK
and client Auth SDK: real Emulator sign-in/token checks, ownership, native timestamps,
transaction/replay/edit, rollback, atomic rates, denied client reads, publication gate,
project isolation and actual token revocation. Atomic photo hook in this SDK milestone
is still a test hook, not evidence of real media moderation or storage.

Local guard/runtime checks 26/26, toolchain 2/2, build 3/3 passed. Local Emulator start
FAILED before tests because official storage.googleapis.com binary download is blocked;
no untrusted mirror/retry bypass. Existing-host approval has not changed policy. Actual
six-case suite is wired into Review CI; record its exact-source result, not a mock claim.
Auth Emulator tokens are unsigned by design: this proves SDK verification/revocation
behavior in isolation, NOT production JWKS/cryptographic or live staging acceptance.

No credentials, live Firebase/Cloudinary, Rules/indexes, IAM/billing/main/production
changes. New SDK and server modules remain excluded from static browser assets.
HOLD/NO-GO. Next: native media namespace/policy binding and inactive deployable API
handler templates, followed by separately approved access/operational acceptance.

## Actual Emulator diagnostic and native media milestone

First source f9b75a38a395417422dc7ad94f2a6b178b9c7adc: Security/Service Emulator
passed; Review 41880014580 FAILED its new real Admin suite. The first actual Auth
Emulator token is unsigned (trailing empty signature), rejected by signed-token HTTP
syntax before verification; dependent cases consequently failed. Fixed ONLY the
explicit demo/loopback runtime/verifier to accept Emulator token syntax. Real/staging
HTTP defaults still reject it, and real staging bindings reject Emulator environment
variables. No assertion or SDK revocation check weakened. New negative regression
checks the real HTTP default rejects unsigned tokens.

Native media namespace bindings now reuse existing journal/reference/mandatory-photo/
atomic-parent/public-snapshot implementations through the branded Admin facade.
Product/Store only; Provider remains on its canonical separate path. Exact proposed
namespaces added to the owner review JSON, not live configuration. Existing isolated
constructors still validate demo/loopback/test namespaces. No public operation enabled.

Seven actual Admin/Auth/Firestore Emulator cases now include native quota reservation,
proof-less upload rejection, private attachment, independent synthetic approval,
atomic photo publication metadata and withdrawal/read revocation. Synthetic approval
rows are fixture data, NOT real scanning/moderation/provider acceptance. Real Cloudinary
operations remain ZERO. Local related mocks/source integration 38/38 and build 3/3
passed; actual new native suite result must come from exact-source CI because the
local official Firestore binary download remains blocked.

## Verified native checkpoint and inactive HTTP artifact

- Native source: **02f4ba959c55a261dff88e7a9e146c9ae78ae716**.
- Exact-source Review **41883099468 SUCCESS**; actual Admin/Auth/Firestore
  Emulator **7/7 passed**, including native media transaction/withdrawal case.
  Service Emulator **41883099552 SUCCESS**. No separate Security workflow was
  scheduled for this source; prior dependency-source Security **41880014601** passed.
- Actual Emulator evidence is CI, NOT local or real staging acceptance. Local
  official JAR download is policy-blocked. Auth Emulator unsigned JWT syntax is
  confined to explicit demo/loopback constructors; production cryptography/JWKS
  acceptance remains a staging task.
- Added Web-standard Vercel handler, lazy actual SDK bootstrap and pure route
  packaging manifest. Artifacts live OUTSIDE root `api/`; no routes installed.
  Config gates execute before SDK/credentials/body access. Original bounded JSON,
  strict UTF-8, content type, body/startup deadlines, abort, sanitized errors,
  no-store responses and shared authentication/rate/repository enforcement reused.
  Publication-enabled configuration deliberately refused until provider integration.
- `deploy/staging-marketplace/*.mjs` are locally importable inactive templates.
  The pure `stagingMarketplaceRouteArtifacts()` manifest contains correct relative
  imports for FUTURE root API placement. It performs no filesystem writes. Do not
  simply relocate templates: use the manifest only after separate approval.
- Focused handler/runtime/HTTP checks **26/26 passed**. `npm run test:build` was
  a nonexistent script (no build performed by that command); use the actual
  `npm run test:static-build` script. Handler cases included in existing CI suite.

### Minimum operator decisions / handoff (no secrets in chat)

1. Approve exact staging handler installation/flags separately, with existing
   Node >=22 runtime (CI Node24), `oldx-staging` only, Preview only, publication
   **false**, fixed reviewed namespaces and actor/global quotas 10/60 per minute.
2. Confirm existing securely bound staging Admin identity/access and rollback
   evidence. Do not provision/change IAM or credentials under this source approval.
   Empty/missing runtime identity must fail closed; no browser Admin SDK bundle.
3. Approve initialization manifest for synthetic actors, publication generation
   and media quotas, backup/export and rollback. No direct-client write Rules
   exception is required for these trusted server commands; deny-all stays intact.
4. Supply approved server-only Cloudinary signing/inspection access via existing
   secure configuration, never chat. Remaining actual provider multipart transport,
   independent authenticated asset/digest verification, private-byte delivery and
   delete/reconciliation integration are NOT validated by metadata Emulator tests.
   Keep Free hard quotas, quarantine/unapproved visibility and no unsigned preset.
5. Decide moderation reviewer authority, quarantine/rejection handling, retention,
   deletion/orphan policy and user privacy copy before any real image acceptance.
   No automated explicit-content detection is implemented or claimed.
6. Approve isolated synthetic staging acceptance ONLY after above: owner/other/guest/
   revoked sessions, retry after lost acknowledgement, photos and publication,
   withdrawal/revocation, browse/edit, gu/hi/en, 320/375px and device checks.

Next safest source batch: implement bounded injected provider HTTP upload/independent
inspection/delivery ports against deterministic provider fixtures, then packaging
acceptance for approved staging runtime. No provider call, live data, Rules/index,
secret/IAM/billing/deployment operation happened here. HOLD/NO-GO remains.

Final source validation: existing transaction integration regression **172/172** passed;
static browser package **3/3** passed. No server modules copied to browser output.
