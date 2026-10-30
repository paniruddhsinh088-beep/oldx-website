# Cloudinary Unsigned Preset and Cleanup Implementation Plan

Branch: `security-hardening-review`  
Status: recommendations and implementation design only; no Cloudinary Console or production changes.

## Confirmed facts

- The owner reports that Cloudinary preset `Oldxbazar` is **Unsigned**. This is user-confirmed configuration information, not independently verified from the Cloudinary Console.
- `index.html` uploads store photos directly from the browser to Cloudinary cloud `tfizvbzc`, preset `Oldxbazar`, with the request field `folder=oldx-stores`.
- The browser accepts any MIME type beginning with `image/` and enforces a 5 MiB client-side size limit. Client-side checks can be bypassed; they are not an account-level security boundary.
- The upload happens before the Firestore `stores/{uid}` write. If the upload succeeds but the Firestore write fails, the newly uploaded asset can be orphaned.
- The Firestore store document currently saves `photoURL`, but not Cloudinary `public_id` or `asset_id`. The previous asset identifier is therefore unavailable for reliable cleanup.
- The browser currently does not call Cloudinary's destroy API. No Cloudinary API secret should ever be added to browser code.

## Immediate unsigned-preset configuration review

Keep the existing preset active while reviewing it; disabling or renaming it may break current store-photo uploads.

In Cloudinary Console, open **Settings → Upload → Upload presets → Oldxbazar** and verify the actual available settings. Recommended policy:

1. **Allowed formats:** restrict to the formats the OLDX UI actually needs, preferably JPEG, PNG, and WebP. Include GIF only if animated store photos are intentionally supported.
2. **Maximum file size:** set a hard account-side/preset-side limit no greater than the product requirement (the current UI says 5 MiB). If Cloudinary's preset UI offers a lower maximum, use the chosen supported value consistently in the UI and backend.
3. **Folder:** configure the preset to place these uploads in `oldx-stores`. Do not rely only on a browser-supplied `folder` form field as an authorization boundary; unsigned upload parameters are controlled by the client within Cloudinary's unsigned-upload rules.
4. **Public ID / overwrite behavior:** avoid allowing the browser to choose arbitrary public IDs or overwrite existing assets. Prefer Cloudinary-generated unique IDs for the transitional unsigned flow.
5. **Moderation / abuse controls:** review any available moderation, rate/usage alerts, and upload limits. A preset alone does not provide reliable per-user quotas or prove that an uploader owns a particular OLDX account.
6. **Transformations and delivery:** use a controlled delivery/transformation policy if needed, but do not treat transformation restrictions as a substitute for upload authorization.

Cloudinary Console labels and available controls can vary by account/plan. Do not assume a control exists if it is not shown. Record the actual preset values before changing anything.

## Important security limitation

An unsigned preset is intentionally usable without a server-generated signature. Anyone who learns the cloud name and preset name may attempt uploads against it. A fixed folder value, hidden preset name, or JavaScript validation does not authenticate an OLDX user and cannot enforce a trustworthy per-user quota. Console-side format/size restrictions reduce abuse impact but do not make the flow equivalent to authenticated uploads.

## Recommended migration path

### Stage A — safe transitional flow

- Keep the current preset and current store-photo behavior working while preparing a replacement.
- Validate the selected file in the UI using a strict MIME allowlist and 5 MiB cap for user experience; verify actual file content and size on a trusted server before accepting it as authoritative.
- On successful upload, capture Cloudinary `public_id`, `asset_id`, `secure_url`, and resource type from the response.
- Save `photoURL`, `cloudinaryPublicId`, and optionally `cloudinaryAssetId` in `stores/{uid}` only after verifying the authenticated owner on the server / through suitable trusted controls.
- If the Firestore save fails after upload, enqueue or invoke a trusted cleanup operation for the newly created asset. Do not call the Cloudinary destroy endpoint directly from the browser.
- For existing store documents that only contain `photoURL`, leave the current image intact. Do not guess a public ID from a URL and do not bulk-delete assets.

### Stage B — signed upload service

- Add a trusted backend endpoint (for example, a Firebase Cloud Function) requiring a valid Firebase ID token.
- Verify the token and derive the owner UID on the server; never trust a UID supplied by the browser.
- Issue a narrowly scoped Cloudinary signature for a single store-photo upload, with server-controlled folder, timestamp, unique public ID, allowed format/size policy, and overwrite disabled.
- Keep Cloudinary API Secret exclusively in backend secret configuration.
- Update the browser to request signed parameters and upload using them. Keep the existing preview, save flow, and public `photoURL` behavior.
- Migrate only after the signed flow is tested. Retire the unsigned preset only after no deployed client depends on it and rollback is prepared.

### Stage C — replacement and account-deletion cleanup

- When replacing a store photo, retain the previous public ID until the new upload and Firestore write both succeed.
- Then call a backend cleanup endpoint/task with the store UID and asset identifier. The backend must read the store record, verify ownership, and delete only the previous recorded asset.
- Make cleanup idempotent and retryable. Record a cleanup status or queue task so transient failures do not lose track of old assets.
- During account deletion, enqueue cleanup for the recorded store asset before deleting the identifying store record. Do not delete shared or unowned assets.
- Add a reconciliation report for legacy store documents with a `photoURL` but no `cloudinaryPublicId`; resolve these manually or through trusted Cloudinary inventory rather than guessing.

## Required tests before rollout

- Valid JPEG/PNG/WebP under the size limit uploads and displays correctly.
- Unsupported file type and oversized file are rejected.
- A forged client MIME type does not bypass server-side content validation.
- Unauthenticated user cannot obtain signed upload parameters.
- User A cannot request deletion of User B's store image.
- Upload success followed by Firestore failure triggers cleanup/retry.
- Replacement saves the new image first and only then deletes the previous recorded asset.
- Cloudinary timeout, invalid response, and cleanup failure are recoverable.
- Existing stores with only `photoURL` continue to display and edit without losing their current image.
- Account deletion cleans only assets with verified ownership and supports retries.

## Explicit safety boundary

This document is a plan, not an implementation. No source code, Firestore rules/data, Cloudinary preset/assets, Firebase configuration, production website, or deployed backend was changed. No tests or deployment were performed. Obtain separate approval before changing Cloudinary Console settings or implementing/deploying backend functions.
