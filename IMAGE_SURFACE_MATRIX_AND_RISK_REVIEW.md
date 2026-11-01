# OLDX Image Surface Matrix and Risk Review

**Branch:** `security-hardening-review`  
**Scope:** Static review of the current `index.html` source only.  
**No live data reads, image uploads/downloads, Firebase writes, or deployment.**

## Executive summary

OLDX has at least four distinct image-bearing product surfaces. They do not share one storage implementation, and should not be migrated as one undifferentiated feature.

| Surface | Current observed flow | Persistent destination | Main risk |
|---|---|---|---|
| Product listing photos | Browser FileReader + canvas JPEG compression | `products.images[]` in Firestore | Large Base64 documents; client-controlled image references |
| Store photos | Browser multipart upload to Cloudinary unsigned upload preset | `stores/{uid}.photoURL` | Public upload preset can be abused; client trusts returned URL |
| Profile photos | Browser FileReader + canvas JPEG compression | `users/{uid}.photoURL` and Firebase Auth profile | Large profile document; URL/data URL trust and dual-source consistency |
| Chat attachments | Browser FileReader, stores original data URL in attachment object | `chats/{chatId}/messages/{messageId}.attachment` | Message document growth, unbounded payload, image type spoofing |

This is a source-code inventory, not a penetration test or confirmation of deployed configuration.

## 1. Product listing photos

Observed source behavior:
- Product creation calls `compressImage` for each selected file and writes the resulting JPEG data URL into the `images` array in the product document.
- Product editing replaces the full image array with newly compressed data URLs.
- Product detail, listing cards, cart/saved-ad UI and other surfaces accept broad HTTP(S) and image data URL values.
- A product image can be copied into an offer/chat attachment path.

Risks:
- Base64 adds overhead and makes Firestore documents larger.
- The client controls the data URL and can bypass normal UI compression.
- Broad HTTP(S) acceptance does not establish ownership, content type, or image safety.
- Firestore document size limits can cause listing creation/update failures for sufficiently large payloads.

Recommendations:
- Keep product image storage migration separate from this review branch's current implementation.
- Set an explicit count, byte and pixel/dimension limit at the trusted server boundary.
- Decode and re-encode on a trusted backend; do not trust client MIME or compression claims.
- Strip EXIF/GPS metadata; generate approved derivatives.
- Persist opaque image IDs/references, not raw data URLs.
- Do not auto-publish legacy URLs or data URLs.

## 2. Store photos

Observed source behavior:
- The UI states a 5 MB file-size limit and previews the selected file locally.
- The browser posts the file directly to Cloudinary using an unsigned upload preset named `Oldxbazar`, under folder `oldx-stores`.
- The Cloudinary cloud name and upload preset are present in client-side source.
- The browser accepts `secure_url` from the response and saves it as `stores/{uid}.photoURL`.
- The store image validator currently accepts any HTTP(S) URL or common image data URL.

Risks:
- Unsigned upload presets are intentionally client-usable; if the preset allows broad uploads, it may be abused outside the OLDX UI.
- A client-side 5 MB check can be bypassed.
- Saving a returned URL does not prove that the asset is owned by the authenticated store owner or has been moderated.
- Accepting arbitrary HTTP URLs permits insecure image delivery.

Recommendations:
- Inspect the Cloudinary preset's actual restrictions and usage limits in the Cloudinary account before changing it. Do not expose or request API secrets in chat.
- Prefer a trusted server-issued, short-lived upload signature if the provider and backend are approved.
- Enforce file size, allowed formats, dimensions, folder, transformations and quotas at the provider/trusted boundary.
- Save an opaque provider asset identifier and a canonical HTTPS delivery URL after validation.
- Restrict rendering to a precise approved hostname and expected Cloudinary delivery path; HTTPS alone is insufficient.
- Add an owner-only replacement/deletion workflow and cleanup policy.

No Cloudinary settings were read or changed during this source review.

## 3. Profile photos

Observed source behavior:
- Profile edit reads the selected image into the browser, draws it to a canvas and stores a JPEG data URL.
- The resulting `photoURL` is written to the signed-in user's Firestore document and used to update Firebase Auth profile data.
- User sync paths also copy `user.photoURL` into the Firestore user document.

Risks:
- A Base64 profile image can inflate a user document and may create write failures.
- Two sources of truth (Firebase Auth profile and Firestore profile) can diverge.
- User profile data is subject to stricter privacy rules than public store/product imagery.
- The client-side canvas is not a security boundary.

Recommendations:
- Keep profile image references in a dedicated profile image field with a strict size/dimension cap.
- Do not place raw Base64 image data in the general user profile document.
- Define which source is authoritative and how updates/rollback synchronize Auth and Firestore.
- Profile image read access should follow the user-profile privacy policy; do not make all user documents public to display avatars.
- Add user-initiated removal and safe default avatar behavior.

## 4. Chat attachments

Observed source behavior:
- Chat attachment selection reads the original file as a data URL.
- The message stores an attachment object containing the filename, MIME type and Base64 data URL.
- The message renderer checks a MIME allowlist and a data URL pattern before displaying an image.
- Offer flows may also copy a product image into a chat attachment.

Risks:
- Client-provided MIME and filename are untrusted.
- No source-reviewed byte-size or pixel-dimension limit was found at the attachment read point.
- Large attachments can inflate message documents and cause send/read failures.
- The same image may be duplicated between product and chat records.
- A chat message's attachment must remain accessible only to authorized chat participants.

Recommendations:
- Set small, explicit chat-specific image limits, separate from product image limits.
- Validate bytes and re-encode at a trusted boundary; strip metadata.
- Store attachments as opaque private media references, not Base64 in message documents.
- Authorize every attachment read through chat participant membership.
- Define deletion behavior for message deletion, hide-for-me and delete-for-everyone; do not let a product's public image permissions leak into private chat attachments.
- If product images are copied into chat, use a controlled private attachment reference or server-side copy, not blindly trusted client payload.

## 5. Shared security requirements

All image surfaces should eventually enforce:
1. Allowed formats based on file signatures, not only extension or browser MIME.
2. Maximum raw bytes, dimensions, pixel count, image count and per-user quota.
3. Trusted decode/re-encode and metadata stripping.
4. Random opaque asset IDs; no user-controlled storage paths.
5. Private quarantine before moderation/publication.
6. Separate public derivatives from private originals.
7. Authenticated ownership checks on upload, replacement, read and deletion.
8. Rate limits and abuse monitoring.
9. Explicit retention, deletion and orphan cleanup.
10. Tests for malformed files, spoofed MIME, oversized files, SVG/HTML/polyglot payloads, redirects and unauthorized access.

## 6. Decisions required before implementation

The following decisions remain open:
- Approved backend/runtime and hosting/provider arrangement.
- Whether Cloudinary remains the store image provider and whether it can support all four surfaces.
- Billing and free-tier limits; do not upgrade Firebase Storage without explicit owner approval.
- Maximum sizes/counts/dimensions for each surface.
- Public/private media policy and moderation states.
- Whether chat attachments can be downloaded, and for how long.
- Legacy Base64 migration, retention and rollback plan.
- Orphaned asset cleanup and provider quota monitoring.

## 7. Current safety boundary

This review does not:
- access Cloudinary account settings or usage;
- call Cloudinary or Firebase endpoints;
- inspect real user/product/chat documents;
- migrate or delete images;
- alter client upload behavior;
- change Firestore or Storage Rules;
- deploy to Staging or Production.

The next safe step is to create a provider-neutral image policy and synthetic tests for per-surface limits and MIME/signature validation. Provider-specific implementation should wait until the backend and cost model are approved.
