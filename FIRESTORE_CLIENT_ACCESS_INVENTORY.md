# Firestore Client Access Inventory

## Scope and confidence

- Source reviewed: `index.html` on `security-hardening-review` (blob SHA `0aa9ee300531059a7da79bf41e5729edf68169cd`).
- This is a static source inventory, not a runtime trace. Conditional paths may not execute in every session; query indexes, actual document schemas, and deployed Rules were not verified.
- No Firebase Rules, production data, or deployment was changed.
- The code also includes Firebase calls in `admin.html`; those need a separate operation-by-operation inventory before final Rules are authored.

## Collection access matrix

| Collection/path | Client operation observed | Purpose / required authorization | Rule implications |
|---|---|---|---|
| `stats/traffic` | get, update increment, set | Visitor counter from browser | Current client write must be migrated to trusted backend before writes are denied. Public read may be unnecessary. |
| `products` | query by `sellerUid`; public ordered listener; get by doc ID; add; update; delete; batch delete | Marketplace feed, My Ads, edit, stock toggle, account deletion | Public read currently supports browsing. Create must bind sellerUid to auth UID and prevent client-set privileged flags. Update needs an explicit field allowlist. Delete owner/admin only. |
| `users/{uid}` | get, set merge, update, realtime onSnapshot, batch delete | Profile metadata, email/photo, lastIp, savedAds, online/lastSeen, blockedUsers | Document mixes public and private fields. Owner-only access breaks current public presence lookups and recipient block checks; migrate to split documents first. |
| `stores/{uid}` | get, set merge | Own store load/save; public store detail loads elsewhere | Owner write only, public read only for intentionally public fields. Protect verification/moderation fields. |
| `chats/{chatId}` | query array-contains participants; get/onSnapshot; set merge | Inbox, chat creation, typing, lastUpdated, participants/productId | Reads must require membership. Create must validate participant pair and creator. Updates must allow only defined keys and preserve participant/product identity. |
| `chats/{chatId}/messages/{messageId}` | query, get, ordered limited listener, add, update | Message feed, unread/read receipts, send, hide-for-me, delete-for-everyone | Parent membership required. Sender identity and fields must be validated. Updates need operation-specific transition rules. |

## Confirmed user document fields and operations

Observed writes/reads in `index.html` include:

- `email`, `displayName`, `photoURL`: auth/profile sync; also read by profile display.
- `lastIp`: fetched from an external IP endpoint and written to the user document. Review whether collection is necessary; avoid storing IP if not required.
- `savedAds`: read in realtime and written during save/remove/cart synchronization. Must remain private to owner.
- `isOnline`, `lastSeen`: written on visibility/logout and read for other-user presence. Decide whether public or chat-participant-only.
- `blockedUsers`: read/written by current user and read by sender flow to check whether recipient blocked sender. This cross-user private read is a design flaw; do not preserve it as a broad read permission.

## Confirmed product operations and fields

- Public feed query: `products.orderBy('createdAt','desc').limit(productLimit)`.
- Seller query: `where('sellerUid','==',uid)` used for My Ads/account cleanup.
- Add path writes listing data including `sellerUid`, seller display fields, category/subcategory, title/description, pricing, phone, extra details, coordinates/location/state, images, `isFeatured`, `isShopVerified`, `isSold`, `createdAt`.
- Update paths include stock status (`isSold`) and edit flow writes. Exact complete edit allowlist must be extracted from the full update object before drafting production Rules.
- The create payload currently includes `isFeatured` and `isShopVerified` variables from the browser. Treat both as untrusted; derive privileged values on trusted backend or force safe defaults in Rules.
- Product images are inline data in Firestore, so enforce practical size/count constraints in the client and plan object-storage migration. Rules cannot inspect decoded file bytes.

## Confirmed chat operations

- Chat room IDs are formed as `{productId}_{buyerId}`.
- Chat document fields include `participants`, `productId`, `lastUpdated`, and dynamic typing fields such as `typing_{uid}`.
- Chat creation uses merge writes; price-offer flow also writes `lastUpdated`.
- Message fields include `text`, `attachment`, `senderUid`, `senderName`, `status`, `time`, `createdAt`.
- Read receipt updates `status: 'read'`.
- Delete-for-me uses `hiddenFor: arrayUnion(currentUid)`.
- Delete-for-everyone updates `deletedForEveryone: true`, clears text and attachment; UI checks sender ownership, but Rules must enforce it.
- Message query is ordered by `createdAt` ascending with limit 35; unread logic also queries messages by senderUid.
- Chat create, participant updates, typing updates, message writes, and read receipts must not share one unrestricted write permission.

## Store operations

- Owner store document read in header and store edit flow.
- Store save uses `stores/{user.uid}.set(data,{merge:true})`.
- Observed fields: `uid`, `shopName`, `ownerName`, `address`, `mobile`, `whatsapp`, `sameAsMobile`, `photoURL`, `categories`, `coords`, `createdAt`, `updatedAt`.
- Store photo upload is a direct unsigned Cloudinary upload in the browser; Firestore Rules cannot secure Cloudinary asset ownership. Handle that in the signed-upload backend plan.

## Account deletion path (current risk)

- Queries all products where `sellerUid == uid`, deletes them and `users/{uid}` in one batch, then calls Firebase Auth `user.delete()`.
- This order can leave an Auth account after data deletion if recent-login reauthentication is required. Reauthenticate before destructive deletion.
- Batch size may exceed Firestore's write limit for prolific sellers.
- Does not visibly delete store document, chat history/messages, or Cloudinary assets in this path. Shared chat retention needs a product decision.
- Do not tighten delete rules until account deletion is migrated to a resumable trusted workflow or the client deletion path is explicitly redesigned and tested.

## Migration dependencies before tightening Rules

1. Move public profile display and presence reads away from private `users/{uid}`.
2. Move savedAds and blockedUsers to private owner-only storage; redesign block enforcement so sender does not read recipient private data.
3. Replace browser writes to `stats/traffic` with trusted backend.
4. Audit all product edit payload keys and separate seller-editable from privileged fields.
5. Define chat schema transitions and attachment size/type constraints.
6. Inventory `admin.html` reads/writes and ensure backend admin authorization.
7. Build Firebase Emulator tests for every listed operation and existing user journey.
8. Only then stage Rules changes; never deploy without explicit owner approval.

## Regression scenarios required

- Guest can browse products and store public pages.
- Signed-in user can create, edit, mark sold/available, and delete only their own listing.
- Seller cannot self-verify, self-feature, or change sellerUid.
- User can update their own profile and saved ads; cannot read another user's email, IP, saved ads or block list.
- Intended public/participant presence visibility works as decided.
- Chat inbox shows only participant conversations; outsider cannot read any chat/message.
- Sender can send a message; recipient read receipt works; hide-for-me affects only caller; delete-for-everyone only original sender.
- Block behavior is enforced against direct database writes, not only browser UI.
- Owner can load/save own store; another user cannot write it; public store view exposes only intended fields.
- Account deletion handles reauthentication, many products, retries, and agreed chat/store/media retention.
- Visitor analytics cannot be incremented directly by an untrusted browser.
