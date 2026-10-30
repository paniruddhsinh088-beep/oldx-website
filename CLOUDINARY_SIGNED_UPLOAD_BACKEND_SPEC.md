# OLDX Signed Cloudinary Upload Backend Specification

Branch: `security-hardening-review`  
Status: design only. No backend source, secrets, Firebase configuration, Cloudinary settings, or production services changed.

## Current implementation
The branch source uploads store photos from the browser to Cloudinary cloud `tfizvbzc`, preset `Oldxbazar`, folder `oldx-stores`. It saves `secure_url` to `stores/{uid}.photoURL`, but does not persist `public_id` or `asset_id`. The picker checks `image/*` and 5 MiB in the browser; these checks are bypassable. The owner reports the preset is Unsigned; this was not independently verified in Cloudinary Console.

## Target architecture
1. Add authenticated Firebase HTTPS callable/function `createStorePhotoUpload`.
2. Verify Firebase ID token and derive UID only from the token. Never trust a client UID, folder, public ID, overwrite flag, or arbitrary Cloudinary parameters.
3. Allow JPEG, PNG, WebP (GIF only if explicitly needed), enforce <=5 MiB, and apply per-user rate limits. Treat client MIME/size as hints; verify uploaded asset metadata server-side.
4. Generate a random public ID under `oldx-stores/<uid>/`, with overwrite disabled and short-lived signed parameters. Return only cloud name, public API key, timestamp, signature, public ID, and required parameters. Never return API Secret.
5. Browser uploads using the signed parameters, then calls an authenticated confirm endpoint.
6. Backend verifies a recent upload-intent record for this UID, checks Cloudinary asset metadata (cloud, folder, public ID, resource type, format, size), then writes `photoURL`, `cloudinaryPublicId`, optional `cloudinaryAssetId`, and server timestamp to `stores/{uid}` using Admin SDK.
7. After new metadata saves successfully, queue the previous recorded asset for backend deletion. If metadata save fails, queue the new orphan for cleanup and retain the old photo.

## Cleanup worker
Only backend code may call Cloudinary destroy using API Secret stored in Firebase Secret Manager. Verify the asset is under `oldx-stores/<uid>/` and is no longer the current asset. Treat already-missing assets as success; use idempotent bounded retries. Never accept arbitrary browser delete targets or guess public IDs from URLs.

## Server-only records
`cloudinaryUploadIntents/{intentId}`: uid, purpose, publicId, createdAt, expiresAt, status.  
`cloudinaryCleanupTasks/{taskId}`: uid, publicId, createdAt, attempts, status, nextAttemptAt.  
Deny all client reads/writes to these collections.

## Compatibility and rollout
Keep `stores/{uid}.photoURL` so existing store pages continue working. Existing URL-only records must remain visible; never guess public IDs or bulk-delete legacy assets. Confirm Firebase Functions runtime and whether backend code exists outside this repository before implementation. Build and test in a non-production Firebase project first. Do not silently fall back to unsigned upload when signed upload fails. Disable the unsigned preset only after every deployed client is migrated and rollback is prepared. Production rollout requires separate explicit approval.

## Acceptance tests
- unauthenticated requests rejected;
- users cannot request/confirm/delete another user's asset;
- unsupported, oversized, mismatched content rejected;
- expired/replayed intents rejected;
- upload success plus Firestore failure queues cleanup;
- replacement saves new metadata before old deletion;
- cleanup is idempotent/retryable;
- legacy `photoURL`-only stores still render;
- API Secret never appears in client bundle, responses, logs, or Git.

## Safety boundary
Design only. No Cloud Function code, Firestore rules/data, Cloudinary preset/assets, Firebase secrets/configuration, production website, or deployment changed. No runtime tests performed.
