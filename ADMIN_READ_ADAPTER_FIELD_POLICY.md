# OLDX Admin Read Adapter — Field and Query Policy

**Branch:** `security-hardening-review`  
**Status:** Implementation boundary derived from static source inventories; not a Firestore adapter, deployed API, or authorization grant.  
**Safety:** No Firebase Rules, project configuration, records, secrets, or deployment changed.

## 1. Hard constraints

- All reads execute only in a trusted server runtime after Firebase ID-token verification and server-side active-role resolution.
- Never accept collection names, document paths, field names, sort keys, or projection fields from the browser.
- All list operations are bounded (default 25, maximum 50), use a deterministic order, and return opaque signed cursors.
- Every response uses a fixed projection. Unknown fields are never copied through from Firestore documents.
- No full collection scans or browser-side full-cache search.
- Sensitive responses are non-cacheable.
- The current framework-neutral handler is not a runtime adapter. No Firestore SDK integration is authorized by this document.

## 2. Products list projection

Static source inventory confirms the Admin table currently needs:
- document ID (server-added, not a document field)
- `title`
- `category`
- `finalPriceStr`
- `location`
- `sellerUid`

Do not include `userIp`, seller phone, images/data URLs, `extraDetails`, or unrelated user profile data in the list response. Moderation flags may be added only as individually named fields after their exact source names and UI requirements are verified. Never allow the client to set privileged flags through a list or mutation payload.

The existing Admin page has a permanent-delete action. Do not implement this as a read-adapter capability; deletion requires a separately validated, audited, recoverable mutation contract and owner-approved retention policy.

## 3. Users list projection

The current Admin page displays email and IP, but the inventories classify these as private/restricted and the owner decisions are unresolved. Therefore the least-privilege default list projection is:
- UID (document ID)
- `displayName` only where present and validated
- an explicitly approved account status field only after its schema is confirmed

Exclude `email`, `lastIp`, `savedAds`, `blockedUsers`, `lastSeen`, authentication metadata, and any client-reported IP. Do not return the whole `users/{uid}` document.

Forensic details are not part of `users.list`. A future case-read operation must require a case/purpose and separately approved field-level access, with access itself audited.

## 4. Dashboard

The browser currently reads `stats/traffic` and derives other counts from full product/user collections. Do not reproduce those scans in the backend. Dashboard values must come from bounded, trusted aggregates maintained by an approved write path. Until such aggregate sources and their consistency are verified, return unavailable/null rather than inventing counts or scanning collections.

## 5. Query and cursor rules

- Fixed collection mapping: `products.list` -> `products`; `users.list` -> `users`. No caller-selected path.
- Fixed ordering must be confirmed against actual field presence and indexes before implementation. Do not assume `createdAt` exists on user records.
- Search must use an explicitly implemented indexed strategy. Firestore substring search parity with the old browser `includes()` search must not be claimed without a designed index/token model.
- Signed cursor scope must bind actor UID, operation, normalized query, normalized filters, page size, and fixed ordering.
- Cursor position must be a strict adapter-defined structure. Reject unknown keys, wrong types, oversized values, and any attempt to pass a raw document path.
- Use document snapshots or a stable composite key only inside the trusted adapter; never expose raw snapshot objects or internal paths to the browser.

## 6. Blockers before implementation

1. Verify exact Product document field types, nullability, and ordering field presence from source/write contracts and synthetic Emulator fixtures.
2. Verify whether Users records contain a stable creation/order field; do not infer one.
3. Decide whether email is required for any Admin workflow and who may view it.
4. Decide whether IP collection is needed at all; existing values are client-reported and untrusted.
5. Define aggregate write path for dashboard counts.
6. Approve backend runtime, region, billing, service identity, IAM, and secret storage in the staging preflight.
7. Build Emulator tests with synthetic records for field minimization, pagination, malformed cursor positions, and denied roles.

## 7. Non-goals

This policy does not create an endpoint, Firestore adapter, role, index, Rules file, migration, cloud resource, or deployment. Production remains out of scope.
