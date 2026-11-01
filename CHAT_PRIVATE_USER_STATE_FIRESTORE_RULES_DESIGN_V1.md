# Chat Private User State — Firestore Rules Design V1

**Branch:** `security-hardening-review`  
**Status:** design-only; illustrative candidate, not deployable or emulator-verified.  
**Safety:** Existing Staging deny-all Rules remain unchanged. No Firebase project, data, Rules, IAM, billing, secrets, client runtime or deployment was changed.

## 1. Purpose and trust boundary

This design narrows participant-specific state without making chat messages or shared parent metadata broadly writable. It is a candidate for a future isolated Firebase Emulator fixture only.

Canonical chat membership must come from `chats/{chatId}.participants`, not from the chat ID, a client-supplied UID, a cached UI value, or a message's sender name. A valid chat has exactly two distinct non-empty participant UIDs. Every operation fails closed if the parent is missing or malformed.

The design deliberately separates:
- **Client-owned private actions:** hide/unhide one existing message for the caller; publish the caller's short-lived typing presence.
- **Trusted-backend-only state:** read cursor, read timestamp, unread count, sequence allocation and inbox summary.
- **Immutable/shared conversation data:** parent participants/product identity and message content, governed by separate operation-specific Rules.

## 2. Proposed paths and permissions

| Path | Read | Client create/update/delete |
|---|---|---|
| `chats/{chatId}/userState/{uid}` | That UID only, while current participant | None; trusted backend only |
| `.../userState/{uid}/hiddenMessages/{messageId}` | That UID only, while current participant | Create own marker for an existing message; delete own marker; no update |
| `chats/{chatId}/typing/{uid}` | Current chat participants | Owner UID only; short expiry; delete own |
| `chats/{chatId}/messages/{messageId}` | Current chat participants | Not granted by this design; separate message contract |

### User state document

Suggested trusted fields: `schemaVersion`, `lastReadMessageId`, `lastReadSequence`, `lastReadAt`, `unreadCount`, `updatedAt`.

Clients receive read access only to their own document. All client writes are denied. A future trusted backend must validate the chat, UID, message and monotonic sequence and must not accept client-authoritative `unreadCount`, timestamps, sequence or another UID.

### Hidden-message marker

Path: `chats/{chatId}/userState/{uid}/hiddenMessages/{messageId}`.

Exact client-create schema:
- `schemaVersion: 1`
- `hiddenAt: request.time` (client must send a server timestamp transform)

No update is allowed. Unhide is deletion of this caller-owned marker only. A create must verify that `chats/{chatId}/messages/{messageId}` exists. The parent chat must still identify the caller as a participant. This does not delete or edit the underlying message.

### Typing presence

Path: `chats/{chatId}/typing/{uid}`.

Exact client-create/update schema:
- `activeUntil: timestamp`
- `updatedAt: request.time` (server timestamp transform)

The expiry must be in the future and no more than two minutes after request time. Only the UID matching the document ID may write or delete. Current participants may read the minimal presence record. Expired records must be ignored by clients; no scheduled cleanup service is required. If Rules timestamp arithmetic or the emulator behavior cannot prove the bound, defer typing rather than weakening the rule.

## 3. Illustrative Rules fragment (NOT deployable)

The fragment is intentionally incomplete: it does not grant parent-chat or message access, does not replace the repository's deny-all fixture, and must be compiled and tested in a dedicated candidate Rules file before any consideration of use.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function chatPath(chatId) {
      return /databases/$(database)/documents/chats/$(chatId);
    }

    function messagePath(chatId, messageId) {
      return /databases/$(database)/documents/chats/$(chatId)/messages/$(messageId);
    }

    function validParticipant(chatId) {
      let chat = get(chatPath(chatId)).data;
      return signedIn()
        && exists(chatPath(chatId))
        && chat.keys().hasAll(['participants'])
        && chat.participants is list
        && chat.participants.size() == 2
        && chat.participants[0] is string
        && chat.participants[1] is string
        && chat.participants[0].size() > 0
        && chat.participants[1].size() > 0
        && chat.participants[0] != chat.participants[1]
        && chat.participants.hasAny([request.auth.uid]);
    }

    match /chats/{chatId}/userState/{uid} {
      allow get, list: if signedIn()
        && request.auth.uid == uid
        && validParticipant(chatId);
      allow create, update, delete: if false;

      match /hiddenMessages/{messageId} {
        allow get, list: if signedIn()
          && request.auth.uid == uid
          && validParticipant(chatId);

        allow create: if signedIn()
          && request.auth.uid == uid
          && validParticipant(chatId)
          && exists(messagePath(chatId, messageId))
          && request.resource.data.keys().hasAll(['schemaVersion', 'hiddenAt'])
          && request.resource.data.keys().hasOnly(['schemaVersion', 'hiddenAt'])
          && request.resource.data.schemaVersion == 1
          && request.resource.data.hiddenAt == request.time;

        allow update: if false;

        allow delete: if signedIn()
          && request.auth.uid == uid
          && validParticipant(chatId);
      }
    }

    match /chats/{chatId}/typing/{uid} {
      allow get, list: if signedIn() && validParticipant(chatId);

      allow create, update: if signedIn()
        && request.auth.uid == uid
        && validParticipant(chatId)
        && request.resource.data.keys().hasAll(['activeUntil', 'updatedAt'])
        && request.resource.data.keys().hasOnly(['activeUntil', 'updatedAt'])
        && request.resource.data.activeUntil is timestamp
        && request.resource.data.activeUntil > request.time
        && request.resource.data.activeUntil <= request.time + duration.value(2, 'm')
        && request.resource.data.updatedAt == request.time;

      allow delete: if signedIn()
        && request.auth.uid == uid
        && validParticipant(chatId);
    }
  }
}
```

**Important review notes before turning this into an emulator candidate:**
1. Confirm Rules compiler support for `let`, `duration.value(2, 'm')`, list methods and timestamp arithmetic against the project's pinned Firebase Emulator/Rules runtime. If unsupported, do not silently substitute a weaker check.
2. In Rules, matching `allow` statements are OR-combined. This fragment must be reviewed together with every overlapping wildcard match. A broad allow elsewhere can defeat these restrictions; a broad deny does not override a more-specific allow.
3. Firestore Rules are not filters. A `list` query on private state must be scoped so every returned document satisfies the ownership and membership checks. Test actual query shapes, not only direct gets.
4. Verify that `get`/ `exists` calls are cached per request as expected, and count access calls for each operation. Hidden-marker create requires parent-chat and message existence checks; typing and private-state reads require the parent check.
5. Do not expose the legacy private product document merely to establish chat membership. Chat creation and message-send block checks remain separate unresolved authorization work.
6. The snippet does not validate the full chat document schema, product seller identity, block relationships, message sender identity, message payload limits, or parent immutability. It must not be treated as complete chat security.

## 4. Required emulator tests

Use only synthetic users, chats and messages in an isolated emulator project.

### Private state
- Participant A can get/list only `userState/A`; cannot get/list `userState/B`.
- Non-participant and unauthenticated callers cannot read either state.
- Client create/update/delete of the parent userState document always fails.
- A malformed/missing parent chat or malformed participant list fails closed.

### Hide/unhide
- A can create a marker only for an existing message in a chat where A is a participant.
- A cannot create a marker for a missing message or a message in another chat.
- B cannot create, read, list or delete A's marker, even when B knows its path.
- A cannot update an existing marker; A can delete only A's marker.
- Repeated create behavior is explicitly tested; a duplicate create may return already-exists and the client must treat that as idempotent without changing ownership.

### Typing
- A can create/update/delete only `typing/A`; B cannot write A's record.
- Non-participant cannot read typing records.
- Extra fields, missing fields, wrong types, past expiry and expiry beyond two minutes fail.
- A cannot extend typing for another UID.
- Expired presence is ignored by UI and never changes read state or message delivery state.

### Query and overlap
- Participant list queries succeed only with an ownership-compatible query; unscoped collection queries fail.
- Test all overlapping wildcard matches and all existing candidate Rules.
- Measure access-call counts for direct and query operations.
- Test with the exact Firebase Emulator and Rules versions pinned by the repository.

## 5. Cutover requirements

This design alone authorizes no implementation or rollout. Before use:
1. Resolve the canonical product/public-private schema and trusted chat-creation proof.
2. Complete message/offer write authorization, recipient block enforcement, tombstone transitions and immutable parent validation.
3. Coordinate client changes so legacy shared `status`, `hiddenFor` and `typing_<uid>` writes stop safely.
4. Add a separate candidate Rules file and actual Firestore Rules Emulator tests using synthetic data.
5. Pass review of all overlapping matches, query behavior, access-call limits, migration and rollback.
6. Obtain explicit owner approval before any Staging Rules deployment or data migration.

Production, `main`, and the live website remain out of scope.
