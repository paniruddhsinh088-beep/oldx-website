# OLDX Chat Firestore Rules — Operation Matrix

**Branch:** `security-hardening-review`  
**Status:** Design and test plan only — not deployable Rules and not a runtime authorization claim.  
**Safety:** Keep Staging Firestore deny-all. No Firebase project, data, Rules, IAM, billing, secrets, or deployment changed.

## Canonical source facts

The current browser source uses:

- Parent: `chats/{chatId}`, with `participants: [buyerUid, sellerUid]` and `productId`.
- Messages: `chats/{chatId}/messages/{messageId}`.
- Message create fields include `text`, `attachment`, `senderUid`, `senderName`, `status`, `time`, `createdAt`. Offer messages use a similar but not identical payload.
- Parent metadata writes include `lastUpdated` and dynamic `typing_{uid}`.
- Message updates include `status: read`, `hiddenFor` array additions, and sender-side `deletedForEveryone` tombstones.
- Legacy block data is `users/{uid}.blockedUsers`, read and modified by the browser.

These are observations, not an endorsement of the current client schema.

## Required operation matrix

| Operation | Intended authorization | Required validation / denial cases |
|---|---|---|
| Create chat parent | Authenticated buyer creates a two-party room for an existing product | Load canonical `products/{productId}`; require stored `sellerUid`; caller must equal buyer UID; submitted other participant must equal canonical seller; reject self-chat, missing product/seller, malformed or duplicate participant list, and either-direction existing block |
| Read chat parent | Only one of the exact two participants | Require authenticated UID in a valid two-element distinct participant list; deny all non-participants and unauthenticated users |
| Query inbox | Only rooms where authenticated UID is a participant | Query must constrain `participants array-contains request.auth.uid`; verify actual query shape and indexes before Rules design |
| Update parent typing | Participant may update only their own typing state | Prefer `typing/{uid}` private subdocument; if legacy parent fields remain, enforce only the caller's exact dynamic key and strict type, while forbidding participant/productId changes |
| Update parent lastUpdated | Prefer trusted backend timestamp after message creation | Client must not arbitrarily change participant identity or other parent fields; avoid allowing timestamp writes to become a side channel |
| Create message | Participant sends as authenticated UID to the other participant | Load parent, validate exact two-person membership, require `senderUid == request.auth.uid`, require recipient block relationship absent, strict field allowlist/types/size, reject client-set privileged fields and spoofed sender |
| Create offer message | Same authorization as ordinary message | Same parent membership and block gate; never treat separate offer UI as a bypass; attachment/data payload must meet separately approved size/storage contract |
| Read messages | Only chat participants | Parent membership must be checked; non-participant and unauthenticated reads denied; bounded pagination belongs in client contract, not as a substitute for authorization |
| Update read receipt | Prefer private per-participant cursor document | Legacy shared `status` field leaks one participant's read action to the other; do not treat current shared field as private |
| Hide message for me | Prefer `chats/{chatId}/userState/{uid}/hiddenMessages/{messageId}` | Only owner of private state can create/delete; other participant cannot enumerate or modify it |
| Delete for everyone | Only original sender may transition a message to tombstone once | Allow only approved tombstone fields; deny content replacement, attachment substitution, tombstone reversal, and non-sender deletion |
| Create block relationship | Only blocker creates `users/{blockerUid}/blockedUsers/{blockedUid}` | Auth UID must equal blocker path; reject self-block and malformed IDs; strict schema; no arbitrary nested writes |
| Delete block relationship | Only blocker removes their own relationship | Auth UID must equal blocker path; other user cannot unblock on blocker’s behalf |
| Read/list block relationships | Private to blocker; preferably no client list/read needed | Deny other users; avoid client access to another user's block list; server-side send check uses canonical relationship path |
| Delete chat/message | Not authorized as broad client delete | Keep blocked pending retention/deletion design; account deletion must use separately approved trusted workflow |

## Rules proof requirements

1. Never derive authorization from chat ID text. It is currently `productId_buyerUid` in one flow, but it is not a cryptographic or canonical membership proof.
2. A client-supplied `participants` array is not sufficient proof at chat creation. Compare the seller UID against the canonical product record.
3. The legacy `products/{productId}` collection contains private fields, including `phone` and `userIp`. Do not make it publicly readable to enable a chat creation lookup. Resolve the data boundary first.
4. For message creation, derive the recipient from the validated parent participants and require absence of `users/{recipientUid}/blockedUsers/{senderUid}`. Missing/unreadable block state must deny by default.
5. For chat creation, consider both directions of block state. A block by either party should prevent a new room/message flow unless product behavior is explicitly changed.
6. Parent participant and product identity must be immutable after trusted/validated creation.
7. Keep all message operations field-allowlisted. Dynamic arbitrary field updates are not acceptable.
8. Rules access-call budgets must be checked for every operation and query. Avoid repeated `get()` calls; use a bounded number of canonical reads and test actual query execution in the emulator.
9. Rules are not filters. Inbox and message queries must be shaped so every possible returned document satisfies the rule.
10. Preserve fail-closed behavior if a product, parent chat, block record, or required field is missing.

## Migration blockers

- Existing chat documents may have incomplete or legacy `participants`; do not assume all historic rooms are valid two-party rooms.
- Offer messages and ordinary messages have slightly different optional fields.
- Shared `hiddenFor` and shared `status` are not private per-user state.
- Current browser updates to chat parent and messages are broad merge/update operations; the client must be changed in a coordinated rollout before narrow Rules can pass all user flows.
- Current block UI uses a per-user array; moving to relationship documents needs a one-time, idempotent, privacy-safe migration plan and a rollback strategy. No migration is authorized.
- Product seller proof cannot be implemented safely until public/private product read architecture is resolved.

## Required isolated emulator test matrix

Use synthetic users `buyerA`, `sellerA`, `outsiderB`, `buyerBlocked`, and synthetic products only.

- Valid buyer creates chat against canonical product seller.
- Caller cannot impersonate buyer or substitute a different seller UID.
- Missing product, missing sellerUid, self-chat, duplicate participants, extra participants all fail.
- Only participants read parent and messages; outsider and unauthenticated reads fail.
- Inbox query constrained by caller membership succeeds; unconstrained query fails.
- Sender UID spoofing fails.
- Message send fails if recipient blocks sender; repeat in reverse direction.
- Missing block document permits only when the canonical relationship is absent and parent/product proofs succeed; missing parent/product or malformed fields fail closed.
- Offer message obeys identical block and membership rules.
- Non-participant cannot mutate typing, read receipts, hide state, tombstones, or block state.
- Participant cannot rewrite parent participants/productId.
- Only sender can tombstone once; other participant and repeated/reversal attempts fail.
- Blocker can block/unblock own relationship; blocked party cannot remove it.
- Rules access-call limits and realistic inbox/message queries are tested in Emulator.
- Legacy malformed documents remain inaccessible until explicitly reconciled.

## Release gate

Do not replace `tests/firestore-emulator/deny-all.rules` or modify deployed rules as part of this design. A future candidate must be a separate file and pass actual Firestore Rules Emulator tests using synthetic data. It also requires coordinated client changes, migration/rollback plans, a reviewed product data boundary, and explicit owner approval before any Staging deployment. Production remains completely out of scope.
