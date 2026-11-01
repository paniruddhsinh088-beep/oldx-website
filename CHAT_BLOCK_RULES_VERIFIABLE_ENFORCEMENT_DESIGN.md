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
