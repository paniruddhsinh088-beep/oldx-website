# Trusted processing and atomic release — 2 November 2026

Default-disabled repository/test source only. All SDK paths remain demo/loopback and
test-namespace locked. No actual uploads, credentials, provider calls, live Rules,
index, Vercel configuration or deployment. Legacy images and galleries are unchanged.

## Real raster processing

`trusted-image-processor.mjs` lazily loads pinned sharp 0.35.5 (Apache-2.0), only in
explicit isolated-test mode. It accepts <=3 MiB byte arrays, never files/paths/URLs.
Magic and actual decoded format must agree for JPEG/PNG/WebP; SVG/GIF/PDF and malformed/
recognized multi-page inputs fail. Native input pixel limits <=12 MP, a <=5-second
outer deadline, native timeout, cancellation and bounded per-instance concurrency
prevent an unbounded work queue. Output respects existing surface dimension/pixel/
byte limits, is re-encoded as WebP without enlargement, corrects orientation, preserves
alpha and strips EXIF/GPS/XMP/IPTC/ICC. Output is decoded again to verify metadata
absence. SHA-256 source/processed hashes bind later private journal/review records.
Native decoder crashes/security issues still require approved worker isolation and
patching; a JS timeout is not an OS sandbox or total CPU/memory proof.

No content-moderation or malware verdict is inferred from decoding. Without an injected
trusted scan, result is `awaiting-scan`, `contentScanned:false`; existing journal upload
checks cannot accept that as scanned. Test scan callbacks are synthetic authority,
not a real scanner. Actual content policy/scanning/manual-review UI remains required.

Sharp is a DEV dependency for isolated testing, not a browser/native dependency or
approved production runtime bundle. Locally tested Node 24 Linux prebuilt binaries
work with `npm install --ignore-scripts`; CI tests the same pinned package. Bundled
`@img/sharp-libvips-linux-x64` is LGPL-3.0-or-later; actual runtime redistribution/license
obligations need review. [Sharp installation](https://sharp.pixelplumbing.com/install/)
requires compatible Node/native platform support. Its [output defaults](https://sharp.pixelplumbing.com/api-output/)
strip metadata; we explicitly validate the result rather than rely on filename/MIME.
No native library is copied into the static/Capacitor web assets.

## Moderation and atomic public release

`firebase-media-release.mjs` adds inactive SDK review/release/withdraw transactions.
Moderator capability comes from current server-read private permission records;
self-moderation is denied. Reviews bind image identity, current asset revision,
processed hash, owner, moderator and review revision. Provider work/profile image
moderation can use the existing private parent/service contract; public release in
this batch supports Products/Stores only. Provider public-photo extension is not
silently added to the approved text-only v1 schema and remains further source/policy work.

Owner release requires independent current release capability AND current ownership,
suspension checks, explicitly published parent/public view, parent/photo/release
revisions, managed references, safe processed metadata and independent approved
moderation by a currently active moderator. Transactions atomically maintain public
snapshot, public references, image versions, release generation and minimal audit/
idempotency receipt. Missing/foreign/rejected/stale data fails closed; caller-supplied
owner/privilege fields are rejected. No free paid-addon moderation assumption.

Public snapshots use separate publication references. Private gallery removal cannot
silently delete the last approved published image: the public reference keeps it
attached and blocks journal deletion. An explicit owner withdrawal removes those
references. A negative/pending moderation decision atomically withdraws the affected
published scope and advances generation. Replays return stable outcomes, never new
visibility grants. Private association fields, legacy Base64/Cloudinary references
and Provider v1 fields are not migrated/rewritten.

The public read adapter with `releaseSchema` validates the publication, current parent,
current moderator/review hash/version and asset reference before the existing strict
media DTO projection. Older no-release-schema mode remains an isolated legacy fixture
contract, not an acceptable operational activation shortcut. Published references
fix the earlier private-edit availability limitation for Product/Store snapshots.

Derivative IDs are opaque metadata mappings, NOT actual Cloudinary public copies or
URLs. Real derivative creation/verification, signed proof/token implementation, cache/
revocation policy, private Chat gateway, provider/account settings and operation/rate/
credit enforcement still need implementation/approval. No public fallback for private
Chat images is introduced. Source success does not make images live.

## Chat/locale and platform evidence

Review corrected the earlier Chat helper placement: the receipt loop had been reversed
while the render loop still used descending order. The actual listener now renders
latest-35 documents chronologically; a VM test executes the real callback rather
than only matching a helper elsewhere. Dynamic first-party empty/deleted/option labels
use the existing gu/hi/en locale adapter via an O(1) explicit UI event; authored text,
auth state, credentials, routes and private messages are never translated or persisted.

Processor/SDK/crypto remain server-only and outside the browser allowlist. New web
locale event logic uses standard DOM events, relative imports and existing injected
ports, suitable for a modern Capacitor WebView. Tests cover dynamic localized labels
at 320px, credential/authored-text preservation and actual processed WebP decoding in
Chromium. These are platform/source checks, not Android device/APK/Play acceptance.
No native packaging started. Full website and Android targets remain conditional.

## Next implementation

Integrate real trusted scan/proof and private quarantine upload adapters after the
runtime/provider decisions; extend atomic release/public read to Provider work photos;
complete parent/photo publication handoffs and remaining listing/Store/Chat/Admin/
settings/error locale and UI bindings. Preserve verified buyer-review/completion and
moderation requirements independently. Runtime/identity/schema/quota/retention/media
and separate staging activation approval remain necessary. HOLD/NO-GO unchanged.
