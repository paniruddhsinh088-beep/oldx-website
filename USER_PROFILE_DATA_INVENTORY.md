# OLDX User Profile and Private-Data Access Inventory

**Branch:** `security-hardening-review`  
**Status:** Static inspection of current `index.html`; no schema migration, Rules, or backend implementation.  
**Safety:** No Firebase project, user record, or deployment changed.

## Observed client-side `users/{uid}` fields and operations

| Field / operation | Observed use | Data classification / required boundary |
|---|---|---|
| `email` | Written from Firebase Auth user during sign-in/profile sync | Private identity data; owner and trusted Admin only |
| `displayName` | Written from Auth; read for chat seller/recipient display | Public display candidate; should move to a dedicated public profile |
| `photoURL` | Written from Auth/profile flow; read for store/profile UI | Public display candidate; validate trusted image URL/origin |
| `lastIp` | Client fetches IP from ipify and writes it to user doc | Sensitive, unverified client-reported value; remove from client writes; collect server-side only if justified |
| `savedAds` | Read, merged and updated by signed-in owner; realtime sync | Private owner-only preference data |
| `isOnline` | Owner writes presence state | Public presence only if product decision/consent permits; separate from private document |
| `lastSeen` | Owner writes server timestamp alongside presence | Privacy-sensitive presence metadata; visibility and precision need explicit decision |
| `blockedUsers` | Owner reads/updates own block list; sender flow reads recipient's list | Private owner-only data; current sender-side read of recipient's block list is not an acceptable privacy model |
| `name`, `fullName`, `username` | Fallback fields read by chat status/display code | Public display candidates; actual write paths and precedence need confirmation |

## Additional observations

- Product creation also fetches the visitor IP from `https://api.ipify.org` in the browser and writes it to `products/{productId}.userIp`. This value is client-reported, not trusted evidence. It should not be used for enforcement or fraud decisions.
- Authentication sync writes `email`, `displayName`, and `photoURL` to `users/{uid}` using merge semantics.
- Saved-ad synchronization reads the owner document and writes `savedAds` to the same mixed document.
- Presence updates write `isOnline` and `lastSeen` to the same mixed document.
- Chat UI reads another user's `users/{uid}` document to display name/presence, which is why private identity and preference fields cannot remain in a broadly readable document.
- Blocking UI reads and updates the current user's own `blockedUsers`, but message send logic also reads the recipient's block list from the recipient's user document. This must be redesigned; do not grant broad user-document reads to make it work.
- Account deletion currently deletes the user's `users/{uid}` document along with product documents in a client batch before calling Firebase Auth `user.delete()`. The separate deletion contract records why this is unsafe when reauthentication or cleanup fails.

## Proposed target separation (design only)

- `publicProfiles/{uid}`: only owner-approved display fields, such as display name, profile photo, and an explicitly approved coarse presence indicator.
- `privateUsers/{uid}`: email (if needed outside Auth), saved ads, blocked-user preferences, private settings, and other owner-only data.
- Trusted backend-only records: server-verified IP/security signals, role registry, audit events, and operational metadata. Do not store these in client-writable profile documents.
- Store contact details remain under a separately reviewed public/private Store model; this inventory does not authorize public exposure.

This is a proposed separation, not an implemented migration. Preserve legacy `users/{uid}` reads/writes until a compatibility plan and trusted migration are tested.

## Required follow-up tests

1. Guest can read only the approved public profile projection.
2. User A can read/update A's private profile and cannot read/update B's private profile.
3. User A cannot modify public profile fields belonging to B.
4. Clients cannot write server-only IP/security evidence, roles, or audit events.
5. Saved ads and blocked-user lists remain private to their owner.
6. Chat display can resolve public display fields without reading another user's private document.
7. Block enforcement works without exposing the recipient's private block list.
8. Presence visibility follows an explicit owner-approved policy.
9. Account deletion cleans both new and legacy documents only through the approved resumable workflow.

## Decisions still required

- Which public profile fields are shown to guests and chat participants?
- Is online status public, participant-only, or hidden? Is last-seen shown at all?
- Is email needed in Firestore, given Firebase Authentication already stores it?
- Are client-reported IP fields to be removed entirely, or replaced by narrowly scoped trusted server collection?
- How should existing `users/{uid}` records be dual-read/backfilled and later retired without breaking old clients?

**No migration, deployable Rules, or backend is created by this inventory.**
