# OLDX Rules-Verifiable Block Enforcement Design

Status: design and synthetic policy tests only. No Firestore schema, client runtime, rules, backend, Firebase project, or deployment changed.

## Goal

Make blocking an authorization decision, not a browser-only convenience. A blocked sender must be unable to create a new message even if they bypass or modify the UI.

## Preferred model for a two-person chat

Use a dedicated per-blocker relationship document:

`/users/{blockerUid}/blockedUsers/{blockedUid}`

The document ID is the blocked user's UID. The document body is minimal, for example `{ createdAt: serverTimestamp() }`. Do not store a public block list on the other participant's readable profile. Only the authenticated blocker may create or delete documents in their own block subcollection. A user must not read or enumerate another user's block list.

For each message-create request, the Firestore Rules design must:
1. Authenticate the caller.
2. Load the canonical chat document and establish that the caller is one of exactly two participants.
3. Derive the other participant from canonical chat fields, never from a client-supplied recipient UID.
4. Reject the create if `/users/{otherParticipantUid}/blockedUsers/{request.auth.uid}` exists.
5. Validate message sender UID equals the caller, allowed fields/types, and immutable server-owned fields.
6. Reject writes to tombstoned/deleted conversations and any unknown mutation shape.

The chat schema must explicitly define stable participant fields (for example `participantAUid` and `participantBUid`) and enforce that they are distinct, immutable, and correspond to the conversation members. Do not assume the current chat documents already meet this schema; audit real payload shapes before drafting deployable rules.

## Firestore Rules feasibility and constraints

Firestore Rules can use `exists()` on a fully determined document path. This makes a per-blocker subcollection a candidate for rules-verifiable block checks without reading a private block-list array from the client. The exact path expression must be derived from the canonical chat document and tested in the Firestore Rules Emulator.

Budget rule document accesses carefully. Firestore Rules have per-operation document access-call limits; avoid redundant `get()` calls and use stable paths. Confirm limits and caching behavior against current Firebase documentation before implementation.

The relationship document itself must be protected:
- create/delete: authenticated user owns the blocker path;
- create: strict field allowlist and server timestamp validation;
- update: denied (replace via delete/create only if product semantics require it);
- read/list: denied to other users; owner-only access only if the UI genuinely needs it;
- no client can write another user's block relationship.

A rules-verifiable path is not by itself proof of a secure implementation. Chat membership, participant immutability, message shape, and block path must all be tested together.

## Existing data compatibility

Current client code uses `/users/{uid}.blockedUsers` as an array and reads the recipient's array from the browser before sending. That array is not a secure enforcement mechanism. Do not silently dual-write or migrate it. During a future approved migration:
- read existing arrays only in a trusted, authorized migration process;
- create one relationship document per blocked UID;
- validate UID format and skip malformed/self entries;
- produce aggregate counts/errors without logging personal data;
- compare source and destination counts before any legacy-field cleanup;
- retain the old UI only as a non-authoritative view until migration and Rules are verified.

No backfill, dual-write, legacy cleanup, or Firebase access is authorized by this design.

## Required emulator tests before activation

- Blocker A can create/delete only `users/A/blockedUsers/B`.
- A cannot create/delete `users/B/blockedUsers/A`.
- B cannot read/list A's block records.
- If A blocks B, B cannot create a message in their chat.
- If B blocks A, A cannot create a message in their chat.
- An unrelated third user cannot create a message or alter either block record.
- A caller cannot spoof the recipient UID or participant fields.
- A malformed chat without exactly two canonical participants fails closed.
- Unblocked participants can send only when all other message rules pass.
- Removing a block permits future sends but does not restore deleted messages or mutate history.
- Existing message history remains governed by chat membership and retention policy; blocking alone does not erase history.

## Alternative: trusted backend-mediated send

If the existing chat data cannot safely support canonical two-party fields or Rules access limits become problematic, route message creation through a trusted backend. The backend must verify Firebase ID tokens, load canonical membership and block state, apply quotas/validation, and write with a narrowly scoped trusted identity. This alternative needs separate provider, cost, IAM, secrets, and owner approval. Never place service-account private keys in the browser or a Worker as a shortcut.

## Release gate

Do not claim blocking is securely enforced until collection-specific Rules or an approved trusted backend are implemented, emulator tests prove both directions, migration is reconciled, and the client no longer relies on reading another user's private block list. Staging Firestore remains deny-all; Production and live data remain untouched.


## Verified current-client source audit (branch snapshot)

The current `index.html` source was inspected after the initial design was written:

- Chat documents are created/merged with `participants: [buyerId, sellerId]` and `productId`. The primary chat ID is `${productId}_${buyerId}`; the ID alone is not an authorization proof.
- Inbox navigation derives the other participant from the stored `participants` array, excluding the current UID and a legacy `guest` marker.
- Message creation writes `text`, `attachment`, `senderUid`, `senderName`, `status`, `time`, and `createdAt`. Offer creation uses the same chat/message collections and a similar but not identical message payload.
- The browser currently writes chat parent fields `typing_<uid>` and `lastUpdated` using merge writes. These are mutable operational fields and must not allow changing `participants` or `productId`.
- The current block UI reads/writes the caller's `users/{uid}.blockedUsers` array. The send path separately reads the recipient's `users/{recipientUid}.blockedUsers` array from the browser. Neither is a secure server-side enforcement boundary.
- `delete for me` currently writes the caller UID into a shared message's `hiddenFor` array. `delete for everyone` client-side checks `senderUid`, then updates `deletedForEveryone`, `text`, and `attachment`.
- Read receipts are currently written by updating each incoming message's shared `status` field to `read`.

### Consequences for the proposed Rules design

1. A `participants` array is present, so a Rules proof can potentially require exactly two distinct string UIDs, require the caller to be one of them, and derive the other UID from that array. The parent chat's participant array and `productId` must be immutable after trusted/validated creation; ordinary client merge writes must not be allowed to rewrite them.
2. The chat-create rule must prove that the caller is the buyer and the other participant is the actual seller for the referenced product using the canonical product record. A client-provided `participants` array is not proof. The precise product collection/schema and legacy chat creation patterns must be fully audited before writing deployable rules.
3. The message-create rule must compare `senderUid` with `request.auth.uid`, check parent membership, and check whether the other participant has a block record for the sender. Do not trust the browser's recipient lookup or its pre-send check.
4. Parent updates must be split into strict field-specific permissions: at most the caller's own typing marker and a controlled timestamp update, while forbidding participant/product ID mutation. Consider moving typing state to a per-user subdocument to avoid dynamic top-level field authorization.
5. Shared `hiddenFor` and `status: read` are privacy leaks/consistency hazards. A later migration should move hide state and read cursors to participant-private documents. Until then, do not claim per-user deletion or read receipt privacy is guaranteed.
6. Delete-for-everyone needs a transition-only rule: only the original sender may set the tombstone once, and only approved tombstone fields may change. A client must not clear or reverse a tombstone or arbitrarily edit content/attachment.
7. Offer messages must pass the same block and membership checks as ordinary messages. A separate UI path must not become a policy bypass.

## Current rules-test boundary

The repository's Firebase emulator configuration intentionally loads only `tests/firestore-emulator/deny-all.rules`. The current runtime rules test proves that unauthenticated users, authenticated users, and admin-like claims are denied. It does not test a proposed application chat policy. The new block-policy tests are pure synthetic JavaScript tests, not Firestore Rules Emulator enforcement tests.

Therefore this source audit does not authorize replacing deny-all rules, nor does it establish that blocking is active or secure in the running app.


## Additional product-to-chat creation constraint

The source audit also confirms the buyer opens a chat from a product and writes `productId` plus `participants: [buyerId, sellerId]`. A Rules candidate must not trust the submitted seller UID or participant array by itself. It must read the referenced canonical `products/{productId}` document, obtain its stored `sellerUid`, require the authenticated caller to be the buyer, require the other participant to equal that stored seller UID, and reject missing products, missing seller UIDs, and self-chat. This remains a design requirement: the pure JavaScript helper validates input shape and caller binding only; it cannot prove a seller UID is canonical. The actual proof belongs in Firestore Rules Emulator tests using synthetic product documents.

The current legacy product collection is not safe to make publicly readable (it contains private fields such as `phone` and `userIp`). This means a chat-creation rule that performs a product lookup must be designed without granting public reads to legacy product documents. A trusted creation flow or a sanitized public product representation may be needed. Do not relax product read access as a shortcut.
