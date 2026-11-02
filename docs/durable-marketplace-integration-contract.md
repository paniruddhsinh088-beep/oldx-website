# Isolated durable launch integration boundary — 2 November 2026

All new SDK factories default disabled. They accept injected modular Firestore SDKs
only for `demo-oldx-*`, SSL-disabled `127.0.0.1` Emulator hosts and explicit unique
`testOldx*` / existing `testProvider*` namespaces. No app/credential initialization,
production/browser mode, endpoint, Rules/index deployment or live migration exists.
Test collection names are not approved operational schemas. Public API composition
is transport-independent source, never an activated route. HOLD/NO-GO remains.

## Provider enquiries

`firebase-provider-enquiry-repository.mjs` implements actual SDK transactions for
private creation and cancellation record/receipt/audit persistence. Existing command
and HTTP ports supply verified identity, JSON limits, role/rate/deadline enforcement.
Current Provider identity, owner index, eligibility/suspension, canonical publication,
strict public view, service relationship and global generation are read in the SAME
transaction. Buyer eligibility and explicit bidirectional block records are also
transactional. Missing block facts fail closed; absence is not silently permission.
Enquiry actor documents are private, proposed test facts (`uid/canEnquire/suspended`).

`provider-enquiry-lifecycle.mjs` uses the existing canonical enquiry state model for
buyer cancellation and derives participant roles from verified UID for private reads.
Read snapshots check current actor, Provider publication/owner, block state and enquiry
revision; other buyers/providers cannot see notes. Committed cancellation retries
validate scoped receipts/audit/current ownership and return the original revision.
Historical receipts do not grant current access or review eligibility. Cancellation
and reads currently deny withdrawn/blocked scopes, matching existing fail-closed
contracts; any future retained-history visibility requires an explicit privacy policy.
No real review grants, messages, contact information or persistence UI is enabled.

Actual Emulator acceptance reuses the same scenario as SDK mocks, plus a withdrawal
between staged enquiry writes and commit to exercise real transaction conflict/retry.
The discarded attempt cannot create an enquiry after the Provider is withdrawn.
Private and curated test collections both remain directly unreadable to guests under
unchanged candidate Rules. Token/IAM/real role/rate enforcement is still not deployed.

## Product and Store integration

`firebase-marketplace-repository.mjs` implements injected verified-owner writes,
opaque allocation, one Store per owner, create/update revisions and atomic private
record/public materialization/generation/receipt/audit. Only fixed bounded text,
category, availability, price, opaque Store association and private photo-reference
fields are accepted. Caller owner/IP/coordinates/phone/privilege flags are rejected.
Product Store references require the same owner and published Store for publication.
Publishing/withdrawing additionally requires a current trusted publication capability.

Private draft edits preserve the last explicit public snapshot; they do not publish
new draft text. Public queries read only curated materialized documents, validate an
exact DTO against current canonical metadata, owner eligibility and Store publication,
use fixed id ordering, <=24 results + one sentinel and scope/generation-bound cursors.
Injected cursor codecs MUST authenticate/expire their state in a future server;
acceptance uses a fixture registry, not production cursor signing/key management.
Foreign/replayed stale scopes, malformed public data and withdrawn Stores fail closed.
Every visibility mutation (including future Admin suspension/withdrawal) must bump the
same generation atomically. Indexes and all operational schemas remain unapproved.

Legacy data URL/Cloudinary/HTTP(S) photo values stay unchanged in PRIVATE draft
compatibility fields. New writes have a conservative 700 KB serialized profile cap;
oversized old data is not overwritten or migrated. Public DTOs omit raw galleries,
private owner identity, contact/GPS/IP and privileged badges. Managed public-image
release remains separate. No legacy Product/Store collection is read or changed,
and the current UI is not silently rebound to these adapters. This prepares trusted
integration; it does not certify existing mixed legacy documents as publicly safe.

## Durable photo references / remaining journal work

`firebase-photo-reference-repository.mjs` supplies atomic private asset/association/
receipt/audit transactions against trusted Product/Store/Provider parent revisions,
photo revisions, current actor ownership/suspension and service membership. It preserves
all existing parent fields/images, including Provider v1 text-only schema. Media lives
in a separate PROPOSED private association namespace. Assets must already be trusted
owner/parent/service scoped quarantine metadata; no URL proves ownership. Deleting,
foreign or stale assets cannot attach. Replacement swaps reference counts atomically;
parent edits conflict via the transaction read set. Only private associations are
created. Future readers must verify parentRevision freshness before using an association.

This is a durable REFERENCE/journal interface, not a complete durable upload journal.
The in-memory upload/quota/delete model is preserved. Durable quota reservation,
upload-attempt markers, verified provider-outcome reconciliation, retention/worker,
actual decoding/scanning/moderation, trusted public derivatives and private delivery
remain missing. Provider deletion must acquire a durable lease and read the same
asset reference document; no provider call or credential is supplied here. No media
migration, real upload or implicit Service photo publication is activated.

## Essential legacy UI / locale work

Login and Signup preserve exact password bytes rather than trimming valid credentials.
Invalid-credential/user-not-found/wrong-password feedback is unified; actual Auth
configuration and signup/reset enumeration policy still require staging acceptance.
Existing Login callbacks and marketplace functionality otherwise remain preserved.

The existing locale engine now binds first-party Search labels/placeholders, auth
labels/submit buttons/password-toggle names, input autocomplete and an explicit
44px language selector in index.html. Only marked controls change; seller content,
credentials/search input values, routes and authorization do not. Versioned async
catalog loading rejects stale completions; local preference stores only gu/hi/en.
Browser tests execute extracted actual markup without Firebase or the legacy page's
remote dependencies. They do not prove full legacy Tailwind layout, live Login,
whole-app localization or real-device QA. Other listing/Store/Chat/Admin/settings
text and dynamic error messages remain untranslated; no whole-app completion claim.

## Activation gates and next implementation

Keep Nov 7 conditional. Need exact runtime/region/zero-cost eligibility, operational
schema/index binding, real verified identity/role/quota/block policy, privacy/retention,
media provider/processing/visibility decisions, then separately approved synthetic
staging Rules/resources/IAM/secrets/transport/rollback/deployment. None is authorized.
Next source batch: durable upload quota/attempt/delete reconciliation and approved
public-image projection contracts; finish remaining essential journey locale/error
bindings and UI-port integration against the new repositories. No new demo pages.
