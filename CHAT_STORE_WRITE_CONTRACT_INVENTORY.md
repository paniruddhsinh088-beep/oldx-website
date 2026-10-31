# OLDX Chat and Store Write-Contract Inventory

**Branch:** `security-hardening-review`  
**Status:** Static source inspection only. Not Firestore Rules and not runtime verification.  
**Safety:** No Rules, Firebase project, data, or deployment changed.

## 1. Chat room documents

### Observed client operations

- Inbox queries `chats` with `participants array-contains currentUid`.
- Opening a chat writes `participants: [buyerId, sellerId]` and `productId` with `set(..., {merge:true})`.
- Chat activity updates `lastUpdated` using server timestamp.
- Typing indicator writes dynamic keys `typing_<uid>` true/false.
- Chat status UI reads the other participant's public profile document.

### Required authorization contract

- Only authenticated participants may read a chat room or its message subcollection.
- Room creation must validate exactly two distinct participant UIDs, include the authenticated caller, and bind the other participant to the seller of the referenced product. The product lookup/relationship must be enforced by a trusted backend or a Rules design that can safely verify it.
- Once created, `participants` and `productId` must be immutable. A client merge must not be allowed to add/remove participants or retarget a room to another product.
- A room update may change only explicitly approved participant-owned typing fields and `lastUpdated`; arbitrary dynamic keys must not be accepted.
- Typing fields must be limited to participant UIDs and boolean values. Consider moving ephemeral typing state out of the durable chat document if it creates excessive writes.
- `lastUpdated` must be a server timestamp, not a client clock value.
- Do not let a user create a room with arbitrary third-party participants or send messages to a blocked user. Current source stores `blockedUsers` on the user's private document; a rules design must not expose that private list to the other participant. A trusted send-message endpoint or carefully modeled block relation is safer.

## 2. Message documents

### Observed client operations

Messages are created with:
- `text`
- `attachment` (currently may contain image data)
- `senderUid`
- `senderName`
- `status: 'sent'`
- `time` (client-formatted display time)
- `createdAt` (server timestamp)

Other observed writes:
- Recipient marks messages as read by updating `status: 'read'`.
- Sender can set `hiddenFor` using arrayUnion of their UID (delete for me).
- Sender can set `deletedForEveryone: true`, clear `text`, and set `attachment: null`.

### Required authorization contract

- Only a participant of the parent chat may read or create messages.
- On create, `senderUid` must equal `request.auth.uid`; it must be one of the immutable parent participants.
- Message text, senderName, time, attachment shape and total size need strict type/length limits. `senderName` and `time` are display metadata, not trusted identity or ordering.
- `createdAt` must be server timestamp and immutable.
- A recipient may update only the read state of a message sent by the other participant; the sender may not mark their own message as read on behalf of the recipient.
- A participant may add only their own UID to `hiddenFor`; they must not remove another participant's UID or change message content through that operation.
- Only the original sender may set `deletedForEveryone` from false to true, and that update must be limited to the deletion flag plus clearing content/attachment. It must not permit senderUid, createdAt or other metadata changes.
- No participant may change sender identity, move a message to another room, or rewrite a sent message's text/attachment except through the narrowly scoped delete-for-everyone transition.
- Consider replacing base64/data-URL attachments with bounded Storage uploads and trusted metadata. Firestore Rules cannot validate actual image bytes.

## 3. Store documents

### Observed client operations

Store documents are addressed by `stores/{uid}`.

The owner reads their own store and writes a merged object containing:
- `uid`
- `shopName`
- `ownerName`
- `address`
- `mobile`
- `whatsapp`
- `sameAsMobile`
- `photoURL`
- `categories`
- `coords`
- `updatedAt` (server timestamp)
- `createdAt` (server timestamp, only on first save)

The public store page reads `stores/{ownerUid}` and renders the data to visitors.

### Required authorization contract

- Public read may be retained only after a privacy review confirms every exposed field is intended for public display.
- Only authenticated owner UID may create/update `stores/{uid}`; document ID and stored `uid` must equal `request.auth.uid`.
- `createdAt` is create-only and immutable. `updatedAt` must be a server timestamp.
- Enforce an exact field allowlist and type/length limits for every field.
- Validate `sameAsMobile` as boolean, categories as a bounded list of approved IDs, and coordinates as finite numeric latitude/longitude in legal ranges.
- Mobile/WhatsApp numbers and street address are personal/business contact data. Decide whether to split public store profile from private owner contact details before enabling public reads. If the existing public store UI needs them, make that exposure explicit and consent-based.
- `photoURL` must be restricted to trusted upload origins or replaced by Storage metadata; never accept arbitrary executable or unsafe schemes.
- Do not allow a store owner to set verification, moderation, featured, billing, or admin-only fields through this form.

## 4. Emulator test matrix to implement

### Chats
1. Guest cannot read/create/update a room or messages.
2. Non-participant cannot read a room or its message subcollection.
3. Participant can read own room and messages.
4. Room create requires caller to be a participant and exactly two distinct participants.
5. Room participant list and productId cannot be changed after creation.
6. A non-seller cannot initiate a room claiming an unrelated seller/product pair.
7. Only participant-specific typing boolean can be changed; arbitrary keys and non-boolean values fail.
8. Participant can create a message only with senderUid equal to their UID.
9. Non-participant cannot create messages even if they know the room ID.
10. Recipient can mark the other party's message read; sender cannot forge recipient read state.
11. Participant can hide a message only for themselves.
12. Only original sender can perform the constrained delete-for-everyone transition.
13. Message identity, senderUid and createdAt remain immutable.
14. Oversized text/attachment and malformed attachment metadata are rejected.
15. Blocked-user enforcement is tested without exposing private block lists.

### Stores
1. Public visitor can read only approved public store fields.
2. Guest cannot create/update a store.
3. Owner can create/update only `stores/{ownUid}`.
4. Owner cannot write a different `uid` field or another user's store.
5. Owner cannot change `createdAt`.
6. Invalid category IDs, excessive categories, invalid coordinates and oversized strings fail.
7. Public reads do not expose private contact fields unless the owner has explicitly opted into that exposure.
8. Owner cannot set verification, featured or moderation fields.

## 5. Known blockers and implementation cautions

- The current chat room write uses `set(..., {merge:true})` for participants/productId; this must be reconciled with immutable room identity.
- Typing uses dynamic field names and must be constrained carefully; broad map updates would be unsafe.
- The inbox unread badge currently reads message documents across every participant chat and counts unread messages client-side. Rules must still scope each query to a participant's own rooms; a trusted unread counter may improve scale later.
- Read receipts currently update message documents in a loop; this may create many writes. A bounded batch or trusted endpoint may be more efficient.
- Base64 attachments increase document size and require strict limits; a Storage migration is preferable.
- Public store page currently renders contact information; a public/private profile split and owner consent are required before finalizing public-read Rules.
- Existing blocked-user state is stored under `users/{uid}`; do not solve this by allowing participants to read another user's private profile document.
- Product and account deletion workflows are still unresolved and affect chat/store cleanup and retention.

**No `firestore.rules` file is created by this inventory.** These contracts must be reconciled with all write paths, then implemented and tested against the Emulator before any owner-approved staging Rules publication.
