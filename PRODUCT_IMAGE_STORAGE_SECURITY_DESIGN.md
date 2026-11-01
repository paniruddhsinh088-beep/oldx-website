# OLDX Product Image Security and Storage Migration Design

**Branch:** `security-hardening-review`  
**Status:** Design and test plan only. No Firebase Storage, billing, Rules, data or runtime changes.

## 1. Current implementation findings

The current seller form compresses selected images in the browser into JPEG data URLs using a canvas and stores those strings in the Firestore `products.images` array. Product editing replaces the image array with newly compressed data URLs. Product detail, cards, saved ads, cart and offer messages consume these image values. This makes image bytes part of Firestore documents and can inflate document reads/writes and exceed Firestore document-size limits.

The current rendering paths accept broad HTTP(S) URLs and/or base64 data URLs. A URL scheme check alone does not establish that an image belongs to OLDX, is safe to publish, or is an approved storage object. Offer messages also copy the product's first image into chat attachment data.

## 2. Target architecture (not yet implemented)

- Store image bytes in a dedicated object-storage service; Firestore contains only small metadata/reference objects.
- Keep public listing image references in the sanitized public product projection only after the listing is approved for publication.
- Keep upload ownership and moderation state in a private server-controlled record.
- Do not expose arbitrary user-supplied external URLs as trusted listing images.
- Never make an entire storage bucket public just to display listing images.
- Serve images through narrowly scoped read access or short-lived signed delivery URLs, depending on the chosen provider and app architecture.
- Keep original uploads private; publish only validated, transformed derivatives.
- Remove image data URLs from new Firestore product writes once a tested upload path is deployed.

## 3. Upload contract

A future authenticated upload endpoint must:

1. Require a valid authenticated user; derive seller UID from verified auth context, never request body.
2. Enforce per-file and per-listing byte/count limits before accepting data.
3. Allow only JPEG, PNG and WebP initially; reject SVG, HTML, animated formats unless separately reviewed, and unknown types.
4. Verify file signatures/magic bytes server-side; do not trust extension or browser MIME.
5. Decode and re-encode images using a maintained image processing library to strip metadata (including EXIF/GPS), normalize orientation, and produce bounded dimensions/quality.
6. Reject corrupt, decompression-bomb, excessively large dimension and unsupported files.
7. Generate opaque random object IDs; never use user filenames as storage paths.
8. Write into a private quarantine namespace with owner UID, checksum, byte size, detected MIME, dimensions and server timestamp.
9. Rate-limit uploads and enforce quotas per user and listing.
10. Return an opaque image ID and safe status, not arbitrary storage credentials or public bucket paths.

No upload endpoint is selected or provisioned yet.

## 4. Publication and delivery lifecycle

Suggested state flow:

`selected locally -> uploaded/quarantined -> validated -> attached to pending listing -> approved derivative -> published reference`

- Client upload success does not imply listing publication.
- Only trusted backend logic can mark an image approved or attach it to a published listing.
- Public image reads are allowed only for approved derivatives referenced by published public listings.
- Seller can remove/replace images only for their own listing; deletion of old objects is asynchronous and must not break rollback.
- Moderation rejection or listing removal revokes public delivery.
- Signed URLs, if used, must be short-lived and scoped to one object; never persist expiring signed URLs as canonical Firestore data.

## 5. Firestore reference shape proposal

Public listing:
```js
images: [
  {
    imageId: "opaque-id",
    variant: "card",
    width: 640,
    height: 480,
    mimeType: "image/webp"
  }
]
```

Private image metadata:
```js
{
  imageId: "opaque-id",
  ownerUid: "verified-auth-uid",
  listingId: "listing-id",
  objectKey: "private-or-approved-object-key",
  status: "quarantined | approved | rejected | deleted",
  checksum: "server-computed",
  byteSize: 12345,
  detectedMimeType: "image/jpeg",
  createdAt: "server timestamp"
}
```

These are conceptual examples, not deployable rules or a final schema. Do not expose `objectKey`, owner metadata, checksum or moderation fields in public listing documents.

## 6. Legacy migration policy

- Never copy data URLs into the new public projection.
- Never bulk-fetch or rewrite live product documents as a preparation step.
- A future dry run may count and classify legacy image values without downloading image bodies or writing data.
- Data URLs should be treated as legacy inline bytes and excluded from the public projection until an explicitly approved migration can safely decode, validate, re-encode and upload them.
- Existing HTTP(S) URLs are not automatically trusted. Classify them by exact approved host and ownership/authorization; unknown external URLs remain unpublished pending review.
- Preserve original legacy data during any future migration until checksums, object counts, visual spot checks, rollback and retention rules are approved.
- No legacy image conversion or cleanup is authorized by this document.

## 7. UI compatibility and user experience

The future client should keep the same familiar flow: choose photos, preview them, show upload progress, allow removal/reordering, and show a clear retry message. A listing must not silently publish without its required images. On slow connections, upload sequentially or with a small bounded concurrency, preserve the draft, and retry failed objects without duplicating successful uploads.

Product cards and details should consume a normalized image view model and use a neutral placeholder when an image is unavailable. Chat offer attachments should reference a validated image or use a separate bounded chat attachment upload path; do not duplicate full product image data into chat messages.

## 8. Required emulator/unit/integration tests

- Unauthenticated upload rejected; UID spoofing rejected.
- Wrong owner cannot attach, replace, delete or read private upload metadata.
- File extension/MIME mismatch and invalid magic bytes rejected.
- SVG/HTML, corrupt, oversized, excessive-dimension and decompression-bomb samples rejected.
- EXIF/GPS metadata removed from public derivatives.
- Per-file, per-listing and per-user quotas enforced.
- Object keys are opaque and cannot be selected by caller.
- Quarantined/rejected images are not publicly readable.
- Only approved derivatives attached to published listing can be delivered.
- Listing unpublish/reject revokes public delivery.
- Signed URL expiry and object scoping verified if signed URLs are selected.
- Legacy data URLs and unapproved external URLs are excluded from public projection.
- UI handles progress, retry, missing images, removal and offline interruption.
- Chat does not copy unbounded image data into Firestore messages.

## 9. Decisions required before implementation

1. Choose storage provider/runtime and confirm cost/billing implications.
2. Agree image count and byte/dimension limits.
3. Decide whether external image URLs are disallowed entirely or allowed only for a reviewed allowlist.
4. Define moderation and retention/deletion policy.
5. Approve how legacy inline data images are migrated or retired.
6. Approve chat attachment storage behavior.

Until these decisions and emulator tests are complete, keep Firestore deny-all in Staging and do not change Firebase Storage or Production.
