# OLDX existing chat integration audit — service providers

**Source inspected:** `index.html` on `service-providers-development`.
**Status:** findings only; no changes to existing chat or live deployment.

## Existing behaviors identified
- The full-chat privacy menu uses `users/{currentUid}.blockedUsers` to
  block/unblock `activeChatOtherUserId`, via `FieldValue.arrayUnion/arrayRemove`.
- The send-message flow checks whether the **recipient** has blocked the sender
  before calling `sendChatMessageNow`.
- The product detail WhatsApp anchor uses `handleOldxWhatsApp(event, this)`.
- The full chat UI has its own active room and recipient state.

## Integration requirements
1. Reuse the existing chat opening flow after locating its actual callable
   entry point; do **not** invent a parallel chat collection or conversation ID.
2. Before a provider Chat or WhatsApp action, verify signed-in user and read
   both `users/{viewerUid}.blockedUsers` and
   `users/{providerUid}.blockedUsers`. Fail closed on permission/network errors.
3. The existing send-message path checks the recipient's blocked list, but the
   provider integration must also check the sender's own blocked list.
4. Avoid assuming a provider's public profile contains a public phone number.
   Phone/WhatsApp details require explicit consent and an appropriate privacy
   model; never expose private `users` documents to guests.
5. Preserve guest restrictions and the existing WhatsApp notice by reusing
   the existing `handleOldxWhatsApp` policy when the contact target is valid.
6. Avoid editing `index.html` until the original chat opener and all block
   checks have been identified and tested.
7. Firestore rules must enforce participant membership and blocked-user
   permissions for actual message writes; client checks alone are insufficient.
8. Existing product chat, store chat, unread ordering, typing indicator, and
   delete-for-me/everyone behavior need regression tests.

## Important current risk
The current send-message snippet checks the recipient's blocked list before
sending, but does not visibly check the sender's own blocked list in that
snippet. Do not treat the new contact-policy module as a security fix for
existing chat until the complete flow and rules are audited.

## Next engineering step
Implement an adapter that **reads** both block lists, returns a permission
decision, and invokes the existing chat opener via an injected callback.
Test guest, block in either direction, missing docs, and read failures before
wiring any UI buttons.


## Verified entry-point findings (follow-up audit)
- `openLiveChatModal()` currently requires `currentProduct`, takes
  `currentProduct.sellerUid`, and creates a chat room ID of
  \`\${currentProduct.docId}_\${buyerId}\`.
- It writes `chats/{roomId}` with `participants: [buyerId, sellerId]` and
  `productId: currentProduct.docId`. It therefore **cannot be reused as-is**
  for service providers: it would use the wrong product context.
- The same function uses `currentProduct.phone || '919876543210'` for its
  call link. Never carry this placeholder number into service contacts.
- `checkScamAndSendChatMessage()` checks only the recipient's block list in
  the inspected branch, then calls `sendChatMessageNow()`.
- `handleOldxWhatsApp(event, link)` checks HTTPS WhatsApp hosts, requires
  login, and displays the existing third-party-app confirmation.

### Required refactor before integration
1. Introduce a typed chat context with `kind: 'product' | 'service'`,
   `targetId`, `buyerUid`, and `sellerUid/providerUid`.
2. Keep existing product room IDs unchanged to preserve message history.
   Service rooms need their own deterministic namespace, but reuse
   `chats/{roomId}/messages` and existing message UI.
3. Validate chat participants and typed target metadata in Firestore rules
   **before** enabling new room creation.
4. Never invent phone numbers. Omit the call action until a provider explicitly
   opts in to a verified public contact number.
5. Check **both** block lists on every message send and enforce restrictions
   in rules/backend; block-list reads alone are not authorization.
6. Test existing product chats, unread sorting, typing, delete-for-me/everyone,
   and blocking after refactor.
