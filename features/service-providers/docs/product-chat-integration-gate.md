# Combined Product Chat Rules: integration gate

**Status: BLOCKED for deployment.** Individual emulator candidates have been authored for room creation, merge updates, typing, lastUpdated, message creation/read receipts, and delete operations. They are deliberately isolated fixtures and cannot be concatenated: Firestore matching rules are OR-composed and overlapping permissive rules could bypass checks.

## Integration requirements
1. One authoritative `match /chats/{chatId}` and nested `match /messages/{msgId}` in the final production candidate; no overlapping broad wildcard grants.
2. Product room creation must account for buyer/seller and existing chat room ID generation. Seller-initiated rooms and legacy data may require separate compatibility paths.
3. Room update must support legacy `set(...,{merge:true})` without permitting participants or productId modification; preserve typing and lastUpdated.
4. Message creation validates senderUid and message schema. Receipts, hiddenFor and deletedForEveryone require independent, mutually safe update branches.
5. Read/list queries must be checked with actual client query shapes; rules are not filters.
6. Service chat remains disabled until its separate server-side write and block logic is verified.
7. Review complete text of currently deployed production rules and test representative production document shapes in emulator before any publish.

## Known production risks from screenshot
The screenshot shows broad authenticated access to nested chat messages and unrestricted public writes to stats. These need a dedicated migration plan, but changing them blindly may break production. Screenshot is not full machine-readable rules source.

## Next test milestone
Create a single emulator-only consolidated ruleset and comprehensive regression suite. Do not deploy this or any other candidate automatically.
