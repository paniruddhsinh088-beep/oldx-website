# Legacy Product Chat schema audit from index.html

Inspected development branch `index.html` without modifying the live application.

## Confirmed client operations
- Room document: `chats/{chatId}`, initialized with `participants: [buyerId, sellerId]` and `productId` using `set(...,{merge:true})`.
- Room writes after creation: `typing_<uid>` toggles and `lastUpdated` updates via merged writes. A ruleset that denies all room updates will break typing indicators and send flows.
- Messages: `chats/{chatId}/messages/{messageId}`, `add` writes `senderUid`, `senderName`, `text`, `attachment`, `status:'sent'`, `time`, `createdAt: serverTimestamp()`.
- Receipts: other participant updates `status:'read'` on messages. A blanket sender-only update rule breaks receipts.
- Delete-for-me: user updates `hiddenFor` with arrayUnion(uid). A blanket sender-only update rule breaks receiver's delete-for-me.
- Delete-for-everyone: sender updates `deletedForEveryone:true`, `text:''`, `attachment:null`; must enforce sender ownership and immutable `senderUid`.
- Queries: room list uses `where('participants','array-contains', uid)`; messages use `orderBy('createdAt')`, `where('senderUid','!=',uid)`.

## Rule design requirements before production
1. Room create must verify exactly two distinct participants including the requester, and validate the seller/buyer relationship with a trusted product document.
2. Room update must preserve participants/productId and allow only whitelisted own typing state and lastUpdated, without opening metadata ownership bypass.
3. Message create must require authenticated participant, `senderUid == auth.uid`, validated schema, bounded content and safe attachments.
4. Message update must enforce immutable senderUid/createdAt and narrowly permit read receipts, hiddenFor own UID, and sender-only delete-for-everyone.
5. Blocked-user enforcement must be server-side and account for existing `users/{uid}.blockedUsers` migration; test query authorization and legacy documents.
6. Verify full deployed production rules text and project ID; do not publish the emulator-only privacy fixture.

This audit is based on source-code paths, not on inspecting live chat records. Actual legacy records may differ.
