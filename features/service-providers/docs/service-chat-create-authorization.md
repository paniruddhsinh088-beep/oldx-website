# Service chat room creation: authorization checklist (development only)

Status: design review; no client create permission enabled, no production deployment.

## Required checks before allowing creation

1. Signed-in buyer is the requesting user; provider is a different UID.
2. Room ID is derived canonically from provider UID and buyer UID using chat-context.js.
3. Participants are exactly [buyerUid, providerUid], in that order, with no duplicates.
4. chatType is exactly service; serviceProviderId equals provider UID; no extra client-controlled fields.
5. Provider profile exists at serviceProviders/{providerUid}, has ownerUid == providerUid and status == active.
6. Blocking must be enforced by trusted, readable data for both parties; do not rely on a UI-only blockedUsers check.
7. Room updates and deletes remain denied until separately reviewed.
8. Message creation, updates, deletes, typing, read receipts and inbox listing remain denied until their data model and rules have separate tests.
9. Audit every existing /chats and recursive wildcard allow rule: Firestore matching allow rules combine by OR, so a narrow service rule cannot override a broad legacy grant.
10. Test guests, strangers, self-chat, wrong order, wrong room ID, forged provider, inactive/suspended/missing provider, malformed data and blocked pairs in emulator.

## Integration constraint

The current production/staging rules must be obtained and audited before any merge. This file is a checklist, not deployable rules. Do not enable service send UI or deploy standalone firestore.rules.draft.
