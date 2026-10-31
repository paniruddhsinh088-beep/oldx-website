# OLDX Account Deletion and Privacy Lifecycle — Implementation Contract

**Branch:** `security-hardening-review`  
**Status:** Design and source inventory only. No account data changed; no deletion code deployed.  
**Production boundary:** Do not alter Production V13, Firebase project `oldx-1c983`, or `main`.

## 1. Current implementation confirmed

The current `confirmDeleteAccount()` in `index.html`:
1. Reads `auth.currentUser`.
2. Queries `products` where `sellerUid == uid`.
3. Deletes all matching products and `users/{uid}` in one Firestore batch.
4. Commits the batch.
5. Calls Firebase Auth `user.delete()`.
6. On `auth/requires-recent-login`, shows a re-login message only after Firestore data has already been deleted.

This ordering is unsafe: authentication deletion can fail after irreversible Firestore deletion. The UI also displays raw `error.message`. The single batch may exceed Firestore write limits for prolific sellers.

## 2. Required user-facing experience

Keep the flow simple:
- Account settings → Delete account.
- Explain what will be deleted, what may be retained, and the expected processing status before confirmation.
- Reauthenticate before creating a deletion task or deleting any user data.
- Show a clear request status: `Requested`, `Processing`, `Action required`, `Completed`, or `On hold`.
- If processing pauses, provide a safe retry/resume path; do not ask the user to repeat a destructive operation.
- Do not claim completion until all required stages have been verified.

## 3. Trusted resumable deletion workflow

Use an owner-approved trusted backend, not browser batch deletion.

### Request phase
1. Require a fresh Firebase authentication session; complete provider-appropriate reauthentication first.
2. Call a server endpoint with a verified ID token. The server derives UID from the token; never trust a request-body UID.
3. Create an idempotent deletion task keyed by UID/task ID, recording request timestamp and policy version.
4. Set a deletion-pending state that prevents new listings, store edits, and new chat sends where policy requires, without locking the user out of status/recovery information.
5. Return a request ID and status only after durable task creation.

### Worker phase
Process bounded, retryable stages with checkpoints:
1. Enumerate user-owned product documents in pages; quarantine or delete according to the published policy.
2. Enumerate user-owned store and profile documents.
3. Enumerate Storage objects only from verified owner-scoped paths; never delete arbitrary paths supplied by a client.
4. Process chat membership and messages under the shared-record policy below.
5. Clean up saved-ad references, private settings, push tokens, and other discovered UID references.
6. Remove legacy `users/{uid}` only after dependent data migration/cleanup is complete.
7. Delete Firebase Auth identity at the final approved stage, after fresh-auth proof and recoverable task state.
8. Mark task completed only after postcondition checks succeed.

Each stage must be idempotent. Use bounded pages/chunks, checkpoint cursors, retry counts, safe error categories, and a dead-letter/manual-review state. Never log message bodies, phone numbers, addresses, tokens, or uploaded file contents.

## 4. Shared data policy decisions required

Do not blindly delete shared conversation records when one participant deletes their account.

- **Chat rooms:** remove the departing UID from discoverable user-facing indexes only if the product model supports it; preserve the other participant's access to their own lawful conversation history.
- **Messages:** decide whether to retain message content for the remaining participant, anonymize sender display, or delete content under a defined policy. Do not silently rewrite evidence or misrepresent authorship.
- **Attachments:** define separate deletion/retention rules and remove only verified owner-owned objects when policy permits.
- **Block lists:** remove references to the deleted UID from other users' block lists only through a trusted bounded worker; do not expose private block lists to chat participants.
- **Stores:** decide whether store pages become unavailable immediately or are retained briefly for transaction/support continuity.
- **Audit/legal evidence:** keep only the minimum lawful record, with purpose, access controls, retention deadline, and legal-hold override. Never retain everything by default.

These policy choices require owner approval and legal/privacy review before implementation.

## 5. Data inventory still required

Before implementation, inspect all client and backend references for:
- `products.sellerUid`
- `users/{uid}` and `blockedUsers`
- `stores/{uid}`
- `chats.participants` and nested `messages`
- saved ads and recently viewed local caches
- push notification tokens/subscriptions
- Cloudinary or Firebase Storage upload paths
- profile photos and store images
- Admin audit events and moderation evidence
- any analytics, traffic, contact, or support records keyed by UID

Local browser storage should be cleared on the user's device at sign-out/deletion completion, but remote cleanup must not assume access to every device.

## 6. Privacy and security requirements

- Separate public profile fields from private account/contact fields.
- Collect only fields needed for the marketplace feature.
- Avoid storing client-supplied IP as verified identity or security evidence.
- Restrict private data to the owner and narrowly authorized server workflows.
- Use explicit purpose and retention periods for audit/evidence data.
- Support legal hold with reason, approver, scope, and review/expiry date.
- Encrypt secrets and keep service credentials out of browser code and Git.
- Return generic user-facing errors; keep structured internal error codes without personal payloads.
- Rate-limit deletion requests and prevent duplicate tasks.
- Require an owner-approved support/recovery path for accidental requests or partial failure.

## 7. Emulator and backend acceptance tests

1. Reauthentication failure creates no deletion task and deletes no data.
2. Missing/invalid token cannot create a task.
3. A caller cannot submit another UID to delete.
4. Repeated request is idempotent and returns the existing task.
5. Worker can resume after failure at every stage without duplicate damage.
6. Large seller inventory is processed in bounded chunks.
7. Storage cleanup cannot cross owner path boundaries.
8. Other chat participant's allowed history remains accessible under the approved policy.
9. Block list cleanup does not expose private lists.
10. Legal hold pauses only scoped data and records a reason.
11. Auth deletion failure does not falsely mark task completed.
12. Completion status is withheld until postcondition checks pass.
13. Logs contain no message bodies, contact data, auth tokens, or file contents.

## 8. Blockers — do not implement destructive code yet

- Backend runtime, region, billing and staging service identity are not yet approved.
- Storage upload paths and ownership conventions need full inventory.
- Shared chat retention/anonymization policy needs owner and legal/privacy approval.
- Store public/private field split needs owner decision.
- All UID references and cleanup dependencies need complete inventory.
- No deployable Firestore Rules or backend deletion worker currently exists.

**No changes to `confirmDeleteAccount()` are made in this commit.** This document is a safe implementation contract, not a claim that account deletion has been fixed.
