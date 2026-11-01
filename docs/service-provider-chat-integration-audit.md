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
