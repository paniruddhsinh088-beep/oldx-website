# OLDX Per-Surface Image Policy — Proposal v1

**Status:** Draft for product-owner approval. These are proposed limits, not active runtime controls.  
**Scope:** Product, Store, Profile and Chat image uploads.

## 1. Proposed client experience and server enforcement

| Surface | Files per action | Raw upload cap per file | Max dimensions | Processed target |
|---|---:|---:|---:|---:|
| Product listing | Up to 6 | 5 MB | 2048 px longest edge; 12 MP | 500 KB each |
| Store photo | 1 | 5 MB | 2048 px longest edge; 12 MP | 500 KB |
| Profile photo | 1 | 2 MB | 1024 px longest edge; 4 MP | 250 KB |
| Chat image | 1 | 3 MB | 1600 px longest edge; 8 MP | 400 KB |

These values are conservative starting points for review. They must be checked against the existing user experience, mobile network conditions, provider costs and storage limits before implementation.

## 2. Accepted formats

- Accept JPEG, PNG and WebP after inspecting file signatures and successfully decoding the content.
- Convert accepted uploads to a normalized JPEG or WebP derivative based on the chosen provider/runtime.
- Reject SVG, animated GIF, HTML, XML, PDF, archives, unknown formats and files with MIME/signature mismatch for these image-only fields.
- Never rely on `File.type`, filename extension, request Content-Type or a client-generated data URL as proof of file type.
- Do not trust client-side compression, dimensions or metadata removal.

## 3. Processing and delivery

1. Authenticate the uploader.
2. Authorize ownership of the target product/store/profile/chat.
3. Enforce per-surface file count, bytes, pixel count and dimensions before expensive processing.
4. Decode with a maintained image library in a trusted environment.
5. Re-encode to an approved raster format and strip EXIF, GPS and other metadata.
6. Store the original in private quarantine only if retention is justified; otherwise discard it after successful processing.
7. Generate an opaque asset ID and controlled derivative.
8. Apply publication/moderation policy before making product/store derivatives public.
9. Keep profile and chat media private; chat reads require current participant authorization.
10. Record audit metadata without logging raw image bytes, signed URLs or personal data.

## 4. Per-surface authorization

### Product listing
- Seller can upload/replace images only for products they own.
- Product images are public only when the product is published and moderation policy approves them.
- Legacy references are untrusted and are never automatically promoted.
- A public listing must not expose private originals or arbitrary external URLs.

### Store
- Only the authenticated store owner can replace or remove the store image.
- Public page receives only a controlled derivative.
- Store coordinates, owner contact data and image metadata must be governed independently of image visibility.

### Profile
- Only the account owner can change or remove their profile image.
- Profile images do not grant public read access to the rest of the user document.
- Define one authoritative profile image reference and a safe fallback avatar.

### Chat
- Only chat participants can read attachment metadata and media.
- Upload authorization must verify the sender is a current participant.
- Message hide/delete behavior must not accidentally leave private media publicly readable.
- Product image reuse in chat must create an authorized private reference/copy rather than copy an untrusted client URL or raw payload.

## 5. Quotas and abuse controls (proposal)

- Per-user upload rate limits and storage quotas should be enforced server-side.
- Product/store/profile/chat quotas should be independent.
- Reject zero-byte, malformed, oversized and decompression-bomb-like inputs.
- Limit decoded pixel count before full-resolution processing where the library permits.
- Use idempotency keys for retry-safe upload completion.
- Provide cleanup for abandoned quarantine objects and replaced/deleted assets.
- Monitor provider storage, transformations, bandwidth and abuse costs.

## 6. Error behavior

Use clear, nontechnical messages:
- Unsupported format: “Please choose a JPG, PNG or WebP image.”
- Too large: “This image is too large. Choose a smaller image.”
- Too many: “You can add up to 6 photos.”
- Processing failure: “We couldn't process this image. Please try another one.”
- Permission failure: “You don't have permission to change this image.”

Do not expose provider credentials, bucket names, internal storage paths, stack traces or raw backend errors.

## 7. Owner decisions still required

Before implementation, approve or adjust:
- The four proposed size/count/dimension limits.
- Accepted formats and whether animated images are needed.
- Whether original uploads are retained.
- Provider/backend choice and estimated monthly cost.
- Moderation and takedown workflow.
- Retention and deletion rules for chat media.
- Legacy image migration and rollback plan.

## 8. Explicit non-actions

This proposal does not change any upload form, client code, Cloudinary preset, Firebase Rules, database record, Storage bucket, billing plan or deployment. No live data was read.
