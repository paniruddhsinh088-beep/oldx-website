# Firestore Rules Hardening Plan (Draft — No Deployment)

## Status and safety boundary

- Review branch: `security-hardening-review`
- This document is a design and migration plan only.
- No live Firestore Rules, Firebase project settings, data, or production deployment are changed by this document.
- The currently reviewed Rules are the version supplied by the project owner in chat. Confirm the deployed Rules in Firebase Console before any implementation or rollout.
- Do not publish a restrictive Ruleset until the client migration and emulator/regression tests are complete.

## Goals

1. Enforce least-privilege access at the database boundary; never rely on hidden UI controls.
2. Preserve current OLDX behavior during a staged migration.
3. Prevent users from changing seller identity, admin-only product flags, other users' private data, or another user's chat.
4. Move privileged operations (traffic counters, moderation/admin actions, account cleanup, signed Cloudinary operations) to trusted backend code.
5. Make every proposed rule testable with Firebase Emulator Suite before production rollout.

## Risks in the currently supplied Rules

| Path | Current exposure | Required direction |
|---|---|---|
| `admins/{uid}` | Any signed-in user can read any admin document | Users must not enumerate admin records. Prefer server-verified custom claims for admin authorization; if retaining documents temporarily, restrict reads to the signed-in user's own document and do not allow client writes. |
| `users/{uid}` | Public read exposes email, lastIp, savedAds, blockedUsers and presence fields | Split public profile and private account data. Firestore Rules cannot hide selected fields in a document. |
| `stores/{uid}` | Public read and owner writes with no field validation | Keep only intentionally public store fields public; validate owner and allowed fields/types on writes. |
| `products/{id}` | Public read; owner can change most fields, including privileged flags unless separately checked | Validate schema and immutable seller identity; protect moderation, verification, featured and audit fields from seller writes. |
| `stats/{id}` | Anyone can read and write | Remove client write access; trusted backend increments counters with abuse controls. |
| `chats/{id}` | Any authenticated user can create; weak update predicate | Require exact participant membership, valid participant pair, and operation-specific field changes. |
| `chats/{id}/messages/{id}` | Any authenticated user can read/write any message | Require parent chat membership; validate sender, allowed fields, attachment shape/size, timestamps and permitted state transitions. |

## Authorization model

### Admin

- Preferred long-term model: Firebase Authentication custom claim such as `admin: true`, assigned only by trusted Admin SDK code.
- Temporary compatibility model: an allowlisted admin UID / admin document may be used only as a transitional gate. Never trust an email address supplied by the client.
- Admin SDK bypasses Firestore Rules, so every callable/HTTP backend admin endpoint must independently verify the caller's token and admin claim.
- Never allow clients to create or modify admin records or claims.

### User data migration

Target collections (candidate schema; see `PUBLIC_PRIVATE_PROFILE_MIGRATION_PLAN.md`):

- `publicProfiles/{uid}`: only explicitly approved public display fields such as `displayName` and `photoURL`. Do not put global `isOnline` or `lastSeen` here.
- `privateUsers/{uid}`: owner-only private account data and preferences. Store email only if a documented operational need exists; Firebase Authentication remains the identity source. Do not collect/copy `lastIp` unless a documented need is approved.
- `privateUsers/{uid}/savedAds/{productId}`: candidate owner-only Saved Ads records to avoid an unbounded array; confirm legacy metadata needs before implementation.
- `userBlocks/{blockerUid}/blocked/{blockedUid}`: candidate private one-way block relation; only the blocker can read/manage their list. Message authorization must reject a new message from the blocked user to the blocker without exposing the list.
- `chats/{chatId}/presence/{uid}`: candidate participant-scoped presence; only participants in that chat can read it, and a participant can write only their own presence.
- Existing `users/{uid}` remains during a compatibility period. Do not close its access or delete legacy fields until every read/write path is migrated and verified.
- Never copy private fields into `publicProfiles`. Keep a field-level migration inventory, backfill status, and rollback plan.

### Products

- Public reads may remain if marketplace browsing depends on them.
- Create: authenticated seller only; `sellerUid == request.auth.uid`; validate required fields, types, maximum string/array sizes, image count and permitted status defaults.
- Update: seller may change only an explicit allowlist of ordinary listing fields. Require `sellerUid` to remain unchanged.
- Seller must not set or modify `isFeatured`, `isShopVerified`, moderation state, admin notes, or audit fields.
- Delete: owner or verified admin only. Admin verification must not rely on a client-controlled field.
- Before applying an allowlist, inventory every field written by create, edit, sold/unsold, offer, and moderation flows. Avoid accidentally blocking legitimate existing features.

### Stores

- Public reads should expose only store information intended for public display.
- Owner create/update/delete requires `request.auth.uid == userId`.
- Validate field allowlists and types. Protect verification/featured/moderation fields from owner edits.
- Cloudinary asset ownership and deletion must be handled by trusted backend code, not client-supplied public IDs.

### Chats and messages

- Chat reads require the signed-in UID to be in the chat's participant list.
- Chat creation must validate exactly the intended buyer/seller participants, no duplicate participants, and authenticated creator is one of them. Validate product linkage if the app requires it.
- Chat updates should permit only known fields, e.g. typing indicators for the current user and a bounded `lastUpdated`; do not allow participants or product linkage to be rewritten.
- Message read requires parent chat membership.
- Message create requires `senderUid == request.auth.uid`, sender is a parent participant, and only approved fields are present.
- Message update must be narrowly scoped to supported transitions: read receipt by recipient, hide-for-me by the requesting participant, and delete-for-everyone only by the original sender within 15 minutes of the server-created message timestamp. Use trusted server time and immutable `createdAt`; if Rules cannot safely enforce the exact time window, use a trusted backend endpoint.
- Approved block behavior is one-way: a blocked user cannot send new messages to the blocker. Both parties retain access to existing chat history. Do not assume the blocker is also prevented from sending unless separately approved.
- Online Status / Last Seen is visible only to participants in the relevant chat, never publicly through a profile document.
- Do not permit arbitrary message overwrite or deletion.
- Attachments require a strict MIME allowlist and size limits; Firestore Rules cannot inspect the actual bytes of a data URL. Long-term, move large attachments to controlled object storage with backend validation.
- Blocking is not securely enforced merely by checking another user's private `blockedUsers` field in browser code. Define the authoritative block direction and enforce sending through a trusted backend or a rules-verifiable block record. Avoid exposing private block lists.

### Stats / traffic

- Deny client writes to `stats`.
- Move counting to a trusted endpoint or analytics provider with rate limiting, deduplication and bot/abuse considerations.
- Preserve public read only if a visible counter genuinely requires it; otherwise expose aggregate values through a controlled read path.

## Rollout sequence (compatibility first)

1. Export/record the currently deployed Rules and confirm Firebase project ID/environment.
2. Build a collection/field access matrix from all client reads and writes.
3. Add emulator tests for current intended behavior before changing Rules.
4. Implement public/private data dual-write and backfill on the review branch; verify counts and sampled records.
5. Switch client reads to new collections behind a compatibility strategy; monitor missing profile/saved-ad/presence data.
6. Harden product/store/chat rules with field allowlists and operation-specific checks only after client writes match the schema.
7. Move stats and privileged operations to trusted backend; then remove client write permissions.
8. Run all emulator tests and manual regression scenarios.
9. Review diff and obtain explicit owner approval before any Firebase Console Rules publication or production deployment.
10. Keep a rollback Ruleset and documented rollback criteria.

## Required Emulator test matrix

### Authentication and ownership
- Unauthenticated reads/writes are denied wherever intended.
- User A cannot read or modify User B's private document.
- User A cannot write User B's public profile.
- Client cannot create/update/delete admin records or assign admin claims.

### Products and stores
- Public listing read remains available.
- Seller can create and edit their own permitted listing fields.
- Seller cannot change `sellerUid`, verification, featured, moderation or admin-only fields.
- Another seller cannot edit/delete the listing.
- Owner can manage own store; another user cannot.
- Store owner cannot self-verify or self-feature.

### Chat
- Non-participant cannot read chat or messages.
- Participant can read the conversation.
- Non-participant cannot create a message in another chat.
- Sender UID spoofing is rejected.
- Participant list/product linkage cannot be changed after creation.
- Only intended read-receipt, hide-for-me and delete-for-everyone transitions succeed.
- Arbitrary message updates/deletes fail.
- Blocking behavior is tested from both sides and cannot be bypassed by direct Firestore writes.

### Stats and backend
- Client writes to stats are denied after backend migration.
- Backend rejects unauthenticated or unauthorized requests.
- Repeated requests are rate-limited/deduplicated as designed.

## Open decisions before implementation

- Confirm the exact deployed Ruleset and Firebase project/environment.
- Owner-confirmed: Online Status / Last Seen is visible only to participants in the relevant chat.
- Owner-confirmed: only the original sender may Delete for Everyone within 15 minutes; Delete for Me is a separate per-user hide action.
- Owner-confirmed: blocking is one-way; the blocked user cannot send new messages to the blocker, while both parties retain access to existing chat history.
- Still confirm the exact public profile allowlist, presence lifecycle, Saved Ads legacy metadata, and account deletion/retention details before implementation.
- Confirm product/store fields that sellers may edit after listing publication.
- Confirm whether saved ads are strictly private to the owner.
- Confirm whether product and chat attachments remain inline temporarily or migrate to object storage.

## Acceptance criteria

- No client can read private account data belonging to another user.
- No client can grant itself admin, verification, featured, moderation or seller ownership privileges.
- Chat access and mutations are limited to the intended participants and operations.
- Stats and privileged operations cannot be forged through direct client writes.
- Existing user flows pass emulator and manual regression tests before release.
- No production Rules or deployment change occurs without explicit approval.
