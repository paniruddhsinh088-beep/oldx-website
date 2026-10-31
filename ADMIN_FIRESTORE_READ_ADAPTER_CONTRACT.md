# Admin Firestore Read Adapter Contract (Review Only)

Status: design contract and test target only. This file does not initialize Firebase Admin SDK, connect to Firestore, create an endpoint, or deploy anything.

## Non-negotiable boundaries

- Bind the adapter to the staging project only after the owner-approved staging preflight is complete.
- Never instantiate a client SDK or expose service credentials in browser code.
- No arbitrary collection paths, document paths, sort fields, projections, or query operators from callers.
- Resolve the actor from verified Firebase ID token and server-owned role registry before adapter execution.
- Return only the field projection approved for the operation.
- Do not fall back to browser Firestore reads if the adapter or API is unavailable.
- Firestore Rules remain unchanged until the separate rules and product-write redesign is approved.

## Fixed operation registry

| Operation | Collection | Allowed filters | Ordering | Maximum page |
|---|---|---|---|---:|
| `products.list` | `products` | `status` only, after schema/index confirmation | `createdAt desc, documentId desc` | 50 |
| `users.list` | `users` | none | `createdAt desc, documentId desc` | 50 |
| `stores.list` | `stores` | `status` only, after schema/index confirmation | `createdAt desc, documentId desc` | 50 |
| `reports.list` | owner-approved reports collection only | `status` | `createdAt desc, documentId desc` | 50 |
| `audit.list` | append-only audit collection | `targetType` | `createdAt desc, documentId desc` | 50 |

Do not implement an operation until its collection name, schema, indexes, and authorization policy are verified against the staging data model. The table is an allowlist proposal, not proof that every collection exists.

## Cursor position contract

The signed token is bound to actor UID, operation, normalized query, normalized filters, fixed ordering, and page size. The adapter must additionally validate the decoded position against the operation's cursor schema before passing it to Firestore:

- A cursor is an opaque, server-created tuple containing the exact ordered field values and document ID needed by the query.
- Reject missing, extra, wrong-type, oversized, or operation-incompatible cursor fields.
- Never accept a raw Firestore path, collection name, field name, query operator, or serialized SDK object from a caller.
- Use the same fixed order clauses for the page query and cursor tuple.
- Use a deterministic tie-breaker (document ID) so equal timestamps do not skip or repeat records.
- Fetch at most pageSize + 1 documents to determine whether another page exists.
- Build the next cursor from the final returned document, not the extra look-ahead document.
- Never return raw cursor position or internal document snapshots to the client.
- Expire signed cursors quickly and reject replay under another actor, operation, query, filter, order, or page size.

The existing token helper provides integrity and scope binding; it does not yet implement Firestore query execution or validate Firestore snapshot semantics.

## Field projections

- Products table: document ID, title, category, finalPriceStr, location, sellerUid.
- Users table: UID, validated displayName, approved status only.
- Stores table: only fields needed for the approved store-management view; confirm the exact projection from staging schema before implementation.
- Reports and audit: only fields necessary for the corresponding triage/audit table.
- Exclude email, phone, IP addresses, lastSeen, savedAds, blockedUsers, images/data URLs, extraDetails, tokens, credentials, and unrelated profile data from default list responses.
- Forensic user details require a case ID, purpose/reason, separate permission, and an audit event. Never build them from a cached full-collection download.

## Adapter interface (future implementation)

The future adapter should accept only normalized, already-authorized operation input and an injected Firestore Admin instance. The operation registry owns collection references, filters, order clauses, projections, and cursor parsing. Unit tests must use a fake query builder; Emulator integration tests must verify actual ordering, pagination, projection, and access boundaries before staging rollout.

Suggested result shape:
- `items`: projected plain JSON objects only.
- `nextPosition`: internal cursor tuple for the handler to sign; never returned directly.
- No snapshots, references, query objects, or unfiltered document data.

## Required tests before any staging connection

1. Unknown operation and collection path are rejected.
2. Caller cannot add fields to projection or change order/filter operators.
3. Wrong-typed and malformed cursor tuples are rejected before query execution.
4. Same-timestamp documents paginate deterministically without duplicates or gaps.
5. Cursor actor/query/filter/page-size mismatch is rejected.
6. Every response contains only the operation's approved fields.
7. Page size is bounded and look-ahead does not leak the extra document.
8. Adapter failures do not trigger browser Firestore fallback.
9. Admin access is derived from verified token plus owner-controlled active role registry.
10. Emulator tests prove staging-only project binding and least-privilege reads.

## Explicit non-implementation

No Firebase package, Admin SDK initialization, cloud function, Vercel route, service identity, IAM permission, secret, index deployment, Firestore Rules change, billing change, or staging/Production data access is authorized by this contract.
