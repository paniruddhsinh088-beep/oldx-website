# Inbox Read-Amplification Reduction Contract

Status: design and synthetic policy only. No Firestore schema, rules, indexes, functions, API, client UI, or live data changed.

## Current source finding

The current inbox code loads every chat document for a user, then fetches the full message history for each chat to identify the latest message and count unread messages. The global unread badge listener also subscribes to all matching chat rooms and starts a message query for each room. This is an N+1 read pattern whose work grows with the user's total chat and message history.

## Target read model

Introduce a server-maintained, participant-scoped conversation summary only after the owner approves the backend and migration:

`users/{uid}/inboxSummaries/{chatId}`

Proposed fields (all server-written):
- `chatId`: opaque conversation identifier.
- `participantUids`: exactly the two authorized participants; no client-controlled membership.
- `lastMessageAt`: server timestamp.
- `lastMessagePreview`: bounded, text-only preview with sensitive content policy applied.
- `lastMessageSenderUid`: sender UID.
- `unreadCount`: non-negative integer for this recipient, maintained atomically by trusted backend logic.
- `updatedAt`: server timestamp.
- `schemaVersion`: explicit integer.

The inbox queries only the caller's summary collection, ordered by `lastMessageAt desc`, with a small page limit and cursor pagination. The unread badge reads a trusted aggregate or the bounded summary page; it must not scan message documents.

## Message write transaction

A trusted message-send operation must atomically:
1. Authenticate the sender and verify membership in the conversation.
2. Validate message size/type and enforce rate/abuse policy.
3. Create the message with server timestamp and immutable sender UID.
4. Update each participant's summary and unread count in the same transaction or an idempotent, recoverable server workflow.
5. Set the sender's own unread count to zero or preserve its existing state according to an explicit product decision.
6. Emit notifications only after durable commit; notification delivery must be idempotent and must not affect message persistence.

Client writes to summaries, unread counters, membership, last-message metadata, and notification state must be denied. Message edits/deletes, read receipts, blocked users, deleted accounts, and group chats require separate explicit policy.

## Pagination and consistency

- Initial page limit proposal: 20 conversation summaries; maximum page size: 30. These are draft values and require product/owner approval.
- Use stable ordering: `lastMessageAt desc, chatId asc` (or an equivalent unique tie-breaker).
- Use Firestore cursor pagination; never use offsets.
- A realtime listener, if retained, must be scoped to the first bounded page only.
- Prevent duplicate rows when a conversation changes while paging; deduplicate by chatId and allow a refresh to reconcile ordering.
- Summary updates and unread counters must be idempotent under retries and concurrent messages.
- A summary is a derived index, not the source of truth. Messages remain canonical; provide a bounded reconciliation job design before rollout.

## Privacy and authorization

- A user may read only summaries belonging to their own UID.
- The summary must contain only fields needed to render the inbox.
- No phone number, exact location, private product fields, auth claims, or other participant private profile fields are copied into summaries.
- Do not trust participant UID, unread count, preview, timestamp, or role supplied by the browser.
- Admin and support access is excluded from this user-scoped design.
- Staging Firestore remains deny-all until collection-specific rules, emulator tests, and owner approval are complete.

## Migration and rollout

1. Inventory existing chat/message shapes and legacy clients without reading production user records.
2. Build a synthetic-only migration transform and reconciliation tests.
3. Add explicit rules and emulator tests in an isolated demo project.
4. Deploy backend and rules only after owner approval; keep old reads available during a controlled compatibility period if safe.
5. Backfill summaries using a bounded, resumable, idempotent job with dry-run counts first.
6. Compare summary counts against canonical messages using synthetic/staging data; do not copy Production data into Staging.
7. Switch inbox UI behind a feature flag only after parity checks.
8. Monitor Firestore reads per inbox open, p50/p95 load time, summary drift, and failed writes; provide rollback to previous UI path without opening broader data access.

## Acceptance criteria

- Inbox initial load reads at most one bounded page of summaries, not all messages.
- Opening the inbox causes no per-conversation message-history query fan-out.
- Unread badge does not scan all message documents.
- Client cannot write trusted summaries or counters.
- Concurrent message sends do not lose unread increments.
- Read/unread transitions are idempotent and reconcile correctly.
- Per-user reads remain isolated and pagination is stable.
- Security Rules tests remain deny-all until separately approved.

## Explicit non-goals

This document does not authorize or implement Firestore schema changes, rules, indexes, data migration, backend runtime, notifications, user data access, secrets, IAM, billing, or any deployment.
