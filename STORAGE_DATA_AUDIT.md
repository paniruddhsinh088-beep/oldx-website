# Storage and Attachment Data Audit

Branch: `security-hardening-review`  
Scope: source-code inspection only; no data was uploaded, deleted, migrated, or changed in Firebase/Cloudinary.

## Verified findings

1. **Firebase Storage is initialized but no Firebase Storage object operations were found in the inspected `index.html`.** The page creates `storeStorage = firebase.storage()`, but the inspected source contains no `storage.ref()`, `putString()`, `getDownloadURL()`, or Storage delete call. Initialization alone does not prove that no other repository file uses Storage; a repository-wide search is still needed.

2. **Store profile image uploads use Cloudinary.** The store-save flow sends the selected file to Cloudinary's image-upload endpoint with upload preset `Oldxbazar` and folder `oldx-stores`, then saves the returned `secure_url` as `stores/{uid}.photoURL`. Current account-deletion code does not delete this Cloudinary asset. The code excerpt inspected does not show a persisted Cloudinary public ID, so reliable deletion cannot be designed from the URL alone without checking Cloudinary response fields and existing stored documents.

3. **User profile photos are stored as data URLs in Firestore, not uploaded to Firebase Storage in the inspected flow.** The profile-photo path uses `FileReader`, an image and canvas, and stores `photoURL` on `users/{uid}`. No Storage upload was found in that path. The exact data URL encoding and size limits should be checked before migration.

4. **Product images are stored inline in Firestore product documents.** The product edit path updates the `images` array on `products/{productId}`; image compression uses browser-side `FileReader` and canvas. No Firebase Storage upload was found in the inspected product-image flow. Account deletion deletes owned product documents, which removes those inline image data from Firestore with the documents (subject to Firestore retention/backups).

5. **Chat attachments are stored inline in Firestore message documents.** The client reads files with `FileReader.readAsDataURL()` and sets `currentChatAttachment = { name, type, data }`; sent messages persist this object in `chats/{chatId}/messages/{messageId}.attachment`. Product-offer messages can also attach the product image data URL. These are not separate Storage objects. Deleting an account currently does not remove chat messages, and shared conversation retention needs an explicit product/privacy policy.

## Account-deletion implications

- The existing account-deletion flow's product-document deletion also removes the product image arrays embedded in those documents.
- The flow does not clean up Cloudinary store images. Before implementing cleanup, persist and verify the Cloudinary `public_id` (or another provider-supported deletion identifier) for each uploaded store image. Never attempt to delete Cloudinary assets by guessing identifiers from a URL.
- Profile-photo data stored in `users/{uid}.photoURL` is removed when that user document is deleted; third-party OAuth photo URLs are external assets and must not be deleted.
- Chat attachment data remains with the message documents unless a separately approved retention policy removes those messages. Do not delete shared chat history automatically as part of a user deletion without defining the impact on the other participant and legal/retention requirements.
- No Firebase Storage cleanup task is justified by the inspected `index.html` alone. Search every repository file and any deployed backend/functions before concluding that the project has no Storage objects.

## Follow-up checks before implementation

- Search the complete branch (all files, including any Cloud Functions, scripts, and older pages) for Firebase Storage and Cloudinary upload/delete usage.
- Inspect actual Firestore store documents and Cloudinary upload response shape only with authorized access; do not expose user data in audit output.
- Decide how store images should be deleted or retained, and persist provider deletion identifiers for new uploads.
- Define a chat retention policy and test account deletion with two participants.
- Keep the current account-deletion code unchanged until the full inventory and recovery strategy are reviewed.

## Safety boundary

This is a documentation-only audit. No Firebase Rules, live data, Storage objects, Cloudinary assets, production configuration, or account-deletion code were changed. No deployment was performed.

## Product upload-progress follow-up (2026-11-01)

A repository-wide Git tree inspection confirmed the branch contains no storage.rules file and no obvious Storage-specific rules/emulator test configuration. A source inspection of index.html confirmed:

- Firebase Storage compat SDK is loaded and storeStorage = firebase.storage() is initialized.
- Product create and edit paths still call compressImage() and then write Base64 data URLs into the Firestore product document images array. No resumable Storage upload task or Storage download-URL flow is present in these paths.
- The Store photo path uploads with ordinary fetch() to Cloudinary. The inspected call does not expose byte-level upload progress; it also remains a separate provider and upload path.
- The Firebase environment template includes a storageBucket configuration value, but this does not establish that the Staging bucket exists, is enabled, or has secure rules.

### Safe implementation sequence for true progress

1. Confirm the Staging Firebase project's Storage bucket is provisioned and its bucket identity is correct; do not infer it from a placeholder config.
2. Create and review restrictive Storage Rules for authenticated seller-owned product upload paths. Validate UID/path ownership, allowed content types, size ceilings, and read access separately for pending/quarantined versus approved images. Do not allow public reads of unreviewed media.
3. Add Storage Emulator tests for unauthenticated denial, cross-user write denial, invalid type/oversize denial, allowed owner upload, and read visibility before/after moderation state. Keep the Firestore deny-all fixture separate; it is not a Storage policy.
4. Implement a resumable upload task with progress events in the product create and edit flows. Keep form data intact on failure; do not replace old product images until every new upload and the Firestore metadata update succeed. Clean up only newly-created orphan objects using exact object paths.
5. Preserve compatibility for existing Base64 image arrays while the new URL/object-path format is rolled out and verified.
6. Ensure server-side image validation/moderation/quarantine controls public visibility before switching product reads to new Storage objects.
7. Test in Staging on Android/mobile Chrome and slow connections; only then propose Production rollout.

**Decision:** no product upload code or Firebase Storage Rules were changed in this follow-up. The lack of a reviewed Storage policy and unverified Staging bucket is a security blocker for implementing the new upload path now. Do not substitute a fake progress percentage or show compression progress as network upload progress.
