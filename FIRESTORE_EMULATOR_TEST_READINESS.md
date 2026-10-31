# OLDX Firestore Emulator Test Readiness

## Safety and scope

- This is a local test harness plan for `security-hardening-review` only.
- It does not publish, deploy, or change Firestore Rules in either Firebase project.
- Never point the Emulator test suite at `oldx-1c983` or a live Firebase endpoint.
- Use synthetic users and synthetic documents only.
- Do not add service-account credentials, production exports, or real user data to this repository.

## Readiness finding

The review branch currently has no `firestore.rules`, `firebase.json`, `package.json`, or Firebase Emulator test directory. Therefore a trustworthy Rules test cannot yet be executed. The staging setup guide records that the staging database is deny-all. Do not invent a replacement Ruleset or loosen staging access merely to make the Preview app show products.

## Required setup (local development only)

1. Install the Firebase CLI and Node.js on a developer machine.
2. Add a repository-local `firebase.json` configured for the Firestore Emulator only (default host `127.0.0.1`, dedicated test port, emulator UI optional).
3. Add a reviewed `firestore.rules` baseline only after the client read/write inventory and unresolved schema decisions are closed.
4. Add `@firebase/rules-unit-testing` and a test runner as development-only dependencies.
5. Add test fixtures that create two synthetic users (A and B), one synthetic seller, two products, one store, one chat with messages, and private profile data.
6. Run all tests with the Emulator Suite. Tests must fail closed if the emulator is unavailable; they must never silently connect to a live project.
7. Capture test output and review the Rules diff before considering any staging deployment.

## Required test suites

### Guest and public marketplace
- Guest can read public listing documents and only the intended public store profile fields.
- Guest cannot create, update, or delete listings, profiles, stores, chats, messages, or traffic counters.

### Product ownership and privilege protection
- Seller A can create a listing only with `sellerUid == A`.
- Seller A can update only the explicitly approved seller-editable fields.
- Seller A can change `isSold` in both directions (sold and available).
- Seller A cannot change `sellerUid`, `isFeatured`, `isShopVerified`, moderation state, admin notes, or audit fields.
- Seller B cannot update or delete Seller A's listing.
- Invalid types, oversized fields, missing required fields, and unexpected keys are rejected.

### Private user data
- User A can read and update only A's private user document.
- User A cannot read or update B's email, IP data, saved ads, blocked-user list, or private settings.
- Clients cannot create, read-enumerate, or mutate admin authorization records or custom claims.
- Public profile fields are tested separately from private account fields.

### Stores
- Store owner can create and update their own store using the approved field allowlist.
- Another signed-in user cannot modify or delete that store.
- Store owner cannot self-assign verification, featured, or moderation status.
- Guest reads expose only fields approved for public display.

### Chats and messages
- Only listed participants can read a chat or its messages.
- A non-participant cannot read, create, update, or delete messages in that chat.
- A participant cannot spoof another sender UID.
- Participant list and product linkage cannot be rewritten after chat creation.
- Only intended typing/presence fields can be updated by their owner.
- Read receipts, hide-for-me, and delete-for-everyone are tested as separate allowed transitions.
- Arbitrary message overwrites, unauthorized deletes, and blocked-user bypass attempts are denied.

### Analytics and privileged operations
- Client cannot write to `stats/traffic` after a trusted counting endpoint is implemented.
- Admin-only operations are denied to ordinary users even if they alter browser state or call Firestore directly.
- Backend tests verify Firebase ID token, server-side admin authorization, input validation, audit logging, and rate limiting.

### Account deletion and retention
- Deletion workflow requires recent authentication where appropriate.
- Cleanup can resume after a partial failure and handles more than one Firestore batch.
- Legal-hold records are retained according to the approved hold policy.
- Shared chats, messages, stores, and uploaded media follow documented retention rules.

## Acceptance gate

A test suite is not considered complete until:
- every current client read/write in `FIRESTORE_CLIENT_ACCESS_INVENTORY.md` is mapped to a passing or intentionally denied test;
- all product edit fields are explicitly inventoried;
- admin page operations are separately inventoried;
- all tests pass on the Emulator with no live-project credentials;
- the test run confirms it connected to the Emulator host;
- an owner reviews the proposed staging Rules and explicitly approves any publication.

## Current blockers (must resolve before writing final Rules)

1. Decide public visibility for online presence and last-seen.
2. Define the exact seller-editable product field allowlist, preserving seller sold/available toggle.
3. Complete the `admin.html` operation inventory and implement verified server-side admin authorization.
4. Define authoritative block enforcement without exposing another user's private block list.
5. Decide message delete-for-everyone policy and time window.
6. Migrate public profile/presence data away from private `users/{uid}` documents.
7. Move browser writes to traffic counters and other privileged operations to trusted backend code.

No Firestore Rules are supplied by this document. It is deliberately a readiness and test specification, not a deployable Ruleset.
