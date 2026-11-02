# Photo storage audit and inactive shared-image boundary — 2 November 2026

Repository source audit only; no live records, account settings, uploads, downloads,
provider management APIs or credentials inspected. Existing images and legacy paths
are unchanged. This is an evaluation, not provider selection or migration approval.
HOLD/NO-GO and staging deny-all remain. Service v1 remains text-only.

## Actual source paths

| Feature | Upload/edit and stored reference | Display and removal | Verified gap |
| --- | --- | --- | --- |
| Products | `index.html` `compressImage` (4860 onwards): FileReader + canvas, <=800px JPEG quality .7; creation stores Base64 data URLs in `products.images` (4952 onwards). Edit stages `currentEditingImages`, replaces `images` on save (3150–3222). | Existing image renderers accept supported data URLs and safe HTTP(S) references. Photo removal only changes the array; product deletion deletes its document. Admin deletion is also document-only. | No active product Cloudinary/Storage upload or managed remote deletion. External historical URLs have unknown provenance. Client compression is not trusted file validation. Base64 consumes document/read budget. |
| Stores | `index.html` 4234–4274 posts multipart directly to Cloudinary using a browser-visible unsigned preset and folder; stores `secure_url` in `stores/{uid}.photoURL`. Profile edit may upload a replacement. `storeStorage=firebase.storage()` at 1389 is initialized but is not an upload pipeline. | Store carousel/detail/edit preview use the URL. No managed Store image deletion/replacement cleanup found. | Unsigned abuse exposure depends on uninspected account/preset limits. Upload followed by failed Firestore save can orphan an asset; replacement does not delete the former asset. No trusted ownership ledger. |
| Service Provider profile/service photos | No active upload/storage implementation. v1 allowlisted text DTOs exclude image/contact/media fields; preview emoji/text share SVGs are not uploaded photos. | No managed photo edit/delete. | Future media remains approval-gated; do not infer that a Store adapter authorizes Service photos. |
| User profile | `index.html` 2890–2944: custom avatar FileReader/canvas 80px JPEG quality .5 to `users.photoURL`. May retain Firebase Auth/OAuth `photoURL` or older reference. Auth update changes display name only. | Profile avatar uses stored/Auth URL or external fallback. Replacement drops old reference; no owned remote-asset deletion. | Auth-provided photos are external, not assets OLDX may claim/delete. Custom avatar bytes live in Firestore. |
| Chat image attachments | `index.html` 2754–2782 reads raw files to data URLs; `sendChatMessageNow` (2844 onwards) stores `attachment` in message documents. Accepts other legacy file types too; not an image-only trusted pipeline. | Image renderer uses supported data URLs. Clearing composer only clears local attachment. Hide-for-me differs from delete-for-everyone; latter tombstones `attachment:null`. | Raw Base64/document size risk, no server decode/metadata stripping/scan or durable managed deletion. Chat participant privacy is incompatible with public image URLs. |

Account deletion around 1788–1818 does not implement a Cloudinary asset lifecycle.
Firestore's document limit and Base64 overhead are relevant constraints, not a reason
to silently migrate existing records. No evidence that an initialized Storage SDK
means these flows store files in Firebase Storage. Preserve external/data URL
compatibility and all existing images until explicit per-surface migration approval.

## Cloudinary Free evaluation (official public documentation)

[Pricing](https://cloudinary.com/pricing) lists Free Image/Video API, $0, no card,
25 monthly credits. [Billing](https://cloudinary.com/documentation/billing_and_plans)
combines transformations, storage and delivery: one credit represents 1,000
transformations, 1 GB storage or 1 GB image bandwidth; it is not 25 GB of each.
Derived assets/backups can add usage. Warnings/possible account disablement are not
an application hard spending/availability guarantee. No upgrade or card is authorized.
[Current comparison](https://cloudinary.com/pricing/compare-plans) lists a 10 MB
Free image upload ceiling; actual account/preset/format limits still need approval
and verification. Our candidate proxy limit is much smaller.

Illustrative budget only: 3,000 x .2 MB originals ~.6 GB; 40,000 x .2 MB deliveries
~8 GB; 9,000 transformations ~9 credits => ~17.6 credits before derivatives, backups,
other features and abuse. This is not a tested capacity promise. Fail closed when
quota is unknown; reserve per-user/parent/global worst-case budget and keep headroom.
Hotlink traffic can still exhaust delivery quota; a public CDN URL is not a rate limit.

[Unsigned uploads](https://cloudinary.com/documentation/client_side_uploading)
authenticate neither the OLDX actor nor ownership. A preset name in browser code is
not a secret; format/size/count restrictions alone cannot establish authorization.
Do not rotate/disable the existing preset without owner approval and a compatibility
plan. [Signed upload documentation](https://cloudinary.com/documentation/upload_images)
excludes file bytes from the signature and accepts timestamped signatures for about
one hour: an app-side short expiry does not shorten that provider replay window.
For the candidate, prefer a trusted small-byte server proxy rather than exposing a
reusable direct upload signature.

[Access controls](https://cloudinary.com/documentation/control_access_to_media)
distinguish authenticated originals AND derivatives from private originals (whose
transformed assets can be public). Signed URLs are bearer capabilities; signatures
alone do not provide immediate participant revocation. Free-account availability,
expiring delivery, CDN caching and browser referrer protections need explicit proof
before private Chat/profile use. No public-URL fallback for private content.
[Upload/delete reference](https://cloudinary.com/documentation/image_upload_api_reference)
requires trusted deletion and response validation; invalidation is asynchronous,
not proof of immediate erasure from browsers/backups. A short-lived deletion token
is not a durable owner/retention policy.

[Free-plan FAQ](https://cloudinary.com/documentation/developer_onboarding_faq_free_plan)
permits production within quota; [terms](https://cloudinary.com/tou) describe business
website/app use subject to content rights, acceptable use and applicable terms.
This is not account/legal approval or a free moderation/SLA guarantee.
[Platform moderation](https://cloudinary.com/documentation/solution_overview) can
remove content/suspend accounts; it does not replace OLDX consent, abuse reporting,
manual approval or a trusted scanner. Paid moderation add-ons are not enabled or
assumed free.

Recommendation: launch the approved text-only Service slice first. If later approved,
Cloudinary Free is a plausible shared public Product/Store image pilot because Stores
already reference it. Keep private images disabled until authenticated delivery,
revocation/retention and zero-cost runtime eligibility are proven. Existing R2/provider
comparison work remains valid; no provider decision is superseded here.

## Implemented, deliberately inactive source

`scripts/isolated-media-lifecycle.mjs` has no SDK, secret, credential initialization,
endpoint or browser import. It only runs with explicit `enabled:true` AND
`mode:'isolated-test'`, using injected mocks. It reuses existing surface/processed-image
policy and verified identity/deadline helpers. It does not implement actual Cloudinary
signing, media processing, moderation, persistence, publication or network traffic.

Upload accepts only request key/surface/parent plus bounded byte input (3 MiB or the
surface limit, whichever is smaller). The 3 MiB binary candidate leaves transport
headroom under the [Vercel 4.5 MB body limit](https://vercel.com/docs/errors/function_payload_too_large);
do not Base64-wrap it into an oversized JSON body. Actual transport/decoder CPU/memory
budget and commercial-runtime/free-tier eligibility remain unapproved.

Required trusted ports:

- `authenticate`: verified, revocation-aware actor; never body UID/role.
- `authorize`: current parent ownership/participant/suspension, rechecked after processing.
- Journal: atomic actor+surface+parent+key+SHA-256 binding, opaque image allocation,
  global/user/parent quota reservation, durable upload-attempt state and private
  asset registry. Same-key different bytes fail; concurrent/replayed ambiguous
  attempts cannot create a new asset. A sweeper needs an approved retention policy.
- Processor: actual bounded raster decoding/re-encoding, EXIF/GPS stripping and
  trusted scan; reject SVG/GIF/raw/video/PDF, malformed/oversized/pixel bombs. The
  boolean attestations are trusted-port results, never caller claims.
- Provider: server-private credentials, authenticated quarantine upload, fixed
  namespace, no remote fetch/filename URL, `overwrite:false`, verified response
  and stored asset ID. No public delivery/reference on upload acceptance.
- Journal finalization: attach quarantined asset to owner. Failed DB acknowledgement
  remains unknown; reconcile using the same journal entry, do not blindly upload
  again. No profile text/filename/token/credential logging.
- Delete: transactional owner-managed, unreferenced, unpublished lease; attachment
  writers must reject deleting leases. Revalidate parent and lease immediately before
  destroying stored asset identity. Invalidate, then journal-confirm; ambiguous
  deletion is recoverable and idempotent. Never parse legacy URLs into deletion IDs.

Publication/attachment is deliberately absent: it needs independent moderation,
reference-count/lease atomicity, approved public derivatives and publication policy.
Provider delete cannot be atomic with Firestore: a durable journal + reconciliation
is required. Quarantine/orphan cleanup, rate enforcement, decoder/scanner, actual
Cloudinary client, signed response verification and operational quota monitoring are
interfaces, NOT completed live security controls. Keep all media execution disabled.

## Owner gates and next batch

Approve provider/account plan eligibility and terms, actual zero-cost runtime,
private credential/IAM handling, per-surface visibility/content rules and limits,
manual moderation/abuse process, metadata/privacy/retention/backup/CDN-erasure policy,
quota headroom/fail-closed behavior and managed registry/journal schema. Separately
approve any provider security setting/preset, secrets, staging test resource, Rules,
deployment and migration actions. None are authorized by this research.

Next safe media task: implement a deterministic in-memory journal reference with
atomic upload/delete/reference leases and reconciliation acceptance cases. This
would still not activate uploads or migrate legacy images. The shortest useful
launch task remains the text-only Provider staging acceptance plan under separately
approved runtime/identity/schema/role/quota/retention and deployment gates.

Verified repository hardening: shared surface-policy lookup now rejects inherited
prototype names (`__proto__`, `constructor`, `toString`) and non-string keys. This
fix applies to the policy helper; it does not replace or activate legacy upload code.
