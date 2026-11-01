# Chat Read Receipts and Unread Consistency Contract

Status: design-only security review. No chat schema, Firestore rules, backend endpoint, notification service, client behavior, or data migration was changed.

## Current risk

The current client counts every message whose sender differs from the current user and whose status is not `read`. The inbox and global badge each independently fetch message histories. This is both expensive and ambiguous: a single message-level `status` field cannot safely represent read state for both participants, and clients can race while marking messages read.

## Required semantics

- Read state is per recipient, not a shared mutable status on the message.
- Only a conversation participant may advance their own read position.
- A participant cannot write or advance another participant's read position.
- The server validates membership and message ordering before accepting a read receipt.
- Read receipt updates are monotonic: a receipt may advance, never move backwards.
- Replaying the same receipt is idempotent.
- Unread counts are derived/maintained by trusted server logic and never accepted from the client.
- A message authored by the recipient does not increase that recipient's unread count.
- Notifications are advisory only; they do not define read state.

## Proposed data model

Per-conversation participant state (server-written):

`chats/{chatId}/participantState/{uid}`
- `lastReadMessageId`: last message the participant has acknowledged, or null.
- `lastReadAt`: server timestamp.
- `unreadCount`: non-negative server-maintained integer.
- `updatedAt`: server timestamp.
- `schemaVersion`: explicit version.

The per-user inbox summary may mirror only the caller's unread count and last activity fields. The participant state remains authoritative. Do not store one global `messages/{messageId}.status = read` value for both participants.

## Read receipt operation

A future trusted operation accepts only a conversation ID and a message ID (or a server-issued cursor). It must:
1. Authenticate the caller from a cryptographically verified Firebase ID token.
2. Load conversation membership from canonical server-controlled state.
3. Verify the caller is a current participant and the target message belongs to that conversation.
4. Confirm the target message is not later than the latest committed message and that message ordering is deterministic.
5. In a transaction, advance only the caller's `lastReadMessageId` if the target is newer.
6. Recompute or safely decrement unread state from canonical messages / a trusted sequence model; do not trust a client-supplied count.
7. Update the caller's inbox summary in the same atomic transaction or a durable idempotent workflow.
8. Return a minimal result without disclosing the other participant's private state.

## Ordering and concurrency

- Prefer a server-assigned monotonically increasing per-conversation sequence number over client clocks.
- If sequence numbers cannot be introduced safely, define a stable ordering key using server timestamp plus unique message ID and test timestamp ties.
- Two concurrent read receipts must converge to the furthest valid read position.
- A late-arriving or retried message event must not lower a read cursor or double-increment unread counts.
- Message deletion, moderation removal, blocked conversations, group chats, and retention expiry require explicit policy before implementation.
- Do not infer read state from app foreground/background state.

## Privacy controls

- A user may read/write only their own participant-state document through a trusted route.
- Clients cannot set another UID's receipt, unread count, membership, or message sequence.
- Avoid exposing exact last-active/read timestamps to other participants unless a separate product privacy decision explicitly approves it.
- The UI may show generic sent/delivered/read indicators only if product policy and participant consent permit them.

## Test requirements

Synthetic tests must cover:
- Participant A reading a message does not mark it read for participant B.
- A non-participant cannot submit a receipt.
- Receipt replay is idempotent.
- Older receipt cannot move cursor backwards.
- Concurrent receipts converge to the furthest cursor.
- A sender's own message does not increment their unread count.
- Duplicate message-delivery event does not double-increment unread count.
- Unknown message ID, wrong conversation, malformed ID and future cursor are rejected.
- A client-provided UID or unread count is ignored.
- Missing backend state fails closed; it must not default to an open conversation.

## Rollout dependencies

This design depends on the verified-token contract, trusted message-send path, inbox-summary contract, emulator-tested collection-specific rules, and a resumable reconciliation/migration plan. Do not ship it independently of those prerequisites.

## Explicit non-goals

No production or staging data access, rules change, migration, backend runtime, IAM, secrets, billing, notification integration, or deployment is authorized by this document.
