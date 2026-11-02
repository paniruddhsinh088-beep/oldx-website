# Durable media journal, delivery and portable journey ports

Repository-only source, 2 November 2026. Default-disabled SDK factories require
existing demo/loopback guards and unique test namespaces. No app initialization,
provider account/client, image bytes, credential provisioning, endpoint, Rules/index
change, migration or deployment. HOLD/NO-GO remains; operational schemas unapproved.

## Durable journal and quotas

`firebase-media-journal.mjs` persists asset, operation, minimal audit and three quota
scopes in one SDK transaction. Verified identity/current actor and parent ownership,
suspension, parent revision and Provider service membership are read transactionally.
Quota documents must already be known and valid; missing/unknown/malformed limits
fail closed. They track global/actor/parent bytes and image counts plus lifetime
reservation counts. Cancel/delete refunds never reset lifetime reservations, bounding
metadata growth from reserve/cancel loops. No automatic quota reset/retention job.

Request keys bind actor/operation/body hash. IDs/nonces are server-allocated opaque
values. Registry keeps source hash, conservative reserved bytes, parent revision,
private authenticated namespace, processing metadata, reference count/revision and
bounded operation count. No raw images, filenames, source URLs, credentials or proof
tokens are logged/persisted in receipts. Replayed outcome DTOs are strictly allowlisted;
corrupt extra fields fail closed. Historical outcomes never grant present visibility.

States: reserved -> uploading -> quarantined -> attached through existing durable
reference transactions -> deleting -> deleted. A reservation can cancel only before
attempt. Attempts receive a nonce before any future provider action. Lost acknowledgements
reuse the same key/body; quota remains charged until independently verified completion
or definitive settled absence. Unknown/still-running absence is not a refund. Trusted
proof verification must be pure, repeatable across transaction retries, and bind
purpose/image/nonce/revision/public ID/source digest and actual processed bytes/metadata.
Client MIME, hash or flags alone prove nothing. There is no real verifier/decoder here.

Delete leases require no references; attachment to deleting assets fails. Actual
provider deletion is absent. Confirm/reconcile delete requires trusted settled absence,
then refunds all three quotas atomically. Private replacements use the existing
parent/photo revision transaction and preserve original galleries. New journal assets
cannot attach to a different current parent revision. Existing trusted legacy test
metadata without that new field is preserved, never claimed as automatically owned.

Aged orphan cancellation/deletion/reconciliation requires an explicit injected trusted
cleanup policy, verified asset owner identity and retention interval; it cannot erase
referenced assets or treat uncertain uploads as missing. Parent transfer/revision changes
cannot authorize new exposure. The reference implementation remains owner-scoped:
service-worker access for deleted users, worker scheduling, scanned orphan discovery,
quota reset/retention, operational rate limits and account deletion policy still need
source/approval work. No background worker or real cleanup has run.

Byte/image/lifetime limits are NOT a provider billing monitor. Runtime/ingress rate,
transformations, bandwidth, storage backups and provider credits still require an
approved zero-cost fail-closed operational policy. One global quota document deliberately
favors simple small-launch boundedness; measure contention before sharding/scaling.

## Public images and private delivery

`firebase-media-delivery-read.mjs` builds bounded atomic Product/Store snapshots from
trusted private parent/public view, current seller eligibility/Store publication,
private media association and <=6 registry documents. No browser-side filtering of
legacy private collections. `media-delivery-contract.mjs` emits only opaque image/
approved-derivative/version DTOs after matching parent publication and photo revisions,
current references, safe processed raster metadata and explicit trusted public release.
Upload success never approves publication. Malformed, withdrawn, stale or unapproved
images fail closed. Public release metadata is synthetic authority in tests; the
moderation/consent/public-release writer is not implemented or approved.

Existing Base64/Cloudinary references stay unchanged and private in compatibility
records. A known host or data URL cannot bypass managed public approval. Existing
legacy UI/storage are untouched. Private photo edits may invalidate an old media
association; atomic private-vs-published image snapshot materialization remains future
work before activating public photo integration. No production image availability or
migration claim is made.

Private Chat/profile contracts use verified actor-bound opaque tokens with <=60s
expiry, private/no-store directives and participant/block/revision revalidation both
at issuance and redemption. Tokens contain no provider URL. No public fallback,
unauthenticated signed-URL delivery, byte reader, real token signer or actual trusted
Chat SDK membership snapshot is supplied. A future gateway must authenticate each
redemption, preserve no-store/private headers and revalidate revocation; returned
contract authorization is not an already-delivered image or CDN-erasure guarantee.

## Owner/buyer and marketplace source progress

The existing owner UI binding now composes one owner + buyer session lifecycle.
`enquiry-integration.mjs` is a platform-neutral default-disabled client: injected
commands/reads/ID generation, create -> fresh private read -> canonical cancellation,
loading/offline/denied/error states, session/scope abort and strict DTOs. Unknown
commands retain original key/body; selecting another Provider blocks retry until
returning to the original scope, and blocks replacement creation. Private notes are
callback-only, absent from observer/public snapshots and never persisted. Page/session
exit clears them. Page reload recovery/owned-enquiry inbox lookup still requires the
approved private repository/UI journey; there is no real production binding.

Marketplace SDK `archive` now atomically hides an owned record, advances generation,
records scoped receipt/audit and retains private text/photos. Replays are stable;
archived IDs cannot be silently edited/resurrected. No hard delete/migration or legacy
UI behavior is activated. Legacy Chat now queries latest 35 messages descending and
renders a copied window in chronological order; it no longer gets stuck at the first
35. Trusted send/receipt/privacy/media and the full Admin journey remain P0 gates.

## Android/Capacitor boundary

New browser journey logic uses no window/document/navigator/storage/fetch/Node imports;
AbortController and injected ports work in a modern WebView or Node tests. Existing
DOM binding is the WebView-specific adapter, and hosts can drive clear/setOnline/session
for native lifecycle events later. IDs rather than browser origins/routes scope data.
ID generation is injected/fails closed if secure crypto is unavailable. All server
SDK/crypto/media code stays outside the browser asset allowlist. Relative browser
imports remain bundle-compatible. Tests import business logic without browser globals,
exercise 320px UI cleanup and verify static packaging. These are compatibility checks,
not a native APK/device claim. No native packaging, plugin, signing or Android resource
was created. Real WebView/back/deep-link/lifecycle/device QA remains required.

## Next activation and implementation gates

Complete trusted processing/provider adapters and rate/billing guard, actual token/
proof verification, public release/materialization, private Chat membership gateway,
full remaining Product/Store/buyer/Chat/Admin/settings gu/hi/en UI wiring and real-device
acceptance. Owner must select runtime/identity/zero-cost eligibility, operational
schemas/indexes, role/quota/cleanup/consent/retention/media policies, then separately
approve staging resources/Rules/IAM/secrets/transport/deployment/rollback. November 7
is conditional; all agreed features remain, and no test-only slice equals full launch.
