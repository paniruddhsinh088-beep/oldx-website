# OLDX Account Deletion Audit

Branch: security-hardening-review
Status: Findings only. No code or production data changed.

## Current implementation observed in index.html

The current confirmDeleteAccount() flow:
1. Shows a confirmation modal.
2. Reads auth.currentUser and uid.
3. Queries products where sellerUid equals uid.
4. Deletes those product documents using one Firestore batch.
5. Deletes users/{uid} in the same batch.
6. Commits the batch.
7. Calls user.delete() on Firebase Authentication.
8. Shows success and reloads.

## Risks and gaps

- **Partial deletion:** Firestore batch commits before Firebase Auth deletion. If user.delete() fails (including auth/requires-recent-login), products and user document are already deleted while the Auth account remains.
- **Reauthentication:** The code detects requires-recent-login only after destructive Firestore deletion. Reauthentication should be completed before any destructive operation.
- **New collections:** A future migration must also delete publicProfiles/{uid} and privateUsers/{uid}; they do not appear in the current batch.
- **Storage:** No Firebase Storage cleanup is present in this function. Product images or user-owned files may remain as orphaned objects. Storage paths and ownership must be inventoried before cleanup is added.
- **Related data:** Chats/messages, stores, saved references, and other user-associated records are not handled here. Their retention/deletion policy needs an explicit decision; deleting all chat history could harm the other participant or legal/audit requirements.
- **Batch limits:** Firestore batched writes have operation limits. A seller with many products may exceed a single batch's capacity; cleanup needs chunking or a trusted backend task.
- **Error reporting:** The UI displays error.message directly, which may expose internal details and is not a structured retry mechanism.
- **No resumability:** If cleanup fails midway, the user has no visible deletion status or retry workflow.

## Safer target flow (design only)

1. Require the user to reauthenticate before beginning deletion.
2. Create a trusted deletion request/task with an idempotent status.
3. Backend validates ownership and removes data in bounded chunks.
4. Backend deletes user-owned Storage objects using an explicit path inventory and ownership checks.
5. Apply a documented policy for chats, messages, stores, and audit records; do not blindly delete shared records.
6. Remove legacy users/{uid}, publicProfiles/{uid}, and privateUsers/{uid} after dependent cleanup.
7. Delete Firebase Auth account only at the correct final stage, with a recovery/admin path for partial failure.
8. Record only status, timestamps, and error categories; do not log private user data.

## Required follow-up inventory

- [ ] Inspect Firebase Storage upload paths for product images, chat attachments, profile photos, and store assets.
- [ ] Inspect stores/{uid} and any other user-owned collections.
- [ ] Determine chat/message retention behavior when one account is deleted.
- [ ] Design a trusted, resumable cleanup process.
- [ ] Test a user with zero, few, and many products.
- [ ] Test reauthentication expiry before any data is removed.
- [ ] Test failure after each cleanup stage and verify retry behavior.

## Safety boundary

This is a code audit note only. No Firebase Rules deployment, production cleanup, Storage deletion, or live website deployment is authorized.
