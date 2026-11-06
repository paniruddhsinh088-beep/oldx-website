# Staging prerequisite recovery and reversible migration plan — 6 November 2026

Status: BLOCKED / HOLD / NO-GO for any live execution. Repository-only preparation.
Branch baseline: 4024ba03b332e8a9fea9dc8f8424b2d4953623d1, clean and current at start.
Owner's latest authorization supersedes the previous blanket staging data/Rules
restriction only after independently verified prerequisites. It does not authorize
production, destructive operations, IAM/secrets/billing, deployment settings or
unrelated deployment. No live data/Rules operation was attempted in this batch.

## Access checked once; exact missing evidence

Current exposed OLDX Firebase MCP tools: firebase_get_environment,
firebase_get_project, firebase_update_environment. None reads deployed Rules,
Rules releases, Firestore collection/document/schema inventories, backup/export
metadata or restore/rollback verification. No other exposed authorized tool offers
those operations for this staging project. Unavailable tools were not repeatedly
retried; no raw API/CLI/alternate identity was used to bypass this limitation.
Last verified target is oldx-staging, project number 38472235077, ACTIVE, billing
disabled. Those metadata facts do not prove current Rules, empty data, permissions,
a usable backup or zero-cost restore. Do not infer any absent namespace is empty.
MCP project directory remains the older ZIP workspace; this run does not change it.

Missing access/evidence that must be supplied through existing authorized read-only
capabilities or an independently verified operator handoff, without new IAM/secrets:
1. Exact database identity(s), deployed Rules source/hash/release and rollback release.
2. Paginated recursive collection/document inventory, including subcollections whose
   parent documents are absent; schema/type/size/count/timestamp/ID/owner/index and
   version references for each logical feature. Auth/Storage dependencies inventoried
   separately without accessing/altering out-of-scope providers or credentials.
3. Existing complete backup artifact and manifest with provenance, hashes, snapshot
   boundary, recursive coverage, type fidelity, private storage and retention owner.
4. Independent restore rehearsal against an approved isolated destination with exact
   counts, IDs, nested paths, type/value and relation comparisons; verified existing
   operator restore and Rules rollback permissions. A successful local synthetic
   rehearsal below is not evidence that a staging backup is restorable.
5. Current zero-additional-cost eligibility for the proposed read/export/restore/test
   method, quotas/limits and monitoring evidence. Billing disabled is NOT proof of
   free export/import or eligibility. If any plan upgrade/spend/resource creation or
   permission change is required, STOP and report; none is authorized.

## Backup manifest and evidence gate

Fill docs/staging-backup-manifest.template.json only from verified evidence. Keep
actual private records, tokens, private paths, archives and sensitive manifests OUT
of Git/chat/public browser artifacts; commit only a redacted audit reference/digest.
Null/false fields deliberately block progression. Do not insert guessed counts/hashes.
Inventory must enumerate ALL top-level/nested collections, including unknown ones,
not just known Users/Products/Stores/Chats/Service Provider names. Preserve timestamp
nanoseconds, integers/precision, references/project/database, GeoPoint, bytes, arrays,
nulls and maps; ordinary JSON of SDK objects is not an accepted live backup format.

scripts/staging-preflight-evidence.mjs is an offline documentary consistency checker:
wrong project/number, missing nested coverage, archive/restore digest mismatch,
unverified operator/cost/feature evidence and hostile getters fail closed. A complete
synthetic example can be readyForManualReview but executionAuthorized ALWAYS remains
false. This checker cannot authenticate claims, verify an archive remotely, grant
permissions or invoke a migration. Independent evidence review is mandatory.

## Staged migration procedure (plan only, no operational runner)

1. Reverify exact project ID/number/database and read-only session before every stage.
   Capture a versioned Rules snapshot, source inventory and backup/restore evidence.
   Verify existing writer concurrency/cutover coordination; no authorized way to obtain
   a consistent snapshot means STOP. Do not change IAM/billing/secrets to continue.
2. Review actual schemas against USER_DATA_MIGRATION_SPEC.md,
   PRODUCTS_PUBLIC_PRIVATE_MIGRATION_PLAN.md and current marketplace*_v1/Provider
   contracts. Historical publicProfiles/publicProducts proposals are NOT automatically
   interchangeable with the newer versioned namespaces. Select reviewed mappings from
   observed data; no app/Rules rewrite or parallel schema is authorized by this plan.
3. Compute a deterministic dry-run from a pinned before-image. Record source revision,
   per-path input/output digests, transform version, invalid/unknown field exceptions,
   target collisions, expected counts and compatibility effects. Quarantine exceptions;
   never silently truncate an existing saved/block list or modify authored Unicode.
4. Preserve all legacy records. Prefer additive, private, unexposed candidate writes
   with create-only/exact-revision preconditions, bounded atomic batches and durable
   receipt/audit per batch. Rerun identical batch IDs without duplicate writes. Existing
   target divergence is a conflict requiring review, not a merge/overwrite shortcut.
   No live writer exists in this batch. The existing pure User/Product transforms are
   LOCAL policy examples with limits; they are not a lossless whole-database migration.
5. Reconcile source/target counts, fields/types, IDs, owner/participant relationships,
   saved/block references, Store catalogues and Provider lifecycle. Do not cut over any
   client/route merely because a projection exists. Client/backend binding, media and
   deployment actions outside data/Rules still need their existing separate gates.
6. Compare candidate Rules with the ACTUAL captured release and run the full isolated
   negative/positive matrix first. Existing server-mediated deny-all proposal is reused
   here without modification. It does not implement browser functionality and does not
   constrain Admin SDK authorization; server token/role/rate/ownership gates remain.
   Never overwrite a different live policy blindly or add broad legacy/public reads.
7. Only after independent backup/restore/permissions/cost/compatibility review: execute
   separately recorded staging-only micro-batches, validate after each and maintain
   reversible checkpoints. A blocked prerequisite stops before writes or Rules change.

## Compatibility acceptance checklist (all required)

- Users: Auth UID linkage, display-name/photo fidelity, private email/IP/preferences,
  exact saved/block lists, presence/consent, existing/new session/logout compatibility.
- Products: owner and IDs immutable, authored text/prices/category/stock, edit/remove,
  saved references, legacy image references preserved; private phone/IP/exact location
  absent from public projections, promotion/verification trusted-server-only.
- Stores: owner/public-private separation, categories/catalogue ordering/page boundaries,
  map/contact consent, images/gallery, canonical share URLs, search/sort loaded scope.
- Chats: room/message hierarchy, immutable participants/product linkage, private bytes,
  block checks, typing/read receipts/deletion/retention/unread/idempotency/history.
- Service Providers: existing and versioned identity/owner/draft/publication references,
  multi-service profile/work galleries, contact consent/sharing, enquiries/private
  inbox/two-way conversations, buyer-only review eligibility (no migration-granted
  review, moderation or publication privileges), cancellation/withdrawal/suspension.
- All gu/hi/en authored content, route/refresh/back behavior, stale-response rejection,
  offline retries, canonical IDs, 320/375px/large text and denied cross-account access.
- Unknown collections, orphan subcollections, references and media dependencies must
  be accounted for. A schema not in this list is not permission to omit/delete it.

## Rollback procedure (reviewable, non-destructive by default)

Before writes: record batch ID, exact before-images/hash, intended after-images/hash,
source/read versions, target preconditions, operator, checkpoint and prior Rules release.
Triggers: missing/changed source, target conflict, privacy/role leak, lost/duplicate
records, media/reference breakage, unexpected cost or unresolved write outcome.
Stop further batches/cutover; keep candidate namespaces unexposed. Preserve legacy
source as the serving baseline. Do not delete additive records to simulate rollback;
quarantine and retain them for audited review. This authorization excludes destructive
operations, including deletion of old images/documents or out-of-scope retention work.
For an approved overwritten target, restore its verified before-image ONLY when the
current revision/digest exactly matches this batch's known after-image. Divergence or
an ambiguous acknowledgement blocks rollback and requires operator reconciliation;
never overwrite concurrent work. Rules rollback uses the captured known-good release,
then rechecks guest/owner/other/Admin access. Restoring deny-all alone does not undo a
privacy leak or fix data; log incident and reconcile exact affected records separately.
No runtime toggles, IAM/secrets/billing or deployment changes are performed here.

## Local evidence and limits

New baseline migration-rehearsal-runtime.test.mjs reuses existing User/Product pure
projections and unchanged candidate Rules. Synthetic legacy Users/Products/Stores/
Chats/nested messages/Providers remain intact. Additive target creation, stable
transaction journal, replay and existing-target conflict are exercised. Timestamp
nanoseconds, bytes, reference and GeoPoint before-image restoration are compared in
REAL Firestore Emulator. Restore uses an in-memory synthetic SDK snapshot, not a
portable archive and NOT a verified staging backup. No live safety gate is satisfied
by these fixtures or synthetic claimed evidence.

Verified local commands (no skips):
- npm run test:emulator:rules: REAL 15/15 pass, including new additive/replay/conflict,
  typed before-image restore, exact-digest concurrent rollback refusal and client denial.
- npm run test:emulator:safety: 113/113 pass (includes 5 offline evidence regressions).
- npm run test:emulator:guard: 14/14 pass.
- npm run test:profile-migration: 11/11; npm run test:product-migration: 11/11 pass.
- npm run test:service-providers: 196/196 pass (including buyer-only review denials).
- git diff --check: pass. No application UI, deployment configuration, dependencies
  or Rules files changed, so unrelated browser/upload suites were not repeated.
Existing loopback Java 21/Node toolchain and candidate Rules were reused. These are
local synthetic tests, not staging backup/restore or live migration acceptance.
No staging migration or Rules change.
Next operational action stays BLOCKED until the exact missing evidence above exists.
After successful staging acceptance only, prepare a separate production migration/
Rules plan and request final owner approval before ANY production operation.
