# Cloudinary Upload Security Review

Branch: `security-hardening-review`  
Scope: all tracked source files on this branch as returned by the recursive Git tree (the repository currently contains `index.html`, `admin.html`, and Markdown audit/spec files). Source inspection only.

## Verified implementation

- `index.html` initializes Firebase Storage, but neither `index.html` nor `admin.html` contains Firebase Storage upload/download/delete calls such as `ref().put()`, `putString()`, or `getDownloadURL()`.
- The only Cloudinary implementation found is the store-photo upload in `index.html`.
- The browser posts directly to `https://api.cloudinary.com/v1_1/tfizvbzc/image/upload` using upload preset `Oldxbazar` and folder `oldx-stores`.
- The client reads `secure_url` from the response and stores it in `stores/{uid}.photoURL`.
- The inspected client code does not persist Cloudinary `public_id`, `asset_id`, or another deletion identifier in the store document.
- No Cloudinary delete/destroy API call or backend cleanup implementation was found in the tracked source files.
- The repository tree inspected does not include Cloud Functions or other backend source files. This finding therefore applies to tracked files on this branch, not to any separately deployed backend or Cloudinary account configuration.

## Risks

1. **Unsigned upload preset exposure (configuration-dependent):** The browser sends an upload preset without a server-generated signature. If `Oldxbazar` is configured as an unsigned preset, anyone who discovers the cloud name and preset may be able to upload to that Cloudinary account. Whether this is exploitable depends on the preset's current Cloudinary settings, which were not accessible from repository source.
2. **Orphaned/replaced images:** Each new store photo upload obtains a new `secure_url`, then overwrites `stores/{uid}.photoURL`. The old Cloudinary asset identifier is not retained in the Firestore document, so the old asset may become orphaned.
3. **Account deletion gap:** The current client account-deletion flow does not call Cloudinary cleanup. A store image may remain after the store document or user is deleted.
4. **No safe deletion capability:** A secure Cloudinary destroy operation must not be called from the browser with an API secret. Deletion should be performed by a trusted backend after verifying ownership and the stored public ID.

## Recommended safe design (not implemented)

- Check Cloudinary's upload-preset settings in the Cloudinary console: unsigned status, allowed formats, maximum file size, allowed folders, and other restrictions. Do not put API secrets in client code.
- Prefer a trusted backend to issue narrowly scoped signed upload parameters, or keep unsigned uploads only with strict preset restrictions and abuse monitoring.
- Persist the returned `public_id` (and optionally `asset_id`) alongside `photoURL` in the store document.
- When replacing an image, retain the previous public ID until the new upload and Firestore write both succeed; then request backend deletion of the old asset. Add retry/reconciliation for failed deletion.
- For account deletion, enqueue a backend cleanup task that verifies the authenticated UID owns the store document and Cloudinary asset, deletes only the recorded asset, and records retryable status. Never derive a public ID by guessing from `secure_url`.
- Add tests for upload failure, Firestore save failure after upload, replacement, retry, unauthorized deletion, and account deletion.

## Safety boundary

No code, Firestore data, Cloudinary assets, Firebase Storage objects, upload preset settings, production configuration, or live website was changed. No deployment was performed.
