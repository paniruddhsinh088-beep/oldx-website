# OLDX User Data Migration — Implementation Specification

Branch: `security-hardening-review`
Status: **Design only — no production changes and no active migration**

## Scope

Introduce two new documents while retaining the legacy `/users/{uid}` document during a staged compatibility period:

- `/publicProfiles/{uid}`: `displayName`, `photoURL`, `isOnline`, `lastSeen`.
- `/privateUsers/{uid}`: `email`, `lastIp`, `savedAds`, `blockedUsers`.

Do not copy additional legacy fields by default. Confirm any additional fields by tracing their use first.

## Code locations verified in the current branch

The following current client behaviors were inspected in `index.html`:

1. `auth.onAuthStateChanged` writes `email`, `displayName`, and `photoURL` to `/users/{uid}`.
2. IP lookup writes `lastIp` to `/users/{uid}`.
3. Login loads and merges `savedAds` from `/users/{uid}`; `startRealtimeSavedAdsSync` listens to that document.
4. `setUserOnlineStatus` writes `isOnline` and server timestamp `lastSeen` to `/users/{uid}`.
5. `trackUserStatus(otherUserId)` reads another user's `displayName`, `isOnline`, and `lastSeen` from `/users/{otherUserId}`.
6. `openChatPrivacyMenu` reads/writes the current user's `blockedUsers`.
7. Message-send flow reads the recipient's `blockedUsers` from their user document.
8. Account deletion deletes the legacy `/users/{uid}` document.
9. Signup writes `email`, `displayName`, and `photoURL` to the legacy user document.

## Proposed implementation sequence

### Stage A — Compatibility helpers (code-only, not activated)

Add narrowly scoped helpers in a separate module/file or a clearly isolated section of `index.html`:

- `writePublicProfile(uid, profile)`
- `writePrivateUser(uid, privateData)`
- `readPublicProfile(uid)`
- `readPrivateUser(uid)`

Helpers must:
- Accept only an allowlisted set of keys.
- Never copy a whole legacy user document.
- Use merge writes.
- Return/propagate errors rather than silently treating a failed write as success.
- Avoid logging email, IP, saved ads, or blocked-user lists.
- Not be called until corresponding Rules have been reviewed and deployed with explicit owner approval.

### Stage B — Backfill

Use a trusted Admin SDK script or Cloud Function, never a browser client, to copy existing records. Make it idempotent and produce counts/errors without printing personal data. Test against a non-production Firebase project or emulator first.

### Stage C — Dual-write

After Rules and target collections are ready, write public fields to both legacy `users` and `publicProfiles`; write private fields to both legacy `users` and `privateUsers`. Treat partial failure explicitly; do not silently report success if only one write succeeds.

### Stage D — Read migration

- Switch `trackUserStatus` to `publicProfiles`.
- Switch saved ads listener/load to `privateUsers`.
- Switch own block-list reads/writes to `privateUsers`.
- Remove the recipient's private block-list read from the browser. Enforce blocking at message-write authorization using a trusted, rules-verifiable data model; Firestore Rules cannot safely query arbitrary user documents as a general-purpose block-check service.
- Keep a temporary fallback to legacy reads only while migration coverage is measured and security implications are accepted.

### Stage E — Cleanup

Only after all supported clients have migrated:
- Stop legacy dual-writes.
- Remove legacy private fields through a trusted migration.
- Tighten `/users` Rules to prevent public reads.
- Remove legacy documents only with explicit approval and verified backups.

## Important blocking design issue: block enforcement

The current message-send flow reads another user's `blockedUsers` client-side. This is not a secure authorization boundary. A robust design needs a trusted, Rules-verifiable representation of the relationship (for example a per-user block subcollection with a carefully tested rules path, or a backend-mediated message send). Do not claim blocking is securely enforced until this is implemented and tested.

## Required Firestore Rules design constraints

- `publicProfiles`: public read only for explicitly public profile/presence fields; owner-only writes with strict key/type validation.
- `privateUsers`: owner-only read/write, with a separate narrowly scoped admin mechanism if required.
- `users`: maintain compatibility only during the approved transition; ultimately no public read.
- `stats`: client writes must be removed only after visitor counting is moved to a trusted backend.
- `chats` and `messages`: membership checks plus operation-specific field validation; do not use a broad authenticated-user write rule.

This specification intentionally contains no deployable Rules block because the exact message, chat, account, and profile payloads must be validated against the complete client code and tested in the Firestore Rules Emulator.

## Test matrix before activation

- [ ] Signup and login create/update both target documents.
- [ ] Existing user with only legacy data is migrated without losing Saved Ads.
- [ ] Profile name/photo changes update public profile.
- [ ] Online/offline and last-seen updates work.
- [ ] Saved Ads load, merge guest items, sync in real time, and persist across reload.
- [ ] Block/unblock UI behaves as intended; message authorization rejects blocked conversations server-side.
- [ ] Chat, typing, read receipts, hide-for-me, and delete-for-everyone work for both participants.
- [ ] Account deletion removes both new documents and legacy document.
- [ ] Admin dashboard has only the minimum required access.
- [ ] Emulator tests prove private fields cannot be read by another user or unauthenticated visitor.
- [ ] Failure injection confirms partial writes do not create silent data divergence.

## Safety boundary

No Firebase Console changes, Rules deployment, production data backfill, or live website deployment is authorized by this specification. Those require separate explicit approval.
