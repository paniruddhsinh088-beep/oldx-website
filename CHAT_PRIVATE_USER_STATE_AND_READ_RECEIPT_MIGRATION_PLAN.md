# Chat Private User State and Read Receipt Migration Plan

Status: design-only. No Firestore rules, client runtime, backend runtime, existing data, staging or production environment was changed.

## Goals

Move participant-specific chat state out of shared conversation/message documents so one participant cannot overwrite or infer the other participant's private state. Preserve message history and existing user-visible behavior where it is safe to do so. Keep the implementation provider-neutral and compatible with the zero-additional-cost-first constraint.

## Current legacy fields and risks

The current client/source audit identified these shared or weakly protected patterns:

- Message `status: read` is shared, although read state belongs to the recipient.
- Message `hiddenFor: [uid, ...]` is a shared array for "delete for me".
- Parent chat documents include dynamic `typing_<uid>` fields.
- Inbox and unread indicators independently inspect message history, increasing reads and creating inconsistent counts.
- Legacy block state is stored as a user-level array and is read by other clients; its enforcement is not a trusted authorization boundary.

Do not assume that a legacy field is authoritative merely because it exists.

## Proposed version-1 data model

All paths below are proposals only and require collection-specific Rules and emulator tests before use.

### Participant state

`chats/{chatId}/userState/{uid}`

Suggested fields:

- `schemaVersion: 1`
- `lastReadMessageId: string | null`
- `lastReadSequence: integer | null` (preferred when a trusted monotonic message sequence has been introduced)
- `lastReadAt: timestamp | null` (server timestamp)
- `unreadCount: integer` (trusted/server-maintained only; never client-authoritative)
- `updatedAt: timestamp` (server timestamp)

The document ID is the owner UID. A caller may read only their own state document and only while they are a current participant in the parent chat. A caller must never read or write the other participant's state.

### Per-user hidden-message state

`chats/{chatId}/userState/{uid}/hiddenMessages/{messageId}`

Suggested fields:

- `schemaVersion: 1`
- `hiddenAt: timestamp` (server timestamp)

This replaces the shared `hiddenFor` array. A hide/unhide action changes only the caller's private state. Validate that the message belongs to the parent chat. Unhide deletes only the caller's state document. No shared message content is changed by "delete for me".

### Typing presence

Preferred separate path:

`chats/{chatId}/typing/{uid}`

Suggested fields:

- `activeUntil: timestamp` (short-lived server-controlled expiry)
- `updatedAt: timestamp` (server timestamp)

Only the owner may publish their own typing state, and only current participants may observe the minimal typing state required by the UI. Do not put dynamic `typing_<uid>` fields on the parent chat. Typing is ephemeral and must not be treated as proof of presence, delivery, or read state. Avoid a scheduled cleanup service; expired records can be ignored and opportunistically cleaned only by an approved process.

If direct Firestore Rules cannot safely enforce expiry and ownership for the intended UI, defer typing presence rather than weakening rules.

### Read receipt semantics

- Read state is per participant, not a shared message `status`.
- Only the authenticated participant's cursor may advance.
- Cursor movement is monotonic; older or duplicate updates cannot move it backwards.
- Prefer a trusted server-assigned integer sequence per chat. Do not use client clocks as ordering authority.
- A trusted backend validates membership, message existence, chat identity and sequence before updating cursor and unread summary.
- The client must not submit `unreadCount`, another UID, sender identity, or arbitrary cursor values as authoritative facts.
- If trusted backend work is not yet available, keep read receipts disabled or best-effort UI-only; do not create a client-writable security bypass.

## Access-control requirements

1. Authenticate the caller using a verified Firebase ID token on any trusted endpoint.
2. Load canonical participants from the chat document; do not trust client-supplied participants.
3. Require `request.auth.uid == {uid}` for the private state path.
4. Require current chat membership for every read/write.
5. Reject access to another participant's state, even if the caller knows the path.
6. Keep server-maintained fields (cursor, unread count, timestamps, sequence) out of arbitrary client writes.
7. Use strict field allowlists and type validation; reject unknown keys.
8. Fail closed when chat membership, state ownership, or sequence data is missing or malformed.
9. Apply block enforcement at send time independently of private state visibility.
10. Keep existing Staging Firestore rules deny-all until every required operation has been implemented and tested.

## Migration rules

### No blind conversion

- Do not convert every legacy `status: read` message into a recipient cursor. The shared value does not reliably identify who read the message or when.
- Do not trust `hiddenFor` without validating each UID against the chat's canonical participants.
- Do not copy legacy `typing_<uid>` fields into durable state. Typing is ephemeral and may be stale.
- Do not migrate legacy block arrays automatically; the block relationship migration has its own approval and reconciliation requirements.
- Do not recompute unread counts from partial message windows. The existing UI reads a bounded recent history, which is not a complete history.

### Phased, idempotent migration

**Phase 0 — inventory and dry-run only**
- Enumerate the exact legacy fields, document counts and schema variants from an approved export or emulator fixture.
- Do not read live Staging or Production data as part of this plan.
- Produce counts and anomaly categories without logging message bodies, phone numbers, attachment URLs or other personal content.

**Phase 1 — canonical chat reconciliation**
- Validate that each chat has exactly two distinct, non-empty participant UIDs and a valid product identity where required.
- Validate every message's parent chat and immutable sender identity.
- Quarantine malformed records for manual review; never guess missing ownership.

**Phase 2 — private hidden-state projection**
- For each valid legacy `hiddenFor` UID that is one of the canonical participants, plan one private hidden-state document under that UID.
- Deduplicate by (chatId, uid, messageId).
- Preserve the original legacy field during the compatibility window; do not delete it in the dry run.
- Unknown/non-participant UIDs become reconciliation exceptions, not silently discarded data.

**Phase 3 — read-state initialization**
- Initialize a new participant cursor only from trustworthy per-user evidence, if such evidence exists.
- If only shared `status: read` exists, leave the new cursor unset and use a clearly documented conservative unread reconciliation policy approved by the owner.
- Never fabricate a read timestamp or claim a message was read by a particular participant without evidence.
- Reconcile unread counts from the complete canonical message set or a trusted sequence ledger, not the last 35 messages.

**Phase 4 — client/backend cutover**
- Deploy and emulator-test the private state rules and trusted operations first in an isolated demo project.
- Release a client version that reads only the caller's private state.
- Keep legacy reads behind a temporary, explicitly versioned compatibility gate only if necessary; do not dual-write indefinitely.
- Remove legacy shared-field writes only after adoption and reconciliation gates pass.

**Phase 5 — legacy cleanup**
- Require an approved backup/export, a verified migration report, a rollback window and explicit owner approval.
- Remove old `hiddenFor`, shared read status and dynamic typing fields only after the compatibility window closes and the rollback decision is made.

## Dry-run report and checkpoint design

Each migration run should be idempotent and bounded:

- Stable run ID and schema version.
- Checkpoint by chat ID and message ID; resume from the last committed checkpoint.
- Small bounded batches with backoff and retry.
- Deterministic destination IDs so retries cannot create duplicates.
- Per-batch counts: scanned, eligible, projected, skipped, malformed and failed.
- No message body, contact details, attachment contents or raw user data in logs.
- A dry-run mode that cannot write, plus an explicit write mode that refuses to run without a separate owner-approved switch.
- Before/after reconciliation counts and a machine-readable exception report.
- Stop on unexpected schema drift, excessive failure rate or any ambiguous ownership.

## Rollback

- Keep the legacy fields intact during the initial compatibility window.
- Record exactly which destination docs were created by a migration run.
- Rollback may delete only destination documents tagged with that run ID and only after checking they have not been modified by live traffic.
- Never roll back by deleting message history.
- If clients have started depending on new state, use a forward-fix or a controlled compatibility release rather than destructive rollback.

## Required tests

- A participant can access only their own user-state document.
- A non-participant cannot read or write any participant state.
- Participant A cannot inspect or mutate participant B's hidden-message state or read cursor.
- A hidden message affects only the owner's view.
- Unhide affects only the owner's hidden-state record.
- Duplicate migration input produces one deterministic destination record.
- Non-participant IDs in legacy `hiddenFor` are reported as anomalies.
- Shared `status: read` does not create a fabricated user cursor.
- Cursor updates are monotonic and duplicate updates are idempotent.
- Client-supplied unread count, UID, timestamp or sequence cannot override trusted state.
- Typing expiry is ignored after `activeUntil`; typing never changes read state.
- Missing membership or malformed source data fails closed.

## Zero-cost-first implementation guidance

- Prefer dependency-free Node.js policy tests and the existing GitHub Actions workflow.
- Reuse the existing Firebase Emulator test setup; do not connect to live Firebase projects.
- Avoid introducing a new paid backend, database, queue, scheduled worker or migration service.
- Do not schedule recurring CI runs merely to appear continuously active; run checks on meaningful commits and manual dispatch to conserve free minutes.
- Keep any long-running AI agent optional and within an explicitly available free allowance. Do not assume continuous background execution is free.

## Explicit approval gates

This plan does not authorize:
- Live Staging or Production data reads/writes.
- Firestore Rules changes or deployment.
- Client runtime changes or a live compatibility rollout.
- Migration execution or cleanup.
- New backend runtime, IAM/service accounts, secrets, provider accounts, billing or deployment.
- Changing current deny-all Staging Firestore rules.

Each of those requires a separate owner-reviewed implementation and explicit approval.
