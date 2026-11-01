# Chat Message Ownership, Privacy and Deletion Contract

Status: source audit and design only. No client runtime, Firestore rules, backend, existing chat data, or deployment was changed.

## Source audit findings

The current browser code:
- Reads messages from `chats/{chatId}/messages` and listens to the latest 35 ordered by `createdAt`.
- Attempts to mark every incoming message as `status: 'read'` by directly updating message documents from the client.
- Offers "delete for me" by adding the current UID to `hiddenFor`.
- Offers "delete for everyone" after a browser-side comparison of `senderUid` with the current UID.
- Renders message text and attachment names using `textContent`, which is a safer DOM sink than inserting message text as HTML.
- Accepts attachment MIME types in the browser and embeds file data as data URLs. Browser MIME checks are not trusted validation and do not enforce a server-side byte limit.
- Has additional offer-message creation logic which writes chat and message documents directly from the browser.

These UI checks improve usability but are not an authorization boundary. Firestore rules or a trusted backend must independently enforce every permission. Staging deny-all rules remain unchanged.

## Canonical authorization requirements

Every message operation must authenticate the caller and load canonical chat membership from trusted state. A client-provided sender UID, participant list, role, or active chat ID is not proof of authorization.

- Read: caller must be a current participant in the conversation.
- Send: caller must be a current participant, not blocked by the other participant, and satisfy rate/size/content policy.
- Edit: only the original sender may edit their own message, within an explicitly approved edit window and field allowlist.
- Delete for me: only the caller's private per-user visibility state may change. It must not change the other participant's view.
- Delete for everyone: only the original sender may request it; the backend checks ownership and applies a tombstone. A separate moderation path may exist but must be privileged, audited, and approved.
- Read receipt: update only the caller's participant-specific receipt, never a shared global status.
- Attachments: client-supplied MIME type, filename, extension, data URL and byte count are untrusted. Trusted processing must inspect actual bytes, enforce size/type policy, and deny executable or unsupported content.

## Suggested message and visibility model

Keep message content immutable after send unless an approved edit feature is specified. Use server-controlled fields such as:
- `senderUid`, `createdAt`, and deterministic sequence: immutable after creation.
- `deletedForEveryone`, `deletedAt`, `deletedBy`: trusted tombstone fields only.
- Per-user hidden state stored separately, e.g. `chats/{chatId}/userMessageState/{uid}/messages/{messageId}`, writable only for that UID through a trusted operation.
- Participant read cursor and unread count follow `CHAT_READ_RECEIPT_AND_UNREAD_CONSISTENCY_CONTRACT.md`.

Do not accept arbitrary object merges from clients. Define strict field allowlists and reject unknown fields or type changes. Do not store the sender's display name as authoritative identity; render a profile label from a controlled public profile or treat the stored display name as untrusted plain text.

## Privacy and lifecycle

- Conversation membership is immutable to ordinary participants; participant changes require a separately specified trusted workflow.
- A block action must be enforced at message-send time on the server, not only by disabling the input in the UI.
- Blocking does not silently delete message history. Retention and deletion are separate product decisions.
- "Delete for me" is private to that user and must not reveal the action to the other participant.
- "Delete for everyone" leaves a minimal tombstone and must not claim physical erasure from backups/logs unless that is actually guaranteed.
- Account deletion must account for chat records, attachments, per-user state, moderation/audit retention and legal retention policy; client-side batch deletion is not a complete account-deletion workflow.
- Avoid presence, last-seen or read-time disclosure unless an explicit privacy decision authorizes it.

## Required synthetic policy tests

- Non-participant cannot read or mutate a conversation.
- Sender UID cannot be spoofed.
- Only original sender can request delete-for-everyone.
- A participant can hide a message only for themselves.
- A user cannot alter another user's hidden state.
- Tombstone cannot be reversed by an ordinary participant.
- Immutable sender, createdAt and sequence cannot be overwritten.
- Blocked users cannot send, even if their UI is manipulated.
- Oversized, unsupported, malformed or mismatched attachment metadata fails closed.
- Plain text and filenames remain data, never executable markup.

## Rollout gates

Implementation waits for verified Firebase ID token authentication, trusted message send/mutation backend, approved moderation and retention policy, attachment processing/provider decision, collection-specific Firestore rules, emulator tests, and a resumable data migration plan. No service identity, secret, provider account, billing or deployment is authorized here.

## Explicit non-goals

No Firebase data access, staging/production rules deployment, message migration, backend runtime, IAM, secrets, storage provider, billing, or live-site change.
