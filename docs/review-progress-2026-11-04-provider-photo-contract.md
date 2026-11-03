# Provider profile-image read contract — 4 November 2026 (Asia/Kolkata)

Small repository-only batch; stop after verified checkpoint. Branch:
security-hardening-review. Preserved/fetched base
9791e65c232800ae340be9778247729b5bd08814, clean working tree, no newer/concurrent
remote commits. Read AGENTS and latest atomic-photo ledger; reuse existing media
approval/delivery validation. No new page, UI rewrite, dependency or full sweep.

Implemented, default disabled:
- `createProviderPhotoContract` accepts one strict profile-image request and a
  trusted injected atomic/fresh server snapshot port. It independently checks
  canonical publication epoch/generation, identity/owner mapping, owner publication
  status/eligibility and media-parent ownership before existing media validation.
- Reuses existing release/association/generation, publisher permission, independent
  review/moderator authority, processed/scan proof and public-reference bindings.
  Provider uses the stricter profile image limits (one image, 1024px / 2 MiB), not
  the Product/Store limits. Only service:null profile images are permitted.
- Result contains only provider ID, publication epoch, photo revision and approved
  image/derivative/version descriptors. No URL, private draft, UID, credential,
  image bytes or token. Provider v1 public/private projections remain unchanged.
- Generic existing Product/Store publicPhotos keeps its accepted surfaces; Provider
  reads require an explicit separate trusted reader. No private-to-public fallback.
  The shared validator's reader/surface parameters remain internal, not caller
  arguments on exported methods. No default endpoint or network operation added.
- Cancellation/deadline checks suppress late snapshots. Read only: no approval,
  publication, migration or deletion is performed.

Observed focused tests: 10/10 pass via
node --test --test-isolation=none tests/integration/provider-photo-contract.test.mjs
 tests/integration/media-delivery.test.mjs tests/integration/atomic-photo-publication.test.mjs
Log /tmp/oldx-provider-photo-contract.log. Covers exact allowlisted result, unchanged
snapshot/v1 fields, default off, malformed input, withdrawal, wrong owner/identity,
publication/photo generations, independent-review revocation/self-approval, missing
scan, wrong surface/service, profile size limits, cancellation and deadline.
These are synthetic policy/contract fixtures, NOT actual Provider SDK/media release
or automated scanning tests. Existing exact-source CI results follow in the ledger.
No repeated full regression/browser sweep: no UI changed; existing browser/locale
regressions remain in Review CI. Server modules are not browser/Capacitor imports.

Unactivated contract / approval requirements:
- readSnapshot MUST be a fresh atomic trusted server read of the canonical Provider
  publication/identity/owner/actor/generation plus media facts; cached public DTOs
  or browser-side private-document filtering are forbidden. This batch does NOT
  implement that SDK adapter or claim snapshot provenance from structural checks.
- expectedPublicationEpoch binds to canonical PUBLIC Provider publication epoch,
  not mutable private draft revision. Provider generation may be newer due to other
  publications; it must never be older than this publication. A future approved
  sidecar writer must bind media parentRevision to that public epoch atomically.
- Provider sidecar release/write mapping and operational schema are NOT activated
  or approved by this reader. No service gallery or contact/media field is added
  to approved v1 DTOs. No legacy image migration or existing feature change.
- Actual public/private byte gateway, storage provider, moderation/scan/privacy/
  consent/retention policy, Auth/runtime/rates/Rules/indexes/IAM/secrets and staging/
  device acceptance still need separate owner approval. No resources or spending.

Next exact safe step: approve the Provider media-sidecar design boundary, then
prepare its default-disabled atomic SDK snapshot/release adapter using existing
canonical identity/publication ports and test revocation races in an isolated
Emulator. Do not redo this read contract or Product/Store atomic publication.
No live/staging Firebase/Cloudinary/Rules/index/IAM/secrets/billing/deployment,
main/merge, Full Reset, paid services or actual image activation. HOLD/NO-GO.
