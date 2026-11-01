# OLDX Product Image Reference Inventory and Dry-Run Classifier

**Branch:** `security-hardening-review`  
**Status:** Static source audit and synthetic-only classifier.  
**No Firebase reads, downloads, uploads, writes, Storage Rules or billing changes.**

## 1. Product image flow found in source

The reviewed `index.html` currently:

- Reads selected product image files in the browser and compresses them to JPEG data URLs.
- Stores those data URLs in the legacy `products.images` array on product creation.
- Replaces the whole image array with new data URLs when seller edits images.
- Accepts arbitrary HTTP(S) URLs and common image data URLs in product detail rendering.
- Copies the first product image into a chat offer attachment path in at least one flow.

This audit is scoped to product listing images. Profile photos, store photos and chat attachments have separate upload/read paths and require separate reviews. The code also references a Cloudinary upload for store photos; this does not establish that product listing images use Cloudinary.

## 2. Why URL syntax is not image approval

A syntactically valid URL does not prove:
- that the object belongs to OLDX or the seller;
- that it is an image rather than HTML or another content type;
- that its content is safe, intact or within size/dimension limits;
- that the listing is approved for publication.

Even a URL hosted on a known provider is only a candidate for manual/ownership review. The classifier must never label it as approved.

## 3. Synthetic dry-run classifier

`scripts/classify-product-image-references.mjs` classifies each supplied value without fetching or decoding it:

| Classification | Meaning |
|---|---|
| `legacy_data_url` | Looks like a supported base64 image data URL; bytes are not validated |
| `approved_host_candidate` | HTTPS URL on a small known-host candidate list; ownership and content still unverified |
| `external_https_review` | Other HTTPS URL; requires review |
| `insecure_http_review` | HTTP URL; insecure transport, never auto-approved |
| `invalid_reference` | Unsupported, malformed or non-string value |

The report contains aggregate counts and per-index classifications only. It does not echo data URLs, full URLs, filenames or image contents. It has no network, Firebase, filesystem, environment-variable or credential access.

The known-host list is inherited from the earlier public projection proposal:
- `firebasestorage.googleapis.com`
- `res.cloudinary.com`
- `lh3.googleusercontent.com`

This is a triage allowlist only, not a publication allowlist. Redirects, ownership, object ACLs, MIME signatures, actual bytes and seller rights remain unverified.

## 4. Safety limits

- Input must be a local in-memory array supplied by the caller.
- Process at most 10,000 references per invocation; report truncation.
- Do not print or return original values.
- Do not fetch URLs or decode base64 payloads.
- Do not follow redirects or inspect remote response headers.
- Do not modify Firestore or Storage.
- Do not run against production or staging data.

## 5. Future live dry-run requirements

A separate, explicitly approved tool would be needed to inspect actual legacy records. Before that:
- define the exact staging-only project and collection scope;
- use a read-only identity and deny all writes;
- fetch only the minimum metadata needed;
- avoid logging image payloads, phone numbers, IPs or exact coordinates;
- rate-limit and paginate;
- store only aggregate counts and opaque document identifiers where necessary;
- obtain owner approval before any real staging scan.

No live scan is authorized by this document.

## 6. Implementation gate

Do not change product upload UI or Firebase Rules until the storage provider/runtime, billing, image count/size limits, moderation lifecycle, seller ownership, retention, rollback and chat attachment architecture are approved and emulator tests exist.
