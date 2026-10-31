# OLDX Firestore Authorization Test Matrix

**Branch:** `security-hardening-review`
**Status:** Acceptance matrix only. Not an application Ruleset and not proof of runtime authorization.
**Date:** 2026-10-31

## Critical distinction: current Emulator tests

The current `firebase.emulator.json` loads `tests/firestore-emulator/deny-all.rules`. The current `rules-runtime.test.mjs` verifies only that guest, authenticated seller, and admin-like clients are denied by this deliberately deny-all fixture.

That is a useful isolation/safety baseline, but it does **not** test the OLDX application policy. It would also deny legitimate marketplace browsing, seller edits, stores, inbox and chat. Never publish this fixture to Staging or Production.

Do not describe the existing Emulator authorization tests as proof that the approved OLDX chat, product, store or user permissions work.

## A. Identity and private user data

| ID | Scenario | Expected result |
|---|---|---|
| U-01 | Guest reads private user data | Deny |
| U-02 | User A reads User B's private profile/settings | Deny |
| U-03 | User A reads/updates own private settings | Allow only approved fields |
| U-04 | User A writes User B's public profile | Deny |
| U-05 | Client writes admin role/claim or admin registry | Deny |
| U-06 | Public profile read returns no email, IP, savedAds or block list | Allow only approved public fields |
| U-07 | Non-chat participant reads another user's online/last-seen values | Deny |
| U-08 | A participant reads online/last-seen for the other participant in their shared chat | Allow through the approved participant-scoped read path |

## B. Products and stores

| ID | Scenario | Expected result |
|---|---|---|
| P-01 | Guest browses public product listings | Allow only if fields are approved for public display |
| P-02 | Authenticated seller creates own product with valid schema | Allow |
| P-03 | Seller creates product with another sellerUid | Deny |
| P-04 | Seller edits another seller's product | Deny |
| P-05 | Seller changes own ordinary allowlisted listing fields | Allow |
| P-06 | Seller changes own isSold from false to true or true to false | Allow |
| P-07 | Seller changes sellerUid, isFeatured, isShopVerified, moderation or audit fields | Deny |
| P-08 | Unrelated user changes isSold | Deny |
| S-01 | Store owner creates/updates own store with valid allowlist | Allow |
| S-02 | User changes another user's store | Deny |
| S-03 | Store owner self-assigns verification/featured/admin fields | Deny |
| S-04 | Public store read includes contact details without explicit consent | Deny |

## C. Chats, messages and presence

| ID | Scenario | Expected result |
|---|---|---|
| C-01 | Guest reads or writes chat/message | Deny |
| C-02 | Non-participant reads chat or messages by guessing chat ID | Deny |
| C-03 | Participant reads existing shared chat and message history | Allow |
| C-04 | A blocked participant continues reading the existing chat history | Allow |
| C-05 | A blocked participant sends a new message to the blocker | Deny |
| C-06 | User sends a message with another senderUid | Deny |
| C-07 | Non-participant creates message in an existing room | Deny |
| C-08 | Client changes participants or productId after room creation | Deny |
| C-09 | Participant updates only their own typing boolean | Allow |
| C-10 | Participant writes another user's typing field or arbitrary room keys | Deny |
| C-11 | Recipient marks the other participant's message as read | Allow |
| C-12 | Sender forges recipient read state | Deny |
| C-13 | Participant adds only their own UID to hiddenFor (Delete for Me) | Allow |
| C-14 | Participant hides a message for the other user or edits message body through hide action | Deny |
| C-15 | Original sender deletes for everyone before 15 minutes | Allow; only deletion flag/content clearing may change |
| C-16 | Original sender deletes for everyone after 15 minutes | Deny |
| C-17 | Recipient or unrelated user deletes for everyone | Deny |
| C-18 | Delete-for-everyone attempts to change senderUid, createdAt or room identity | Deny |
| C-19 | Non-participant reads online/last-seen | Deny |
| C-20 | Relevant chat participant reads online/last-seen | Allow |
| C-21 | Existing history remains visible after either participant blocks the other | Allow, subject to normal participant access and per-user hide |
| C-22 | Unblock restores new-message permission according to the approved one-way block policy | Allow after authoritative block state is removed |

**Time-window implementation note:** The 15-minute limit must use a trusted, immutable server timestamp (`createdAt`) and server-evaluated request time. Client display field `time` or client clock is not authoritative. If direct Firestore Rules cannot safely enforce the exact transition, route delete-for-everyone through a trusted server endpoint.

**Blocking implementation note:** Do not authorize a send by reading another user's private `users/{uid}.blockedUsers` document from the browser. Use a rules-verifiable private block relation or a trusted send-message endpoint. Keep block lists private. Preserve participant read access to the existing chat after block.

## D. Admin and audit

| ID | Scenario | Expected result |
|---|---|---|
| A-01 | Guest/non-admin reads Admin users or products endpoint | Deny |
| A-02 | Request body spoofs owner UID/email/role/isAdmin | Deny |
| A-03 | Verified owner-approved Admin reads bounded page of allowlisted fields | Allow |
| A-04 | Admin attempts unbounded full collection read | Deny / not exposed by API |
| A-05 | Admin changes own role or role registry | Deny |
| A-06 | Sensitive read or moderation action lacks audit event | Fail safely |
| A-07 | Client edits/deletes audit event | Deny |
| A-08 | Permanent delete attempted before retention/legal-hold/recovery gates | Deny |

## E. Regression / user experience

After authorization tests pass, manually verify with two synthetic users:
- Inbox loads only the signed-in user's chats.
- Unread count and unread ordering remain correct.
- Typing indicator updates only for the active participant.
- Read status changes only when recipient reads.
- Delete for Me affects only the requesting user's view.
- Delete for Everyone works only for original sender and within 15 minutes.
- Blocked user can still open and read old chat, but cannot send new messages to blocker.
- Unblock restores the intended message flow.
- Product browsing, My Ads, seller edit and both Sold/Available toggles continue to work.
- Public store pages expose only owner-approved public fields.

## Release gates

1. Confirm deployed Ruleset and exact Firebase environment from Firebase Console; do not infer from repository.
2. Resolve public/private profile migration and presence read-path design.
3. Implement authoritative block state and message-send authorization.
4. Confirm current message timestamp type and use immutable server timestamp for 15-minute rule.
5. Reconcile every client write with exact field allowlists before writing candidate Rules.
6. Add a separate candidate application Rules file. Keep `deny-all.rules` only as the isolated baseline fixture.
7. Run the full Emulator matrix against candidate OLDX Rules and synthetic data.
8. Run user-journey regression tests.
9. Review CI results and diff.
10. Obtain explicit owner approval before publishing to Staging. Production requires a separate explicit approval.

## Current blockers

- No candidate OLDX application `firestore.rules` exists in this review branch.
- Existing runtime Rules tests exercise deny-all only.
- Presence fields currently live in the mixed `users/{uid}` document; public/private split is not implemented.
- Block enforcement currently depends on private user data; authoritative block/send path is not implemented.
- Message `createdAt` is written as a server timestamp in the observed client contract, but the exact deployed schema/rules still need confirmation.
- No staging Rules publication or backend deployment is authorized by this matrix.

## Safety boundary

This file is a test specification only. It does not change application code, Firebase Rules, data, IAM, backend services or deployments. Production remains untouched.
