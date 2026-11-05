# OLDX autonomous resume — 5 November 2026

Branch: `security-hardening-review` ONLY. HOLD/NO-GO.

## 5 November native provider-proof milestone

Completed source: default-disabled native provider-proof runtime, durable one-dispatch
claims, independently verified upload proof persistence, restart/retry confirmation,
present-upload reconciliation, delete leases/settlement receipts and atomic quota
refund through existing journal. Reuses operations/audits with domain-separated
`providerproof_` / `attempt_providerproof_` keys; no new collection or live schema.
Existing signed multipart bridge has an optional server-only durable proof callback.
Journal verification reads proof/audit in the SAME transaction (no nested transaction
or provider side effects). Canonical proof hashing handles Firestore map ordering.

Latest pushed executable source: **d9a92f1fac9046ae9132bbea77e1f636d6ca74b0**.
Exact-source CI: Review **41966283058**, Security **41966283019**, Service
Emulator **41966283073** — all SUCCESS. Vercel Preview status SUCCESS.
Prior baseline **aa9cb82ca68bb8375ba54820a88282dd83ebb881** preserved.
The final ledger commit does not change executable source; retrieve its exact SHA
with `git log -1 --format=%H -- docs/oldx-autonomous-resume.md`.
Local focused **24/24 PASS**, relevant transaction regression **192/192 PASS**,
static browser package **3/3 PASS**. Native Emulator suite expanded from 7 to 8
cases; new actual-repository case includes lost provider acknowledgement, restart,
AFTER-native-commit lost journal acknowledgement, ownership/revision and quota checks.
Actual Admin/Auth/Firestore Emulator **8/8 PASS** in Review CI, including the new
durable receipt/AFTER-commit lost acknowledgement case. No local JAR re-download
attempt (same known network blocker). All provider/processor results are deterministic
fixtures; this is NOT Cloudinary, real scanning or staging acceptance.

Current incomplete task / next exact action: prepare the narrow trusted runtime
binding from authenticated media preflight to this coordinator with native journal
reserve/attempt, mandatory rate/quotas and unknown-outcome deadline handling. Do NOT
mount routes or enable publication. Provider canonical v1 sidecar remains separate.

Operational blockers: existing securely bound staging identity/media access and
network authorization; explicit runtime/route/flag approval; initialized synthetic
actor/generation/quota manifest with backup and rollback; independent processor and
moderation policy; Cloudinary Free quota, inspection, retention/deletion settlement
and actual synthetic staging workflow acceptance. No secrets in chat. Public image
publication and all new transports remain disabled. Unknown upload/delete outcomes
retain quota; a 404 alone NEVER proves a late operation has settled.

Minimum operator actions before real acceptance:
1. Confirm existing securely bound `oldx-staging` Admin identity/project isolation,
   approved server-only Cloudinary Free credentials/inspection permissions and
   provider-host egress. No secrets in chat or new IAM/secrets provisioning here.
2. Approve reviewed synthetic actor/quota/generation initialization manifest,
   backup and rollback evidence. Keep direct-client deny-all Rules unchanged.
3. Select/approve trusted reencoding, metadata removal, quarantine/manual reviewer
   policy, provider quotas, retention and authoritative delete-settlement evidence.
   No automated explicit-content moderation is claimed. Mere absence is insufficient
   to refund an in-flight upload/delete reservation.
4. Separately approve narrow staging route installation and operational flags only
   after these prerequisites. Run owner/other/guest/revoked-session synthetic
   Login/create/upload/review/publish/browse/edit/withdraw and 320/375px gu/hi/en
   staging acceptance. Until then source/Emulator evidence is NOT staging GO.

No automated scheduler was created; next authorized scheduled/manual execution must
read this checkpoint and latest remote/CI. No promise of restart after credit reset.

## Preserved prior checkpoint detail

Last completed task: default-disabled, injected Fetch-compatible Cloudinary signed
multipart HTTP, independent authenticated metadata/bytes inspection, public-approved
and participant-token private byte ports, lease-authorized single-asset cleanup.
Private delivery has mandatory rate enforcement, participant/revision revalidation
before and after reading, separate private resolver, and NO public fallback.
Generated Vercel route artifacts package their transitive server/shared model imports
in an offline temporary directory; no API route is installed in the repository.

Latest pushed executable source: **10bab307343a7a67cdd134dcc6f23cc153cd4848**.
Exact-source CI: Review **41889287323**, Security **41889287445**, Service Emulator
**41889287525** — all SUCCESS. Actual native Admin/Auth/Firestore Emulator **7/7**
passed again in Review CI. Vercel Preview status SUCCESS for this source.
First implementation checkpoint **ecab23e6bfa7700d9e3393478498a18c048ee049** also
had all three workflows pass (Review 41888471585, Security 41888471582, Service
Emulator 41888471544). This final ledger-only checkpoint changes no executable code. To find the ledger's
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
