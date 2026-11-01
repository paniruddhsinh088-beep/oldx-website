# Account Deletion, Data Retention and Erasure Contract

Status: source audit and design only. No user records, Firebase Auth accounts, Firestore documents, storage objects, rules, backend or deployment were changed.

## Current source finding

The current `confirmDeleteAccount()` browser flow:
1. Queries products where `sellerUid == current UID`.
2. Deletes those product documents and the user's `users/{uid}` document in one Firestore batch.
3. Calls Firebase Auth `user.delete()`.
4. Shows a success message claiming the account and all associated data were deleted.

This does not demonstrate deletion of chat messages, chat participant state, inbox summaries, stores, saved/favourite records, traffic or analytics references, image objects, moderation records, or records where the UID appears in a different field. The browser query is not a complete inventory. The batch also has Firestore write-count limits and can fail if the result set is too large. Deleting Auth after the batch can leave partial state if Auth deletion fails; deleting Auth first can also make a client-driven cleanup impossible. The current success claim is therefore too broad.

## Required deletion workflow

A future trusted backend must create an authenticated deletion request and a durable job:
- Verify the Firebase ID token and require recent reauthentication for sensitive deletion.
- Bind the request to the verified UID; ignore any client-supplied UID.
- Create a deletion job with an opaque job ID, explicit schema version, state, timestamps and idempotency key.
- Immediately revoke or restrict sessions and prevent new writes/listings/messages while deletion is pending, without destroying the ability to finish cleanup.
- Discover records through an approved UID-reference inventory, not only a single seller query.
- Process bounded pages with checkpoints; never assume one Firestore batch can delete an entire account.
- Make each step idempotent so retries do not duplicate side effects or skip work.
- Delete or anonymize each approved data class according to its retention category.
- Delete attachment objects only after reference checks and safe ownership verification.
- Reconcile orphaned objects and references; missing provider access or failed deletion must remain visible as a pending failure, not success.
- Delete the Firebase Auth identity only at a carefully chosen terminal stage after the cleanup job has durable progress and a recovery strategy.
- Return a completion receipt with only a generic state; never disclose internal records or another user's information.

## Data inventory to complete before implementation

At minimum, audit all references to a UID across:
- `users`
- `products` (seller, owner, featured/verified actor references)
- `stores`
- `chats` and nested `messages`
- chat participant state, read receipts, inbox summaries and per-user hidden-message state
- favourites, saved ads, reports, blocks and notification tokens/preferences
- profile, product, store and chat attachment objects
- support, fraud-prevention, moderation and audit records
- traffic/analytics aggregates and any external provider metadata

This is an inventory checklist, not a claim that every listed collection currently exists. Confirm actual schemas and references from source and approved data inventory before writing a cleanup job.

## Retention and privacy rules

- Delete personal data that is no longer needed for the stated purpose.
- Retain only narrowly scoped records where a documented legal, fraud-prevention, safety or dispute requirement applies.
- For retained records, minimize fields, restrict access, set a retention period and document the reason. Do not keep full chat content or precise location merely because it is convenient.
- Aggregated analytics should be genuinely de-identified; replacing a UID with a reversible token is not anonymization.
- Do not promise immediate physical erasure from backups, logs or third-party systems unless their retention and deletion behavior is verified.
- Publish a clear deletion timeline and explain any legally retained data to the user.
- Do not delete another participant's entire chat history merely because one participant deletes their account. Apply an approved anonymization/tombstone policy instead.

## Failure handling and observability

Use durable states such as `requested`, `restricted`, `processing`, `awaiting_provider`, `failed_retryable`, `completed`, and `completed_with_retention`. State transitions must be monotonic and auditable. Store a minimal operational audit event without retaining unnecessary personal content. Never mark complete while required cleanup steps are pending or unverified.

## Synthetic test requirements

- Client-supplied UID cannot change the authenticated subject.
- Duplicate deletion request is idempotent.
- A retry resumes from the last durable checkpoint.
- Page size is bounded and cursor is validated.
- Unknown collection or deletion step fails closed.
- Provider failure cannot produce a completed status.
- Pending retention records are explicitly classified and not silently erased.
- Another participant's shared chat content is not bulk-deleted by one user's request.
- Completion requires all mandatory cleanup steps to be confirmed.
- Partial failure is reported as pending/failed, never success.

## Rollout gates

Requires complete source/data reference inventory, owner-approved retention and legal policy, verified-token contract, trusted backend, provider deletion support, emulator tests, monitoring, retry/reconciliation plan, and user-facing copy. No runtime, IAM, secrets, billing, storage provider, Firebase changes, or deployment is authorized by this contract.

## Explicit non-goals

No account was deleted, no production/staging data was accessed, and no Firestore/Auth/Storage changes were made.
