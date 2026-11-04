# Product ownership Rules proposal — 4 November 2026

**UNACTIVATED; no live/staging deployment, data or settings changed. HOLD/NO-GO.**
Baseline is `ae7765062e3a26ce38339ed3cb574880d3b494c4`. Owner now reports the
Preview permission-specific message, which source maps ONLY from own error code
`permission-denied` or `firestore/permission-denied`. This strongly confirms write
rejection. Reported deny-all Rules explain it, but actual deployed Rules release,
project/runtime binding and original network request were not remotely inspected.
Login success establishes Auth, not Firestore authorization. Existing checked-in
`deny-all.rules` and root Firebase config remain unchanged.

## Exact legacy path and payload

`auth.onAuthStateChanged` sets `window.currentUser`. `handleFinalAdSubmit` checks
that object; native forms require fields/photo. It optionally fetches public IP,
reads the wizard values, and compresses original file(s) into max-800px JPEG/Base64
via FileReader/canvas. Thumbnail enhancement is preview, not cloud upload. No
Cloudinary call or new signed transport is used in this Product submission.

`db.collection('products').add(adData)` writes an auto-ID document with sellerUid,
sellerName, userIp, category, subCategory, title, desc, basePrice, mrpPrice,
discountPercent, finalPriceStr, phone, extraDetails {brand,model,type}, coords,
location, state, images[], isFeatured, isShopVerified, isSold=false and createdAt
server timestamp. There is NO explicit private/public status, revision, media approval
or immutable idempotency key. The trusted publication adapter is not connected.
Error maps to the new safe message; no success is shown before acknowledged add().
A client UID field alone is not ownership enforcement. Opening legacy public reads
would also expose phone/IP/exact coordinates. Never grant global authenticated
writes, let clients grant featured/verified flags, or treat this payload as a safe
public document. Changing Rules alone cannot securely complete this legacy flow.

## Concrete least-privilege alternative (proposal, not new approved runtime)

Recommended launch architecture remains existing trusted server-mediated private
write/public projection contracts with deny-all clients. For an explicitly approved
PRIVATE client-draft rehearsal only, prepared candidate:
`tests/firestore-emulator/product-owner-drafts.candidate.rules`.

It grants eligible authenticated owners bounded CRUD-equivalent access to proposed
`stagingProductDrafts_v1`, NOT legacy `products`: owner-only get/list (sellerUid query,
limit 1–20), create with timestamp/revision 1, revisioned edit and withdrawal.
Trusted `stagingProductActors_v1/{uid}` must independently have canWrite=true and
suspended=false; clients cannot create/change eligibility, roles or moderation.
Owner/createdAt immutable; revision must advance exactly one; exact bounded schema,
nonnegative finite bounded price and server update time required. Unknown fields,
Base64, private contacts/IP/GPS, published status, badges/roles are rejected.
Physical delete is denied even to owner: use withdrawal, then trusted audited
photo/reference/retention cleanup before any separately approved hard deletion.
Other users, guests and admin-like claims cannot bypass ownership. All unrelated
collections/public projections remain denied. No overlap with existing candidate
Rules or approved opaque Provider identity mapping.

This intentionally does NOT publish an ad, attach photos or make browsing work.
There is no allow rule for public publication. It is not a drop-in replacement for
current Post Now; the legacy payload fails this schema. A trusted publish command
must independently verify actor/ownership/eligibility, expected revision, mandatory
approved photo association, publication permission, idempotency and atomic audit/
public projection. Withdrawal must atomically revoke public visibility and media.
Avoid activating this alternative if the existing server-only path can be completed.

## JPEG/Base64 size risk

Firestore document limit is 1,048,576 bytes including fields/metadata. Base64 alone
uses `4 * ceil(binaryBytes/3)` ASCII bytes plus a 23-byte JPEG data-URL prefix per
image. Four 200 KiB JPEGs create **1,092,364 image-text bytes**, already too large
before names/descriptions/other fields. An 800px dimension limit and JPEG quality
0.7 do not guarantee an overall byte bound. Actual failed request size is unknown;
this is a verified design risk, not the cause of the now-observed permission error.

Private candidate rejects all image bytes. Future approved UI should preserve
legacy display, use trusted managed image IDs/parent associations and bounded byte/
count reservations. Do not migrate/delete legacy Base64/Cloudinary images here.
No client-supplied moderation or image ownership proof is sufficient.

## Isolated evidence and execution boundary

Prepared six actual Rules Emulator cases: allowed owner create/get/bounded query;
cross-user/guest/admin-claim denials; revision/time/ownership mutation and withdrawal;
malformed/oversized/privileged payload rejection; legacy/public namespace denial;
trusted eligibility/suspension enforcement. Rules bypass is used only for local
eligibility fixtures, not as proof of app authorization.

Run `npm run test:product-drafts:rules` ONLY through the new hardcoded demo project
`demo-oldx-product-drafts`, config `firebase.product-drafts-emulator.json`, loopback
127.0.0.1:8086. Existing runner refuses real projects, remote hosts and CLI overrides.
A test-only Review CI step is prepared for the future approved push.
Local guard/deployment/existing feedback checks **22/22 passed**; new runtime file
syntax checked. These are NOT actual Rules execution. Local JAR cache is empty and
current enforced policy does not permit official `storage.googleapis.com` download.
No mirror/bypass/download attempt; candidate is UNEXECUTED and must not be deployed
until its compilation and all six cases pass a real Emulator. No staging test claimed.

## Safe staged rollout and exact owner actions

1. Enable only the official isolated Emulator binary download via the supported
   environment network-policy mechanism, or authorize an isolated CI-only run that
   does not deploy the review branch. Do not provision paid infrastructure. Existing
   approved download permission does not mean the environment policy is configured.
2. Obtain/read the existing staging project identity, current Rules source/version
   and rollback snapshot through existing secure access; confirm synthetic-only scope.
   No chat credentials or IAM/secret changes. Preserve deny-all while reviewing.
3. Choose server-mediated writes (recommended) versus this private-draft alternative;
   approve exact schema/eligibility initialization, photo/moderation/privacy/retention
   policy and runtime binding separately. Do not seed actors or deploy Rules yet.
4. Verify owner/other-owner/guest/suspended cases, malformed data, bytes/counts,
   idempotent unknown-outcome handling, publication/withdrawal/media atomicity, plus
   gu/hi/en authored Unicode and mobile logout/refresh. Then approve exact staging
   artifact/data manifest and rollback before operational changes. First acceptance
   is private drafts; actual public publish requires trusted media/publication gates.
5. Rollback: disable affected runtime gate, restore captured deny-all release and
   previous binding via authorized operator; verify denials. Do not enable a legacy
   broad-read/write fallback. Any exact synthetic cleanup needs separate authorization.

No push is performed: branch auto-deployment is enabled, and current scope forbids
deployment; the previous one-commit Preview approval covered only ae77650. Keep this
as a local reviewable checkpoint until isolated testing/deployment scope is resolved.
No CI result for this new candidate exists. Prior green CI does not validate it.
