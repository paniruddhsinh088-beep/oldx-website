# Account Deletion Dry-Run and Reconciliation Plan

Status: design only. This document authorizes no production or staging data access, no account deletion, no object deletion, and no backend deployment.

## 1. Objective

Replace the current browser-side account deletion sequence with a durable, resumable workflow that can prove what it found, what it safely removed, what it retained, and what remains unresolved. A success message must never be shown merely because the Auth identity was deleted or a subset of Firestore documents was removed.

## 2. Safety modes

| Mode | Permitted behavior | Forbidden behavior |
|---|---|---|
| Static review | Inspect source, schema contracts and rules locally | Read live customer records |
| Synthetic dry run | Use fabricated UIDs, documents and object references in tests/emulators | Use copied production data or real identifiers |
| Staging dry run | Only after separate owner approval; read-only, approved test accounts and synthetic fixtures | Mutate data, enumerate real users or access Production |
| Staging execution | Only after separate written approval, staging-only scope and tested rollback/hold plan | Touch Production or import Production user data |
| Production execution | Separate explicit release approval and legal/privacy sign-off | Treat this document or earlier technical delegation as authorization |

The default is **no access and no mutation**. Unknown schema, inaccessible collection, permission error, timeout, missing index, unresolved object reference or ambiguous ownership must produce a blocked/incomplete result, never a guessed deletion.

## 3. Dry-run report contract

A future report may contain only:
- opaque job ID and a keyed/pseudonymous subject reference scoped to the job;
- scan start/end timestamps and policy version;
- collection/object categories scanned and bounded page counts;
- counts by action: candidate, retained, already absent, blocked, failed;
- reason codes such as `OWNER_MISMATCH`, `SHARED_RECORD`, `UNKNOWN_REFERENCE`, `RETENTION_HOLD`, `SCAN_INCOMPLETE`;
- cursor/checkpoint state and reconciliation outcome.

Never include document bodies, message text, email, phone, IP address, exact coordinates, access tokens, image bytes, signed URLs, raw object keys or full UIDs in ordinary logs/reports. A keyed digest may be used for correlation only if key management and retention are separately approved. Counts must be labelled partial when any scan is incomplete.

## 4. Inventory and reference reconciliation

The currently source-observed areas include:
- `users/{uid}` (profile, saved ads, presence and blocked-user fields);
- `products` (seller-owned listings and embedded image data);
- `stores/{uid}` (store profile, contact/location fields and Cloudinary photo URL);
- `chats/{chatId}` and nested `messages` (shared conversation records and attachments);
- `stats/traffic` (shared aggregate, not user-owned);
- browser local storage keys for guest and per-user saved ads;
- Cloudinary store images and data-URL media embedded in Firestore records.

This inventory is not exhaustive. Before a real dry run, reconcile it with the deployed schema, every client/server writer, security rules, indexes, scheduled jobs, notification providers, analytics, backups, exports and all external media providers. Do not infer ownership from a document path alone.

### Shared records

- A chat contains two participants; deleting one account must not erase the other participant's conversation or messages by default.
- User-specific visibility, receipts and account profile references should be detached or tombstoned independently.
- A product image or attachment may be referenced by more than one record. Delete an object only after a complete reference scan proves it is unreferenced and policy permits deletion.
- Global traffic statistics are shared aggregates and must not be deleted as an account-owned record.
- Saved-ad arrays and local browser state are per-user convenience data; they are not proof that the underlying product belongs to that user.

## 5. Execution design

1. Require a recently authenticated requester and bind the target UID to the authenticated subject; do not accept an arbitrary target UID from the browser.
2. Create a durable job with an idempotency key, policy version, explicit approved scope and a state of `QUEUED`.
3. Enumerate approved collections in bounded pages with stable ordering and durable cursors. Never load an unbounded collection into memory.
4. Classify each reference as user-owned, shared, retained, external, unknown or already absent.
5. Produce a dry-run summary and require a separate approval step before mutation.
6. For each approved item, apply an idempotent tombstone/detach operation first where feasible. Preserve shared records and other users' content.
7. Delete external media only after provider-specific ownership verification and a complete reference reconciliation. If provider access is unavailable, mark it unresolved; do not claim it was deleted.
8. Delete the Auth identity only after the workflow has recorded all remaining obligations and the chosen policy explicitly permits that order. Account deletion must remain resumable even if Auth deletion requires reauthentication or fails.
9. Persist checkpoints after bounded work units. Retries must not duplicate side effects.
10. Reconcile expected versus completed counts and emit a terminal state only when every required category is complete or explicitly retained under policy.

## 6. State machine

`QUEUED → SCANNING → DRY_RUN_READY → AWAITING_APPROVAL → EXECUTING → RECONCILING → COMPLETED`

Exceptional states:
- `BLOCKED`: authorization, unknown schema/reference, incomplete scan or policy ambiguity.
- `PARTIAL`: some operations completed but one or more required categories failed or remain unresolved.
- `CANCELLED`: no further work; already completed deletions are not automatically reversible.
- `RETRYABLE_FAILURE`: transient failure with checkpoint retained.

A terminal `COMPLETED` state requires all required categories to reconcile. `PARTIAL` and `BLOCKED` must never display “all data deleted”.

## 7. Retention and irreversible deletion

Before implementation, the owner must approve retention periods and exceptions for legal obligations, fraud/security investigations, financial records, abuse reports, shared chat context and backups. This document does not decide those periods.

Deletion is irreversible for many data classes. A quarantine/tombstone stage can provide a review window for eligible objects, but must not falsely promise restoration of deleted Auth accounts, overwritten messages or provider objects. Backup expiry must be described separately from primary-store deletion.

## 8. Required synthetic test cases

- Reject a target UID different from the authenticated UID.
- Reject execution without an explicit approval record and matching policy version.
- A page timeout or missing cursor prevents a complete dry-run result.
- A retry with the same idempotency key does not duplicate deletion.
- A shared chat remains available to the other participant under the approved privacy policy.
- A shared/global aggregate is never classified as user-owned.
- An object with any remaining reference is retained.
- An unknown collection/reference blocks completion.
- A report contains no raw UID, email, phone, IP, message text, exact coordinates, token or media bytes.
- A partial provider outage yields `PARTIAL`, not `COMPLETED`.
- Auth deletion failure preserves a resumable job and does not overclaim success.
- A completed scan with zero eligible records is distinguishable from a scan that never ran.

## 9. Release gates

No implementation or live execution until all are satisfied:
- owner-approved collection and provider inventory;
- owner-approved retention and deletion policy;
- documented privacy notice and user-facing confirmation;
- trusted backend and authorization design approved;
- least-privilege identity and secret handling approved;
- synthetic and emulator tests pass, including shared-data and partial-failure cases;
- staging-only dry run reviewed by the owner;
- rollback/hold, monitoring and support process approved;
- separate written approval for each environment and execution scope.

## 10. Current status

The existing frontend implementation only deletes products queried by `sellerUid`, deletes `users/{uid}`, then deletes the Auth user. It does not demonstrate cleanup of chats, stores, external media, local state or all other references. It must not be represented as deleting all associated data.

No runtime implementation is included here. No live records were read or changed. Staging Firestore rules remain deny-all. Production, Firebase configuration, Storage, Cloudinary, IAM, secrets, billing and deployments were not touched.
