# OLDX Upload and Media Security Inventory

**Branch:** `security-hardening-review`  
**Status:** Static source inspection and implementation requirements only.  
**Safety:** No Cloudinary settings, Firebase Storage, secrets, user media, Rules, or deployments changed.

## 1. Store photo upload — observed implementation

Source: `index.html`, `saveStoreDetails()`.

- Browser sends the selected file directly to Cloudinary endpoint `https://api.cloudinary.com/v1_1/tfizvbzc/image/upload`.
- Client supplies unsigned preset `Oldxbazar` and folder `oldx-stores`.
- Client checks image selection before upload, but the server-side Cloudinary preset policy was not independently verified.
- Response `secure_url` is written directly to `stores/{uid}.photoURL`.
- `public_id` and `asset_id` are not persisted, so safe replacement/deletion cannot reliably identify the old asset.
- Cloudinary API Secret is not present in this browser upload snippet. Do not add it to client code.

### Risks

- If the preset is unsigned and publicly usable, an attacker may upload outside the intended app flow, subject to Cloudinary preset restrictions.
- Browser-side MIME and size checks are bypassable.
- Folder name supplied by the browser is not an authorization boundary.
- No per-user rate limit or server-confirmed ownership exists.
- Failed Firestore save can leave an orphaned Cloudinary asset.
- Replacing a photo does not show a backend cleanup process for the previous asset.

### Required target

Follow `CLOUDINARY_SIGNED_UPLOAD_BACKEND_SPEC.md`: authenticated upload intent, server-generated UID-scoped public ID, short-lived signature, server-side asset verification, Admin SDK metadata write, and idempotent cleanup queue. Keep legacy `photoURL` rendering compatible. Never silently fall back to unsigned upload.

## 2. Chat attachments — observed implementation

Source: `index.html`, `handleChatFileUpload()` and `sendChatMessageNow()`.

- Client currently accepts JPEG, PNG, GIF, WebP, MP4, PDF, DOC and DOCX MIME types.
- File is read with `FileReader.readAsDataURL()`.
- Full data URL is stored in `currentChatAttachment` and sent with the chat message document as `attachment`.
- The inspected picker code has no explicit byte-size cap.
- MIME type is taken from browser `file.type`; it is not proof of actual file contents.

### Risks

- Large data URLs can exceed Firestore document limits and create expensive reads/writes.
- MIME spoofing and malicious documents are not prevented by a browser allowlist.
- Chat message documents can become oversized and degrade inbox/message listeners.
- Data URLs duplicate encoded binary content in Firestore rather than using object storage.
- A malicious client can bypass the picker entirely and write arbitrary attachment data unless Rules/backend validation rejects it.

### Required target

- Move attachments to authenticated Storage or a trusted upload service.
- Use server-generated UID/chat-scoped object paths; derive sender UID and chat participants from verified auth and parent chat.
- Enforce file count, byte-size, allowed extension/MIME, and server-side content inspection where practical.
- Do not trust client filenames, MIME types, object paths, or declared size.
- Store only bounded metadata in Firestore: object key/path, verified content type, byte size, display filename (sanitized), and server timestamp.
- Restrict downloads to chat participants; avoid public object URLs for private messages.
- Define retention and deletion behavior for both participants and account deletion.
- Add malware scanning/quarantine for document types if supported by the chosen backend. Until then, limit accepted types rather than claiming files are safe.

## 3. Product images and other media — open inventory

This pass did not establish every product-image upload path, Cloudinary use, profile-photo path, or Firebase Storage bucket rule. Do not assume store-photo findings cover all media.

Before implementing a unified upload service, inspect:
- product creation and edit image handling;
- user profile photo changes;
- store photo replacement;
- chat attachment paths;
- any admin/moderation evidence uploads;
- existing Cloudinary folders and Firebase Storage paths.

Preserve existing product display compatibility during migration. Legacy URLs should continue rendering; do not guess Cloudinary public IDs from URLs or bulk-delete old assets.

## 4. Required tests

1. Unauthenticated upload request rejected.
2. User A cannot upload into User B's folder or confirm User B's asset.
3. Expired/replayed upload intent rejected.
4. Unsupported, oversized, or content-type-mismatched file rejected server-side.
5. Client-supplied folder, public ID, overwrite flag and UID are ignored/rejected.
6. Cloudinary API Secret never appears in browser bundle, response, logs, or Git.
7. Store metadata save failure preserves old image and schedules only verified orphan cleanup.
8. Replaced image cleanup occurs only after new metadata commit.
9. Legacy store photo URL continues to render.
10. Chat attachment upload/read is limited to chat participants.
11. Oversized attachment cannot be stored in a Firestore message document.
12. Deletion worker removes only owner-verified objects and is idempotent.
13. Account deletion pauses/resumes safely around media cleanup.

## 5. Blockers before implementation

- Confirm Cloudinary preset mode and restrictions directly in Cloudinary Console; no settings changed by this audit.
- Confirm whether Firebase Storage is used elsewhere and inventory exact paths.
- Approve backend runtime, region, billing and staging service identity.
- Decide supported chat attachment formats, maximum size and retention.
- Add upload intent/metadata/cleanup schema and server-side tests.
- Keep unsigned preset active only as needed for legacy compatibility; disable it only after all deployed clients migrate and rollback is prepared.

**No upload code was changed in this commit.** This inventory does not prove the unsigned preset is exploitable; it records the client flow and the controls that must be verified.
