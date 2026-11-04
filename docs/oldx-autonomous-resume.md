# OLDX autonomous resume — 4 November 2026

Branch: `security-hardening-review` ONLY. HOLD/NO-GO.

Last completed task: default-disabled, injected Fetch-compatible Cloudinary signed
multipart HTTP, independent authenticated metadata/bytes inspection, public-approved
and participant-token private byte ports, lease-authorized single-asset cleanup.
Private delivery has mandatory rate enforcement, participant/revision revalidation
before and after reading, separate private resolver, and NO public fallback.
Generated Vercel route artifacts package their transitive server/shared model imports
in an offline temporary directory; no API route is installed in the repository.

Latest pushed executable source: **ecab23e6bfa7700d9e3393478498a18c048ee049**.
Exact-source CI: Review **41888471585**, Security **41888471582**, Service Emulator
**41888471544** — all SUCCESS. Current private delivery/packaging milestone will
replace this source pointer after push and CI verification. To find the ledger's
own checkpoint commit, use `git log -1 --format=%H -- docs/oldx-autonomous-resume.md`.

Tests: first HTTP/bridge focused **39/39 PASS**; related transaction integration
regression **190/190 PASS**; static build **3/3 PASS**. Final changed private/HTTP/
packaging subset **18/18 PASS**. Packaging initially failed because its copy allowlist
omitted the existing pure shared `features/stores/store-catalogue.mjs` dependency;
fixed by including referenced feature modules in the temporary closure. No assertion
was removed. These are synthetic injected HTTP/offline package tests, NOT real
Cloudinary or staging tests. Existing actual Admin/Auth/Firestore Emulator suite
runs in exact-source CI, not locally (official binary download policy blocked).

Incomplete task: real provider/native journal and lease-proof runtime composition.
Exact next action: inspect `staging-marketplace-media.mjs` and journal's proof and
upload-attempt/reconciliation interfaces, bind the new provider attestation through
those existing contracts using fake provider HTTP and native Emulator repositories.
Require trusted parent revision and delete leases; never auto-retry an ambiguous
mutation or treat an in-process WeakMap upload receipt as durable recovery proof.
Provider-specific canonical v1 image projection remains separate and inactive.

Remaining priorities:
1. Native journal/provider proof and lost-acknowledgement composition acceptance.
2. Trusted native journal upload/proof/reconciliation composition; never auto-retry
   an ambiguous mutating provider call or release reserved quota on uncertainty.
3. Approved synthetic staging Login/create/photo/publish/browse/edit/withdraw path.
4. Store/Provider/Chat/Admin/mobile/gu-hi-en acceptance and full launch requirements.

Operational blockers / concise owner checklist:
- Environment currently has NO configured credential/outbound identity bindings;
  provider API hosts are not allowed. Do not bypass network policy or request
  secrets in chat. Existing secure staging identity/access must be confirmed.
- Separately approve staging route installation/flags and reviewed synthetic
  namespace initialization; verify backup/rollback first. Direct client deny-all
  Rules remain. Runtime publication flag stays false.
- Separately approve server-only Cloudinary signing/inspection access, Free hard
  quotas, and actual provider testing. No unsigned preset change or account action.
- Decide quarantine/manual reviewer authority, privacy, moderation, retention,
  deletion/orphan grace and rollback evidence. Byte/hash checking is not automated
  explicit-content detection. Approved releases remain a separate trusted policy.
- Real provider signature compatibility and CDN invalidation need actual approved
  staging acceptance. Cloudinary Admin API invalidation may require provider support;
  app revocation uses fresh no-store authorization and does not depend on CDN purge.

Continuation: read AGENTS.md, fetch the review branch, inspect this ledger and newest
CI, preserve concurrent commits, resume only unfinished safe work. No new scheduled
automation has been installed. This session cannot guarantee automatic restart after
credits reset; the next authorized scheduled/manual execution must run these steps.
No main/merge, live activation, Rules/indexes, IAM/secrets/billing or paid actions.

Implementation notes / verified limits:
- No new dependency, browser code, authored text or legacy image reference changed.
  Server Web APIs use Node >=22 (CI24); existing mobile/Capacitor UI is preserved.
- HTTP deadlines cap provider work at five seconds per request; upload max3MiB,
  provider JSON max16KiB; no redirects, arbitrary hosts/paths, public fallback or
  automatic upload/delete retries. Existing bridge reports start/verified completion;
  Fetch does not provide genuine incremental upload progress here.
- Inspection performs two authenticated metadata reads plus one exact-version byte
  download. Stored SHA256/MIME/size are verified, not inferred from upload metadata.
  Independent decoding/metadata stripping/moderation remains a prerequisite from
  existing trusted processor/reviewer contracts; synthetic bytes are not scan proof.
- Public/private derivative resolvers MUST come from trusted fresh journal/approval/
  ownership snapshots. A fixture authorizer returning true is NOT authorization.
  Keep hard per-actor/global request quotas; Admin API inspection calls have limited
  Free capacity. Owner must confirm current provider quota before activation.
- Signed URL/credential material stays server-side. Cleanup targets one immutable
  asset ID, checks delete authority again and confirms missing metadata. CDN purge
  is not guaranteed; immediate app revocation comes from no-store fresh checks.
- Technical references: [Cloudinary delivery signatures](https://cloudinary.com/documentation/delivery_url_signatures),
  [Admin resource lookup/deletion](https://cloudinary.com/documentation/admin_api),
  [access control](https://cloudinary.com/documentation/control_access_to_media).
