# OLDX Public / Private User Data Migration Plan

**Branch:** `security-hardening-review`  
**Status:** Design proposal based on static source inspection; not implementation.  
**Safety:** No Firebase data was read, migrated, changed, or deleted. No Firestore Rules, application code, IAM, backend, or deployment was changed. Production remains untouched.

## 1. User-first goals

This migration must improve privacy without making normal OLDX tasks harder.

- A user can continue browsing public listings and public seller/store pages without unnecessary login prompts.
- A signed-in user can edit their own display name and photo, manage Saved Ads, and use chat normally.
- A seller can continue managing their own store and permitted product fields.
- A user cannot read another user's email, saved items, block list, private settings, or unrelated activity.
- Chat participants retain access to their existing conversation history, including after a one-way block, subject to normal hide/delete rules.
- Security changes are introduced only after all client read/write paths and regression tests are ready.

## 2. Current source observations

Static inspection of `index.html` on `security-hardening-review` found:

| Existing behavior | Source locations (approx.) | Migration impact |
|---|---:|---|
| User document is deleted during account cleanup | 1777–1778 | Cleanup must cover new private/public paths and agreed retention |
| Saved Ads realtime listener reads `users/{uid}.savedAds` | 1816–1826 | Move listener to owner-only private data |
| Login/signup flows write displayName and photoURL to `users/{uid}` | 2081–2090, 3260–3359 | Dual-write/switch profile writes |
| Saved Ads load and writes use `users/{uid}.savedAds` | 2111–2123, 3558–3713 | Migrate all read/write paths together |
| Online status and lastSeen write to the user document | 2135–2137, 3486–3488 | Replace global profile presence with chat-scoped presence |
| Chat header reads another user's `users/{uid}` document for name/status | 2430–2442 | Read public profile plus participant-scoped presence |
| Block UI reads/writes `users/{uid}.blockedUsers` | 2661–2672 | Replace with private authoritative block relation |
| Message send path checks recipient's `blockedUsers` | 2750–2751 | Preserve enforcement without exposing block lists |
| Edit profile reads/writes `users/{uid}` | 2828–2877 | Move editable public fields to public profile |
| Profile display reads `users/{uid}` for photo | 3409–3415 | Switch to public profile / Firebase Auth fallback |
| Saved Ads sync writes to `users/{uid}` | 1819–1826, 3558–3713 | Keep owner-only access and handle legacy data |

These are static code observations, not runtime proof. Before implementation, re-scan the full current branch and every other client/admin file for all reads, writes, queries, account cleanup, and legacy fallbacks.

## 3. Proposed target data model

This is a candidate schema for review, not a final Rules contract.

### A. `publicProfiles/{uid}`

Only fields intentionally visible to other users:

- `displayName`
- `photoURL`
- Optional public profile fields only after explicit product/privacy approval.

Rules direction:
- Public read only for the approved allowlist.
- Only the matching authenticated UID can create/update their own editable fields.
- No email, IP address, Saved Ads, block list, private preferences, or global presence fields.
- Do not allow clients to add privileged fields such as admin, verification, moderation, or featured status.

### B. `privateUsers/{uid}`

Owner-only account data:

- `email` only if a Firestore copy is operationally necessary; Firebase Authentication remains the authoritative identity source.
- Private preferences and migration metadata.
- Any other account field only after its purpose and retention are documented.

Rules direction:
- Only `request.auth.uid == uid` can read the owner's private data.
- Client writes use a strict allowlist and cannot change trusted/admin-managed fields.
- `lastIp` should not be collected or copied unless a documented security/legal need is approved. If retained, it must be server-written and tightly restricted.

### C. `privateUsers/{uid}/savedAds/{productId}`

Candidate owner-only Saved Ads subcollection rather than a growing array:

- Document ID is the product ID.
- Store only the minimum fields needed to restore the Saved Ads list; prefer product reference and server timestamp.
- Validate product ID and prevent one user from writing another user's Saved Ads.
- If current UI needs an array during transition, support it only as a temporary compatibility field and define a bounded migration.

User benefit: Saved Ads remain private and can be updated individually without rewriting a large array.

### D. `userBlocks/{blockerUid}/blocked/{blockedUid}`

Candidate private one-way block relation:

- The blocker can create/delete only their own block records.
- Only the blocker can read their own block list.
- The blocked person cannot read the blocker's list or discover unrelated block relationships.
- Trusted send authorization / Firestore Rules must reject a new message from sender A to recipient B when the authoritative relation `userBlocks/B/blocked/A` exists.
- Unblocking removes the authoritative relation and restores the intended message flow.
- Do not make blocking mutual by assumption: the currently approved behavior is one-way, and the blocked user cannot send new messages to the blocker.
- Both parties retain access to their existing chat history as already approved.

This relation and its exact path must be tested against Firestore Rules `get/exists` behavior and the actual chat message write path before adoption. If safe enforcement cannot be expressed in Rules, use a trusted send-message endpoint; do not rely on UI-only checks.

### E. `chats/{chatId}/presence/{uid}`

Candidate chat-scoped Online Status / Last Seen:

- A participant writes only their own presence document.
- Only participants of that chat can read presence documents in that chat.
- Presence is not copied into `publicProfiles/{uid}`.
- `lastSeen` uses server timestamp; clients cannot submit arbitrary historical/future timestamps.
- The UI should show a simple status and graceful fallback if presence is unavailable.

User benefit: people in the relevant conversation can see useful availability without broadcasting activity to all marketplace users.

The current app writes one global `users/{uid}.isOnline/lastSeen` field and reads it from chat headers. Migration must update both sides of every active chat and handle users with many chats. Confirm whether the product should show status only while a chat is open or across all existing chats before final implementation; the approved privacy boundary remains chat participants only.

## 4. Compatibility and migration phases

Do not lock down or delete legacy `users/{uid}` fields at the start.

1. **Complete inventory:** search every HTML/JS file, admin page, Cloud Function, account deletion path, and query for `users`, `savedAds`, `blockedUsers`, `isOnline`, `lastSeen`, `displayName`, and `photoURL`.
2. **Freeze schema proposal:** approve exact public fields, private fields, block relation behavior, presence lifecycle, Saved Ads format, and retention.
3. **Implement in review branch:** add shared data-access helpers and tests; avoid scattering direct collection paths through UI code.
4. **Staging-only dual-write:** write new public/private paths while preserving old behavior only where required. Do not read or mutate staging data until explicit owner approval and a verified read-only/write-scoped staging identity are available.
5. **Backfill staging:** create a dry-run report first; copy only approved fields; never copy private fields into public profiles. Record counts and failures without printing PII.
6. **Switch reads:** move profile, Saved Ads, block checks, and presence reads to the new paths. Keep a safe fallback only for a defined compatibility window.
7. **Regression tests:** verify guest browsing, login/signup, profile edit, Saved Ads add/remove/realtime sync, chat inbox/header, presence, block/unblock, old chat history, product/store flows, and account cleanup.
8. **Rules hardening:** apply least-privilege Rules only after all application paths pass Emulator tests. Remove legacy access only when telemetry/test evidence shows no supported client depends on it.
9. **Retire legacy fields:** after owner approval and a rollback window, stop dual writes and clean legacy fields using an audited, reversible process.
10. **Production release:** separate explicit owner approval required. No production Rules publication or deployment is authorized by this plan.

## 5. User-experience safeguards

- Do not require login just to view public listings or public profiles.
- Never silently erase Saved Ads during migration; show a recoverable migration state if a user's list cannot be loaded.
- Preserve current display name/photo using Firebase Auth as a temporary fallback while profile migration is incomplete.
- If presence is unavailable, show “status unavailable” or omit the indicator; do not block chat.
- Blocking must explain the one-way behavior clearly and offer Unblock.
- Existing chat history must remain visible to both participants after a block.
- A Rules denial should not leave the user with an endless spinner; show a clear retry/help message and log a non-sensitive diagnostic.
- Avoid extra reads on every screen. Use scoped listeners, bounded queries, and unsubscribe when the relevant view closes.
- Keep mobile and slow-network behavior in the regression checklist.

## 6. Security and privacy safeguards

- Never trust client-supplied email, IP, role, admin flags, timestamps, or ownership identity.
- Do not expose `privateUsers` or block-list documents to other users.
- Public profile fields must be allowlisted; Firestore Rules cannot hide selected fields in a shared document.
- Presence must be scoped to chat participants and must not be public profile data.
- Use server timestamps for trusted ordering and time-bound decisions.
- Keep Admin access behind verified server-side authorization; do not broaden client reads to make Admin UI convenient.
- Data retention and legal holds require documented purpose, minimization, retention periods, and auditability; do not promise indefinite retention.

## 7. Acceptance tests

### Public profile
- Guest can read approved public profile fields.
- User A can update only User A's allowed public fields.
- User A cannot read or change User B's private data.
- A user cannot add email, IP, admin, verification, moderation, or presence fields to the public profile.

### Private account and Saved Ads
- User A can read/write only User A's private data and Saved Ads.
- User B cannot query or read User A's Saved Ads.
- Saved Ads add/remove/realtime refresh continue working.
- A migration failure does not silently clear a user's list.

### Block and chat
- Only blocker can read their block list.
- Blocked user cannot send a new message to blocker through direct database writes or UI.
- Blocker and blocked user can both read their existing chat history.
- Unblock restores the intended one-way message flow.
- A user cannot create a block record on behalf of another user.

### Presence
- A participant can write only their own presence document.
- A non-participant cannot read presence for a chat.
- A marketplace visitor cannot read global presence from a public profile.
- Presence failure does not prevent opening or using chat.

### Regression
- Signup/login, profile edit, store page, product browsing, Saved Ads, inbox, typing, read receipts, hide-for-me, delete-for-everyone, block/unblock, and mobile layout pass in Staging.
- No Production project, Rules, data, or deployment is touched during this phase.

## 8. Open items before implementation

- Confirm exact approved public profile fields beyond display name and photo.
- Confirm presence refresh lifecycle (while app is active vs only while chat is open) while preserving participant-only visibility.
- Confirm whether Saved Ads must preserve any legacy metadata beyond product IDs.
- Confirm whether any existing Admin or support workflow genuinely needs email/IP and document its purpose.
- Confirm account deletion and retention policy before migrating cleanup logic.
- Reconcile all source paths and actual deployed Firestore schema before writing final Rules.

**Conclusion:** The target is a privacy-preserving split that keeps OLDX convenient for ordinary users. This plan is not a Ruleset and must not be published as one.
