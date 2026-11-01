# OLDX block/unblock source audit (development)

Inspected index.html on service-providers-development.

- The existing full-chat block/unblock handler updates users/{currentUser.uid}.blockedUsers with Firebase FieldValue.arrayUnion/arrayRemove.
- The existing send path reads users/{activeChatOtherUserId}.blockedUsers to check whether the recipient blocked the sender before calling sendChatMessageNow.
- The service contact adapter separately reads both users' blockedUsers lists and fails closed if reads fail.

## Integration implications

1. The proposed serviceChatBlocks edge collection is NOT written by the existing block/unblock handler. Enabling rules that check only edges would silently ignore existing blocks.
2. Any future transition must preserve existing product chat behavior and block visibility; do not replace arrayUnion/arrayRemove without checking all call sites.
3. Existing recipient-user document reads may be denied by deployed Firestore rules; verify permissions and privacy before relying on them.
4. Existing browser-only send checks are not sufficient authorization. Service message write rules must enforce block state at the server.
5. No production rule changes, data migration, or client wiring are authorized by this audit.
