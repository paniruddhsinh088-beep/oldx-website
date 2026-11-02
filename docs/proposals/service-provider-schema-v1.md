# Service Provider Firestore v1 proposal — Gujarat-first, text-only

**DESIGN/REPOSITORY ONLY — UNACTIVATED.** Owner approves the Gujarat-first feature/
data design, one profile per verified owner, multi-service private drafts, explicit
authorized publication, public allowlist and no public IP/private personal data/GPS.
This concrete versioned proposal does not approve runtime paths, Rules, IAM/secrets,
Firestore region, migration, index deployment, retention, billing or staging release.
No Firebase configuration references these paths or the sibling index JSON.

## Namespace and identity

`scripts/provider-schema-v1.mjs` is the executable mapping descriptor and disabled
composition. Version is encoded in collection paths (not an extra public field).
Market `GJ` is a business scope, **not** a cloud-region choice. Existing public fields
stay compatible with profile/discovery/detail projectors. SDK tests use separate
`testProviderV1*` paths under demo/loopback guards; proposed paths cannot pass those
guards. No production-enable option exists.

| Logical role / proposed path | Document ID | Stored facts | Visibility |
| --- | --- | --- | --- |
| actors / `serviceProviderActors_v1` | verified Auth UID | uid, canWrite, suspended | Trusted private eligibility; never caller-written |
| owners / `serviceProviderOwners_v1` | verified Auth UID | providerId, ownerUid, revision, status (`draft`, `published`, `suspended`) | Private canonical owner index, one doc per owner |
| identities / `serviceProviderIdentities_v1` | opaque providerId | providerId, ownerUid | Private reverse identity reservation |
| drafts / `serviceProviderDrafts_v1` | providerId | providerId, ownerUid, revision, profile | Owner-only through trusted backend |
| permissions / `serviceProviderPermissions_v1` | Auth UID | uid, canPublish, canWithdraw, suspended | Independent trusted publication policy |
| publications / `serviceProviderPublications_v1` | providerId | providerId, ownerUid, published, services, publicationEpoch | Private canonical publication facts |
| publicViews / `serviceProviderPublic_v1` | providerId | Exact public allowlist below | Guest read through bounded trusted public port only after separate approval |
| generations / `serviceProviderGenerations_v1/current` | fixed `current` | value | Trusted monotonic dataset counter; no caller control |
| receipts / `serviceProviderReceipts_v1` | SHA-256([actorUid, operation, requestId]) | operation, actorUid, providerId, requestId, fingerprint, revision OR generation/action, auditId | Private idempotency, no draft text/token |
| audits / `serviceProviderAudit_v1` | SHA-256([operation, actorUid, requestId]) | id, operation, actorUid, providerId, requestId, from/to revision OR generation/action | Private atomic minimal audit, no draft text/token |

SDK writes attach trusted `committedAt` to private mutation records. Public view has
no commit timestamp/owner identity. Eligibility/permission initialization and trusted
commit time handling are separate approved-runtime responsibilities, never defaults
in Login, token custom claims or a browser. Current bounded IDs match existing port
contracts; nonstandard Auth UID formats need a reviewed canonical mapping.

For creation, server generates a random opaque `sp_<UUID>` candidate that contains no
UID. Generating it does not reserve/create anything. The existing transaction reads
actor, owner index, identity and draft; creates all unique owner/identity/private
records plus receipt/audit atomically only when absent and expected revision is 0.
Concurrent candidates race on the owner index; one wins. Same-key retry resolves the
existing mapping even if a new unused candidate was generated. Caller cannot choose
UID, provider ID, status, revision result, permissions or verification claims.

## Draft / public field contracts

Private `profile` currently contains id plus the editable text DTO: displayName,
city, serviceArea, services (1–12 distinct normalized strings), description (<=1200),
experienceYears (null or integer 0–80), available (boolean), languages (unique gu/hi/en).
Name/city <=80, serviceArea <=120, service label <=64; existing validators reject
markup/control characters. Author chooses the business display label; never copy
private Auth identity/phone/email to public fields automatically. Nullable experience
means unspecified, not verified zero years.

**Public allowlist only:** id, displayName, city, serviceArea, services, available,
experienceYears, description, languages, published=true, publicationEpoch. No UID,
ownerUid, IP, exact coordinates, private address/contact, phone/email, token, receipt,
audit, role, badge/ratings/review, private moderation notes or media reference. Public
text must be intentionally published and consented to; a draft's text remains private
until the separate authorized publication command. Future media/reviews need explicit
new schemas/consent/moderation policies; existing plans/features are not removed.

The injected catalog is `{version:1,stateCode:'GJ',services,localities:[{city,serviceArea}]}`.
Publication validates all service/coarse-locality relationships against that trusted
Gujarat catalog. It does not geocode or infer a region from free-form user text.
Actual reviewed taxonomy/city/locality entries and translations are still required.
Seller text is preserved; UI translation is independent gu/hi/en. Field allowlisting
is not free-text PII detection: reviewed publication/consent must also prevent
accidental private information in descriptions/business labels. No DLP or moderation
acceptance is claimed; actual privacy/moderation policy remains a runtime gate. Draft edits do not
implicitly update public data. Private draft revision and public dataset generation
are independent monotonic counters. Publish/withdraw changes canonical state, public
view/delete, generation, receipt and audit atomically; permission is independently
rechecked. Provider suspension cannot be bypassed by draft save or caller role.

## Read / bootstrap / recovery

Public ports use exact fields, immutable ID-ascending pagination, category/locality
filters, scope-bound authenticated cursors and consistent generation/canonical reads.
Stored row epoch is its publication version; the bridge establishes current snapshot
freshness before representing it as dataset epoch. Withdrawal invalidates cursors.
No full private document is fetched for browser redaction.

New `provider-owner-bootstrap.mjs` accepts only `{operation,requestId}` (both null for
initial read), derives verified owner, and transactionally reads current ownership,
identity, draft, publication/generation/permissions and at most one receipt/audit.
It allocates nothing, writes nothing and returns only an owner-private editable draft,
current revision/generation, current capabilities/publication and minimal reconciliation
outcome. No UID, tokens, fingerprint, audit IDs or private policy documents in output.
Do not feed this private DTO into public renderers; use a future approved no-store,
role/rate-protected owner endpoint and current session cancellation boundary.

Receipt `committed` proves the historic key/audit outcome, not current public visibility
or a grant to repeat with changed content. Always use current bootstrap counters;
older receipt revision/generation cannot regress them. Missing receipt is `unknown`,
not a failed/rolled-back commit: an in-flight write or expired receipt remains possible.
Retry only original key/body if available; after reload reconcile manually/current
owner state rather than silently allocating a replacement command. Receipt retention,
key reuse and suspended-account recovery policies remain unapproved.

## Index proposal / cost

[Sibling index JSON](service-provider-v1.indexes.json) proposes only current bounded
public filters: published + id; services array + published + id; coarse area +
published + id; services array + area + published + id. Owner/private/receipt/audit
access is point lookup, no unbounded private enumeration/index needed. Proposed large
private-field exemptions reduce index write/storage overhead; they are **not** access
controls. Emulator success does not prove production composite-index readiness.
Validate SDK index requirements, actual read/write budgets and storage quotas before
any separately approved index setup. One generation document is sufficient initially;
measure contention before sharding or other speculative infrastructure.

## Migration and compatibility plan — not executable authorization

1. Freeze reviewed v1 fields/catalog and fixture mappings; run pure/mock/demo Emulator
   tests, public/private diff and conflict reports using synthetic data only.
2. Do not reuse/overwrite existing `users`, `products`, `stores`, `chats` or candidate
   `serviceProviders` collections. Existing Login/Product/Store/Chat and Service hash
   routes remain. Legacy status/ID/contact formats are not assumed v1-compatible.
3. After separate approval only: inventory named staging legacy sources/fields with
   privacy-safe reporting, resolve owner/duplicate IDs, missing consent and invalid
   service/locality relationships. Never silently import private contact/IP/GPS.
4. Prepare an explicitly approved dry-run mapping with reviewed identities and new
   opaque IDs; all migrated drafts private/unpublished, no inherited roles/verification/
   reviews. No bulk script or production data access is supplied by this proposal.
5. Only after separate schema/IAM/Rules/index/runtime/staging permissions: initialize
   trusted eligibility/generation, exercise atomic owner create/draft/authorization/
   publication, compare bounded public DTOs and rollback. Keep legacy behavior/links
   until compatibility acceptance. Production migration/rollout requires separate sign-off.

Keep staging deny-all and release HOLD/NO-GO. No paid infrastructure, live Rules,
provider resources or deployment is authorized by design approval.
