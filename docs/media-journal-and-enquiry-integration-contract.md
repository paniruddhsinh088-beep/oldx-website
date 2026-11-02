# Inactive media journal and private enquiry integration contracts

Repository-only reference code, 2 November 2026. No live SDK, endpoint, image provider,
Rules/index change or schema migration. The approved Provider v1 remains text-only;
Provider photo descriptors are a proposed future extension, not new v1 document keys.

## Single-process media journal

`createInMemoryMediaJournal` is disabled by default and requires `isolated-test`.
Maps, synchronous critical sections and bounded configuration model atomic operations
in one process only. Never use it as a distributed quota/idempotency store, restart-
safe registry or production authorization service. Existing lifecycle composes it
through injected ports; it contains no network, credentials, image bytes or private
profile content. IDs are opaque and allocation collisions fail closed.

Upload request keys bind verified actor, surface, parent, source hash and worst-case
byte reservation. Parent file, global/user/parent byte, image and total ledger-entry
limits are checked together. Quarantine retains conservative reserved bytes. Reject
before upload or confirmed deletion releases capacity; receipts are retained within
the bounded model. Upload-attempt markers never expire into a new upload permit.
Unknown provider outcomes retain quota until trusted exact-public-ID/hash/size evidence
finds the asset, or definitive absence AND settled-operation proof justify rejection.
No same-key different-content/parent reuse, blind retry or URL-derived deletion ID.

One extra quarantined staging image per parent permits replacement without deleting
the current photo first; attached image counts remain within the surface cap. Atomic
replace leases bind both image revisions and the unique parent reference slot, so
old content stays referenced until the swap and only then becomes cleanup-eligible.
Reference reserve/commit uses expected image revision, parent/surface scope, unique
request key, bounded reference slots and expiry. Publication requires independent
moderation/publication attestations. `authorizeReference` must return a synchronous
current trusted proof inside the atomic section; async/unknown permission fails closed.
Deleting requires zero committed references AND no live reference reservation. A
reference cannot attach to a deleting/deleted image; concurrent commits cannot both
consume the same revision. `authorizeDelete` is independently required at deletion
lease confirmation; absence/revocation denies. Ambiguous deletion keeps quota and
blocks new references until trusted absence reconciliation. No implicit TTL erasure
of uncertain uploads/deletions. Provider calls cannot be atomic with a database.

A real repository must implement these facts in durable transactions, use fresh
parent ownership/publication/participant records, atomic attachment/reference changes
with parent revisions, durable quota/cost/rate accounting, trusted provider response
verification, reconciliation worker scheduling and approved retention/cleanup policy.
No such runtime implementation is supplied or approved here.

`preparePhotoReferences` preserves original legacy data/HTTP(S) references, returning
classification/review flags and `canDeleteRemote:false`. Managed references are opaque
IDs requiring trusted lookup. A known host is not ownership/moderation/publication
proof. Descriptors do not fetch, render, log, rewrite or migrate values. Product/Store/
Provider-profile/Provider-service bounds are proposed contracts; Service media is
not added to public/private v1 DTOs and no photo requirements are removed. Actual
legacy renderers/storage remain unchanged.

## Private Provider enquiry creation/read

`createProviderEnquiryTransaction` and HTTP `enquiry.create` are default-disabled,
transport-independent injected code. Reuse verified-operation authentication/deadline,
HTTP bounded JSON/method/content checks, current role and fail-closed atomic rate ports.
Caller supplies request key, selected Provider/service, observed discovery dataset
generation, note/timing only. No buyer/provider owner UID, role, initial status,
review permission or public/private metadata is caller-selectable.

The transaction repository MUST read a consistent fresh owner-index/identity/provider
eligibility/publication/public-view/service/global-generation graph in
`getPublishedProvider`, and return only providerId/ownerUid/published/suspended/
ownerActive/generation/services. `generation` is the current DATASET snapshot counter,
not the row's older publicationEpoch; each row's own publication must independently
match its canonical view and be no newer than that counter. Another Provider's
publication must not invalidate a fresh discovery snapshot merely because this row
was published earlier. Actor eligibility and BOTH participant block directions are
read in the same transaction. Unknown, suspended, withdrawn, wrong relationships,
self-enquiries, foreign service and stale generation are denied.

Commit one private record (`new`, revision 0, empty reply, no buyer confirmation),
unique actor/request receipt with normalized-content fingerprint, and minimal audit
atomically. Reuse canonical existing status/validation models; no competing transition
state machine. Same-key replay returns the same opaque enquiry identity only after
current participant/ownership/publication/block and receipt/audit integrity checks.
Lost acknowledgements remain unknown and require original key/body. Nothing grants
review eligibility. Response is no-store and contains only status/enquiry ID; notes,
credentials, UIDs, fingerprints and audit records stay private.

`projectProviderEnquiryRead` maps strict private records into the existing participant
DTO/model, deriving buyer/provider role from verified UID and current canonical owner.
It is a pure projector, NOT a read/authentication service. A future bounded repository
must obtain fresh actor/canonical/block/record snapshots and enforce cancellation/
freshness before returning; never accept those facts from a browser. No full private
collection queries followed by browser filtering.

Acceptance test composes existing v1 opaque draft + publication + public SDK-mock
repository + discovery + new transaction + existing private projection + withdrawal.
It includes two Providers with different row publication versions and one current
dataset generation. The enquiry repository is a serialized test fake; no actual
Firestore enquiry schema/SDK endpoint, buyer UI persistence or live messaging exists.
Durable SDK transaction/read mapping and approved schema/identity/retention remain.
