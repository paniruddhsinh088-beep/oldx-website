# Marketplace trusted command integration — 4 November 2026

Baseline: clean remote/local `284dd2739b37b66c35a62d9c09e743b736090cd5`.
Repository-only implementation; Preview push approved, live services still gated.

Implemented default-disabled `createMarketplaceCommandHttp`: reuses existing bounded
JSON/method/header/token verification, revocation-aware injected verifier and mandatory
rate port. Strict Product/Store save/archive/private-owner DTOs use the SAME repository
profile validator; no parallel schema or state machine. Client owner/role fields are
rejected. Repository factory receives only server-derived identity and remaining deadline.
Private responses exclude ownership/audit/credential fields, with no-store headers.

Shared HTTP boundary now lets trusted contracts mark save/archive as mutations; timeout
then returns OUTCOME_UNKNOWN with retrySameRequest rather than an unsafe new mutation.
Existing Chat open/send behavior unchanged. PHOTOS_REQUIRED/RECEIPT_UNKNOWN/CONFLICT
are explicit safe 409 responses. Atomic media checks remain INSIDE the trusted repository
transaction; handler does not replace them with a racy client/preflight check.

Six new focused cases cover draft/replay/private recovery/cross-owner denial, mandatory
photo denial/stale revision/archive, token/rate/schema boundaries, ambiguous timeout/
private-response contamination, Store compatibility and existing Product controller ->
HTTP -> SDK-shaped repository double draft/edit/recovery/archive. No new demo page.
These are mock integration cases, not real Firebase/Cloudinary acceptance. Local relevant
regression sweep 30/30 passed before the sixth controller case was added; final new suite
6/6 passed; build 3/3 passed. Existing exact-source CI runs the new suite and isolated Rules.

No routes, Firebase Admin initialization, credentials, network upload or browser transports
were activated. New server module is excluded from static browser assets. Existing SDK
repository is still deliberately demo/loopback-locked: a reviewed staging SDK/runtime
binding is a REAL remaining task, not an environment toggle or completed backend.
Guest public HTTP read/photo-byte delivery and real signed-provider bindings remain absent.

Specific owner review artifact: proposals/product-staging-activation-review.json. It
proposes exact private routes/collection mapping and existing staging target, preserves
deny-all clients and legacy collections, and names mandatory atomic/media/identity/rate
bindings. It is NOT loaded by Firebase/Vercel/runtime and is NOT approved/deployed schema.
For indexes, reuse the query combinations and staged rollback checklist in
proposals/firestore-staging-readiness-2026-11-04.md; physical mapping above needs approval
before emitting/deploying final indexes. No Rules/index/secret/provider changes here.

Owner actions before operations: (1) approve exact staging runtime/routes/schema mapping
and attach existing staging-scoped access securely; (2) identify existing server identity/
secret-manager bindings, approve any provisioning/change separately; (3) approve real signed
Cloudinary staging scope, measured Free caps and privacy/moderation/retention; (4) provide
current Rules/rollback artifacts and authorize one synthetic-account/photo acceptance
manifest. Do not paste credentials. Safe staging testing permission already exists; missing
access/bindings/policy are not solved by repeating that general approval.

Next source batch: staging-locked SDK/runtime binding + trusted guest public read/delivery
composition using existing ports, then approved synthetic photo/publication acceptance.
All Product/Store/Provider/Chat/Admin/location/sharing/locale/Android requirements remain.
Increased rollout risk acceptance does not authorize secret/Rules/main/production actions.
HOLD/NO-GO; no guaranteed November 7 completion or real end-to-end acceptance claimed.
