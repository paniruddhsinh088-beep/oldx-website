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
