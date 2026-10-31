# OLDX Complete User Data Read/Write Audit

**Branch:** `security-hardening-review`  
**Status:** Static source audit of the current branch; no application code, Firebase data, Rules, secrets, or deployment changed.  
**Audit date:** 2026-10-31  
**Safety boundary:** Findings and recommendations only. All implementation and data migration remain gated on Staging tests and explicit owner approval.

## 1. Executive summary

The current browser application uses `users/{uid}` as a mixed document containing public display data, private identity/preferences, presence, and block-list data. Chat UI reads another user's mixed document to show display name and presence. This means a broad read permission would expose private fields, while a private-only rule would break existing chat display and related flows.

Other material findings:
- Saved Ads are stored in a single array on `users/{uid}` and synchronized through document reads/listeners and merge writes.
- The browser writes a client-reported IP address to `users/{uid}.lastIp`; this is not verified security evidence.
- Chat block logic reads the recipient's private `blockedUsers` array from the browser. This is not an acceptable privacy or authorization boundary.
- Presence currently lives on the global user document. Owner-approved policy requires presence/last-seen to be visible only to participants in the relevant chat.
- Account deletion removes product documents and the legacy user document before deleting the Firebase Auth account; a later Auth failure can leave a partially deleted account.
- Admin UI currently reads all Products and all Users into browser memory, displays email/IP, and permanently deletes Products directly from the browser.
- Store documents are read by the public Store page and include contact fields such as address/mobile/WhatsApp. Public exposure needs an explicit field-by-field consent and privacy decision.
- The Admin backend read adapter has allowlisted fields and pagination-oriented code, but its README says it is not a complete runtime and collection reads must remain disabled until staging readiness checks are completed.

## 2. Source scope and evidence quality

Primary application files inspected:
- `index.html` — authentication, profile, Saved Ads, presence, chat, account deletion, store, product flows.
- `admin.html` — Admin dashboard reads, user/forensic view, product deletion.
- `functions/admin-backend/admin-read-adapter.mjs`
- `functions/admin-backend/admin-read-executor.mjs`
- `functions/admin-backend/http-handler.mjs`
- `functions/admin-backend/README.md`

Related design contracts reviewed:
- `USER_PROFILE_DATA_INVENTORY.md`
- `USER_DATA_MIGRATION_SPEC.md`
- `USER_PROFILE_MIGRATION_COMPATIBILITY_PLAN.md`
- `ACCOUNT_DELETION_AUDIT.md`
- `STORAGE_DATA_AUDIT.md`
- `PRODUCT_WRITE_CONTRACT_INVENTORY.md`
- `CHAT_STORE_WRITE_CONTRACT_INVENTORY.md`
- `ADMIN_CLIENT_ACCESS_AUDIT.md`

This is static code inspection, not a runtime permission test or a live-data audit. Line numbers below refer to the audited `security-hardening-review` branch snapshot and may move as code changes.

## 3. User identity and profile data

| Flow / source | Current operation | Fields | Actor and current boundary | Finding / target |
|---|---|---|---|---|
| Auth state sync, `index.html:2074-2085` | Merge-write `users/{uid}` | `email`, `displayName`, `photoURL` | Signed-in user writes own doc | Email should remain in Firebase Auth unless a verified feature requires a Firestore copy. Display name/photo are public-profile candidates, subject to validation and owner policy. |
| Signup/auth flows, `index.html:3260-3359` | Additional merge-writes to `users/{uid}` | `email`, `displayName`, `photoURL` | Signed-in user writes own doc | All signup variants must be migrated together; do not cut over only one login path. |
| Profile editor, `index.html:2827-2879` | Reads own user doc; writes profile fields and email | `photoURL`, `displayName`, `email` | Owner reads/writes own doc | Move approved display fields to public profile; avoid redundant email write. Photo currently may be a compressed data URL, not necessarily a trusted HTTPS URL. Validate actual size/type and preserve legacy fallback during migration. |
| Profile display, `index.html:3406-3415` | Reads own user doc for photo | `photoURL` | Owner | Must read the canonical public profile after a tested cutover. |
| Chat header, `index.html:2427-2445` | Realtime-read another user's user doc | `displayName`, fallback `name/fullName/username`, `isOnline`, `lastSeen` | Chat participant reads other user's whole mixed doc | Replace with approved public display projection plus chat-scoped presence. Never grant broad read access to private user data to support this UI. Fallback field precedence needs explicit compatibility mapping. |

### Target boundary

- Candidate `publicProfiles/{uid}`: only approved display fields, initially `displayName` and `photoURL`. Do not expose presence globally.
- Candidate `privateUsers/{uid}`: owner-only preferences and private settings, only after field-level inventory and migration contract.
- Firebase Authentication remains the primary source for verified email/identity.
- Trusted server-only records must hold verified security signals, Admin roles, audit events, and migration state. Browser clients must not write these records.

## 4. Saved Ads and local-device state

| Flow / source | Current operation | Fields / storage | Finding / target |
|---|---|---|---|
| Login merge, `index.html:2095-2128` | Reads localStorage guest/user lists, reads `users/{uid}`, merges entries, writes array back | `savedAds` | Supports guest-to-account continuity. Migration must preserve both legacy string IDs and object entries using `docId`; validate and bound list size. |
| Realtime sync, `index.html:1816-1828` | Listener on whole `users/{uid}` | `savedAds` | Replace with owner-only `privateUsers/{uid}` or a bounded per-user subcollection after shape/performance review. |
| Add/remove/sync, `index.html:3558-3564`, `3636`, `3713` | Merge-writes Saved Ads array | `savedAds` | Owner-only writes; prevent arbitrary fields from being written through a broad profile update. Consider subcollection if array growth becomes large. |
| UI count, `index.html:3461` and local storage helpers | Reads local device list | localStorage | Local cache is not authoritative authorization data. Logout/account-switch behavior and stale cache handling need regression tests. |

**Acceptance:** guest saved ads merge into an existing account without duplicates or loss; Saved Ads survive logout/login and reload; realtime sync is owner-only; User A cannot read or overwrite User B's saved list; malformed/oversized entries are rejected safely.

## 5. Presence and block-list privacy

### Presence

- `index.html:2133-2139`: signed-in user writes `isOnline` and server timestamp `lastSeen` to global `users/{uid}`.
- `index.html:3483-3489`: logout writes offline state and last-seen timestamp.
- `index.html:2430-2445`: another user's global document is watched to display Online / Last seen.

**Owner-confirmed policy:** Online Status / Last Seen must be visible only to participants in the relevant chat, not to all users or guests. Keep presence in a chat-scoped participant record (or equivalent trusted model), with Rules requiring membership in that chat. Do not copy `lastSeen` to a public profile. Test both participants, non-participants, guests, and chat switching/unsubscribe lifecycle.

### Blocking

- `index.html:2659-2678`: current user reads and updates own `users/{uid}.blockedUsers` array.
- `index.html:2749-2757`: message send reads recipient's `users/{recipientUid}.blockedUsers` array and checks whether current sender is blocked.

**Owner-confirmed policy:** block is one-way; blocked user cannot send new messages to blocker; existing chat and history remain visible to both participants; block list is private; unblock restores intended message flow. Delete-for-everyone remains limited to original sender within 15 minutes; delete-for-me is separate.

**Unresolved implementation detail:** whether the blocker can still send messages to the blocked user has not been explicitly decided. Do not silently turn the one-way policy into a mutual block.

**Required redesign:** remove browser reads of another user's private block list. Enforce at a trusted authorization boundary or with a carefully proven Rules-verifiable relation. Existing history must remain readable; block should prevent only the prohibited new-message direction. Tests must cover block, unblock, old chat history, both participants, and direct Firestore writes bypassing the UI.

## 6. Account deletion and user-owned data

- `index.html:1762-1785`: current flow queries all products with `sellerUid == uid`, batches deletion of those product docs and `users/{uid}`, commits, then calls Firebase Auth `user.delete()`.
- `ACCOUNT_DELETION_AUDIT.md` documents the partial-deletion and reauthentication risks.
- `STORAGE_DATA_AUDIT.md` records product images and chat attachments inline in Firestore, profile photos as data URLs in the user doc, and store photos uploaded to Cloudinary. Current inspected flow does not clean Cloudinary assets and does not delete shared chat history.

**Risks:**
1. Firestore deletion happens before Firebase Auth deletion. If Auth deletion fails or requires recent login, products/user doc are already gone while account remains.
2. No complete resumable cleanup of future `publicProfiles`, `privateUsers`, savedAds subcollections, block relations, presence, or store records is in place.
3. Shared chat messages/attachments must not be erased automatically without a separately approved retention and other-participant impact policy.
4. Cloudinary assets must never be deleted by guessing identifiers from URLs; persist verified provider deletion IDs before designing cleanup.
5. Product deletion and legal/retention obligations require a recovery and hold policy.

**Target:** trusted, resumable, idempotent deletion workflow with reauthentication before destructive stages, checkpoints, bounded batches, safe retries, redacted status/error logs, and explicit policy for Stores, products, chats, and third-party media. Do not tighten delete Rules until the workflow is tested.

## 7. Admin access to user and marketplace data

### Current Admin browser behavior

- `admin.html:242-272`: `fetchAllAdminData()` reads `stats/traffic`, executes unbounded `products.get()`, caches all product documents in `allAdsCache`, then executes unbounded `users.get()` and caches all user documents in `allUsersCache`.
- `admin.html:357-379`: user table renders display name, email, last IP and UID; client-side search filters cached data.
- `admin.html:381-410`: forensic modal renders user name, registered email, UID, last IP, and last-seen activity.
- `admin.html:329-338`: Admin UI directly deletes `products/{docId}` permanently from browser after confirmation.

**Risks:** unbounded reads and browser-side caching of all user PII; Admin data access is not least-privilege; UI gating is not an authorization boundary; permanent product deletion lacks quarantine/recovery and atomic audit protection.

### Backend scaffold observed

- `functions/admin-backend/admin-read-adapter.mjs`: current allowlisted read definitions include `products.list` fields `title, category, finalPriceStr, location, sellerUid`; `users.list` fields `displayName, status`; and `stores.list` fields `shopName, ownerName, address, categories, createdAt`.
- `functions/admin-backend/README.md`: explicitly says this is not a complete HTTP server/Firebase Admin integration/permission grant. Collection reads must not be enabled in a real runtime until staging collection readiness checks pass.
- Existing Admin API contracts require verified Firebase ID token, server-derived UID and Admin role, bounded pagination, field allowlists, rate limits, no-store responses and append-only audit events.

**Required target:** verified-admin-only backend; server binds identity to immutable Firebase Auth UID and owner-controlled Admin registry. Keep email/IP out of ordinary Admin list payloads; provide narrowly scoped investigative access only when owner-approved and legally justified, with audit trail. Product moderation should first use reversible quarantine/soft-delete with reason and audit event; permanent deletion only after retention/legal-hold/recovery checks. Do not let Admin UI grant/revoke Admin roles or erase audit history.

## 8. Store data and public contact exposure

- `index.html:3900-3914`: Store header reads `stores/{uid}` for the signed-in owner.
- `index.html:3946-3960`: Store edit form reads own Store fields.
- `index.html:4094-4105`: owner writes `uid, shopName, ownerName, address, mobile, whatsapp, sameAsMobile, photoURL, categories, coords, updatedAt` and create-time `createdAt`.
- `index.html:4130-4168`: public Store page reads `stores/{ownerUid}` and renders shop name, owner name, address, WhatsApp, phone, map location and categories; it queries all products for the seller.

**Privacy issue:** current Store document combines public business profile and direct contact/location data. Public read access should not be enabled for the entire document until each field is confirmed as intentionally public and owner consent is explicit. Split public store projection from private owner/contact settings if needed. Preserve public store usability through clear opt-in controls; do not hide or break contact features without a user-facing migration plan.

## 9. Other related data and write-contract dependencies

- `index.html:1544-1558`: visitor counter reads and writes `stats/traffic.totalViews` from the browser. Move increments to trusted/abuse-limited service before denying client writes.
- `index.html:4667-4694`: product creation writes `sellerUid`, `sellerName`, client-derived `userIp`, category/details/prices/phone/location/images, `isFeatured`, `isShopVerified`, `isSold`, and server `createdAt`. Existing product contract says privileged flags must not be client-controlled; remove client-provided `isFeatured`/`isShopVerified` before enforcing Rules. Client IP is untrusted and should not be used as evidence.
- `index.html:4468-4481`: offer flow creates/merges chat room and message with participants/product ID, sender UID/name, offer text, inline image attachment and timestamps. It must use the same participant, immutable-room, block and message validation contract as normal chat.
- `index.html:2773-2785`: normal chat message writes sender UID/name, status, client-formatted time, server timestamp and optional attachment.
- `index.html:2644-2654` (previous chat contract inventory): hide-for-me updates `hiddenFor`; delete-for-everyone clears message content and attachment with a flag. Rules must constrain changed keys, original sender and 15-minute limit.
- `index.html:2543` (previous chat contract inventory): read receipts update message status; enforce recipient-only state transition.
- Product/store and chat write contracts are documented in `PRODUCT_WRITE_CONTRACT_INVENTORY.md` and `CHAT_STORE_WRITE_CONTRACT_INVENTORY.md`; this user-data audit does not replace those contracts.

## 10. Recommended target data map (design only)

| Data | Proposed home | Read boundary |
|---|---|---|
| Display name, approved profile image | `publicProfiles/{uid}` | Public/chat display only for explicitly approved fields |
| Email / private settings | Firebase Auth; `privateUsers/{uid}` only if feature requires it | Owner and separately authorized trusted Admin workflow |
| Saved Ads | `privateUsers/{uid}` or `privateUsers/{uid}/savedAds/{productId}` | Owner only |
| Block relation | Private block subcollection or trusted backend relation | Blocker only for list visibility; enforcement without exposing list |
| Online / last-seen | `chats/{chatId}/presence/{uid}` or equivalent | Only participants in that specific chat |
| Verified IP/security signals | Trusted server-only collection if justified | Narrow investigative backend access, audited |
| Admin roles and audit events | Trusted server-only collections | Backend only; immutable/append-only as appropriate |
| Store public details | `publicStores/{uid}` or strict public projection | Owner-consented public fields only |
| Store private contact details | Private Store owner data | Owner and narrowly authorized workflows |

This map is a proposal, not an approved schema or deployed configuration. Keep legacy `users/{uid}` during compatibility; never copy whole documents.

## 11. User-first migration and compatibility sequence

1. **Finish static inventory:** trace every read/write path across current source and confirm alternate/legacy clients.
2. **Freeze field contracts:** approve public profile allowlist, photo representation/limits, Saved Ads schema, presence lifecycle, Store contact visibility and account-deletion behavior.
3. **Build isolated helpers:** allowlisted public/private read/write helpers; do not activate before Rules and compatibility are ready.
4. **Staging-only synthetic tests:** create synthetic users/chats/products/stores; no real-user PII export. Confirm dry-run zero writes and project-ID guard.
5. **Trusted migration dry run:** aggregate counts/type anomalies only, redact identifiers and values, test idempotency/checkpoints.
6. **Dual-write and read fallback:** only after Rules are reviewed and staging-approved; explicitly handle partial failures and do not silently report success.
7. **Feature regression:** signup/login, profile edit, Saved Ads guest merge/realtime, chat display, presence, block/unblock, inbox, offers, typing, read receipts, delete-for-me/everyone, store edit/public page, product create/edit/sold toggle, logout and account deletion.
8. **Rules Emulator negative and positive tests:** verify owner boundaries, guest behavior, nonparticipant denials, immutable identity fields, block enforcement, and public field allowlists.
9. **Staging UX and mobile/slow-network tests:** ensure ordinary users can complete normal tasks without unnecessary admin approval or confusing permission failures.
10. **Production proposal:** only after evidence review and separate explicit owner approval. No automatic Production cutover.

## 12. Acceptance checklist

- [ ] Guest reads only approved public profile/store/product fields.
- [ ] User A cannot read or modify User B's private profile, Saved Ads, or block list.
- [ ] Chat participants can display approved names without reading private user documents.
- [ ] Presence and last-seen are visible only to participants in the relevant chat.
- [ ] Blocked user cannot send new messages to blocker through UI or direct database writes.
- [ ] Existing chat history remains available after block; unblock restores intended flow.
- [ ] Saved Ads guest merge, realtime sync, persistence, and account switching work.
- [ ] Public Store page shows only owner-approved fields; private contact data is not exposed by default.
- [ ] Admin user/product/store reads are authenticated, paginated, allowlisted and audited.
- [ ] Email/IP are excluded from ordinary Admin list responses; exceptional access is purpose-limited and audited.
- [ ] Admin product action is reversible quarantine before any permanent deletion.
- [ ] Account deletion reauthenticates first and is resumable/idempotent across all approved collections.
- [ ] No raw PII is written to migration logs or CI artifacts.
- [ ] Emulator and Staging tests pass without touching Production.

## 13. Open decisions / blockers (do not guess)

1. Confirm whether `photoURL` must remain a data URL or can be migrated to an approved image host/storage representation without breaking old clients.
2. Define exact public Store fields and explicit owner opt-in for address, mobile, WhatsApp and coordinates.
3. Define whether Firestore email is needed anywhere outside Firebase Auth.
4. Define lifecycle/expiry and cleanup of chat-scoped presence records.
5. Confirm Saved Ads legacy object shape and maximum supported list size using synthetic fixtures and source tracing.
6. Resolve whether blocker may continue sending to blocked user; current approved policy explicitly forbids blocked-user-to-blocker new messages only.
7. Define product/store account-deletion and chat retention behavior, including legal holds and other-participant history.
8. Confirm whether legacy `name/fullName/username` fields exist in supported records and which display precedence is intended.
9. Complete remaining repository-wide source scan for any other pages, scripts or backend handlers that read/write these collections before implementation.

## 14. Explicit safety statement

This audit changes documentation only. It does not:
- edit `index.html` or `admin.html`;
- change Firebase Firestore data or Rules;
- read real Staging or Production user records;
- run a backfill or migration;
- change Vercel, Firebase, Cloudinary, or secrets;
- deploy a website or backend;
- authorize Production changes.

All code, schema, Rules, migration, backend and deployment work remains staged and separately approval-gated.


## 15. Expanded repository-wide access-path scan (follow-up)

The complete tracked-file tree at audit commit `ebf7701e02a8618f28b18d167545797847efc6db` was reviewed. The only browser HTML entry points in this repository are `index.html` and `admin.html`. The `functions/admin-backend/` files are dependency-injected security primitives and tests; the README explicitly confirms there is no deployed Firebase Admin/HTTP runtime. No other tracked application page or backend runtime was found performing Firestore reads/writes. This does not cover code or services outside this repository.

### Chat room and message access paths

| Source | Operation | Required data / rule implication |
|---|---|---|
| `index.html:2182-2225` | Realtime query `chats` where `participants array-contains uid`; then queries each `messages` subcollection for messages with `senderUid != uid` | Room list must be participant-scoped. Message reads must be participant-scoped too. Current unread counter downloads all matching messages per room and counts `status != read`; this is unbounded and should be replaced by per-user unread counters or bounded query/index strategy after correctness tests. |
| `index.html:2277-2310` | Inbox fetches all participant rooms and loads each room's messages ordered by `createdAt desc` | Must preserve Inbox ordering and unread sorting. Add pagination/limits; avoid loading entire conversation histories to build the Inbox. |
| `index.html:2398-2415` | Creates/merges room with `participants` and `productId`; then opens messages, presence and typing | Room identity and participant list must be immutable after trusted creation. Validate buyer/seller are actual participants and product reference is legitimate. |
| `index.html:2495-2505` | Writes dynamic `typing_<uid>` booleans on chat room | Only a room participant may change only their own typing key; strict allowed-key validation and bounded stale state. Consider presence/typing subcollection to avoid broad room update permissions. |
| `index.html:2511-2533` | Realtime chat room read for other participant typing state | Must require participant membership; typing is not public. Ensure listener unsubscribes when chat changes/closes. |
| `index.html:2535-2565` | Reads messages ordered by `createdAt asc`, limit 35; separately reads other-sender messages and updates each `status=read` | Participant-only message read. Read receipt must only allow recipient to make permitted transition; current per-document loop may produce many writes and needs bounded batch/transaction or trusted endpoint. |
| `index.html:2641-2655` | Updates `hiddenFor` array for Delete for Me; clears `text/attachment` and sets `deletedForEveryone` for Delete for Everyone | Delete-for-me must add only caller UID and preserve other fields. Delete-for-everyone must verify original sender and server-side 15-minute window; UI's sender check alone is not security. |
| `index.html:2763-2785` | Writes own typing false, room `lastUpdated`, then creates message with text, attachment, sender UID/name, status, client time and server timestamp | Sender UID must equal Auth UID; senderName/status/time cannot be trusted for authorization. Validate message length, attachment type/size and allowed field set. Enforce block direction at Rules/trusted boundary. |
| `index.html:4468-4481` | Offer flow merges room participants/productId/lastUpdated then adds offer message and inline product image | Must share the same trusted room creation and message validation path; do not allow this secondary path to bypass block, participant or immutable-room constraints. |

### Product access paths and seller experience

- `index.html:2950-2955`: seller toggles own product `isSold`. Preserve this simple action with a field-level allowlist and immutable `sellerUid`.
- `index.html:2958-2975`: seller delete path is a direct product delete; verify ownership and whether product deletion should be soft-delete/quarantine for recovery/retention.
- `index.html:3017-3120`: product detail/edit paths read and update product documents; all editable fields and privileged fields must be fully enumerated before Rules allowlists are written.
- `index.html:3685-3713`: product listing realtime query and Saved Ads cleanup logic; ensure listing query compatibility and do not let Saved Ads cleanup mutate other users' data.
- `index.html:4693`: product creation uses client write. Current payload includes client-derived `userIp`, `isFeatured`, and `isShopVerified`; the latter two must not be client-controlled privilege flags. Keep `sellerUid` bound to Auth UID and `createdAt` server-generated.
- Account cleanup's seller-products query at `index.html:1770` is unbounded; any replacement cleanup must page in bounded batches and be resumable.

### Admin backend readiness cross-check

- `admin-read-adapter.mjs` allowlists a narrow field set and enforces page size 1–50 with cursor ordering by `createdAt`.
- `admin-read-executor.mjs` rejects operations unless explicitly enabled by trusted composition; default enabled list is empty.
- `http-handler.mjs` requires verified authorization dependencies, no-store headers, and an injected strict mutation validator/atomic commit adapter; it is not itself a deployed backend.
- The read adapter requires valid `createdAt` on every returned document. Repository readiness notes state Users lacks a verified universal `createdAt`; legacy Product/Store coverage is unproven. Therefore real collection operations must remain disabled until approved read-only Staging evidence is available.
- The current adapter's Users allowlist is `displayName,status`, while the current Admin page expects `displayName,email,lastIp,uid,lastSeen`. This is an intentional security boundary mismatch to resolve through a redesigned Admin UI and exceptional audited investigative endpoint—not by broadening the normal Users list with email/IP.

### Confirmed repository-scope boundary

The scan covered all tracked files in the review branch and found browser Firestore collection access concentrated in `index.html` and `admin.html`; the backend folder contains testable primitives, not a live data plane. Before implementation, repeat the scan after any new page, worker, function, or integration is added. Do not treat this static scan as proof of live Firebase Rules or production data shape.
