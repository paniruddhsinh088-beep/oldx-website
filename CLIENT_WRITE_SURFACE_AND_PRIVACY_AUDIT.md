# Client Write Surface and Privacy Audit

Status: static source audit on `security-hardening-review`. No application code, Firebase data, rules, secrets, billing or deployment changed.

## Executive findings

The frontend currently performs direct Firestore writes for several security-sensitive workflows. These writes are not safe merely because the UI supplies a logged-in UID or hides buttons. Until collection-specific rules or a trusted backend independently enforce ownership and field-level permissions, these operations must remain unavailable in Staging (deny-all) and must not be treated as production-ready.

## High-risk write surfaces

| Surface | Source-observed behavior | Required boundary |
|---|---|---|
| Product create | Browser writes seller UID/name, IP, phone, exact coordinates, arbitrary extra details, images, featured/verified flags and sold state | Server derives seller identity; validates allowlisted fields; keeps private contact/location separate; server alone controls featured/verified/moderation flags. |
| Product update/delete | Browser updates product documents and deletes a pending product directly | Verify ownership from canonical stored record; field allowlist; server-side moderation and audit; deletion must reconcile media. |
| Chat creation | Browser creates/merges chat documents with participant arrays and product IDs | Trusted operation validates product ownership, buyer/seller identity and canonical membership; client cannot add participants. |
| Chat send/offer | Browser writes message documents directly, including sender UID/name, status, attachment data and timestamps | Server derives sender/time/sequence; validates membership, block state, text length and attachment reference; no client-controlled status. |
| Read/delete | Browser directly writes shared `status: read`, `hiddenFor`, and `deletedForEveryone` fields | Per-user read and hide state; trusted tombstone operation; never rely on client-side sender checks. |
| Typing/presence | Browser writes `typing_{uid}`, `isOnline`, and `lastSeen` into user/chat documents | Separate minimal presence state, participant-only access, short TTL, opt-out/privacy control and abuse/rate protection. |
| Saved ads | Browser writes a user-controlled `savedAds` array into the user document | Enforce owner-only access and bounded array size; avoid arbitrary profile document merges. |
| Store profile | Browser writes store owner UID, contact numbers, address, categories, photo URL and exact coordinates | Server binds owner UID; validate field lengths/categories; private phone and exact location defaults; validate media URL/provider ownership. |
| Traffic stats | Browser increments shared `stats/traffic` document | Never let anonymous clients write global counters directly; use rate-limited aggregation or privacy-preserving analytics. |
| Account deletion | Browser deletes seller products and user document, then deletes Auth identity | Replace with durable, resumable, server-owned workflow from the account-deletion contract. |

## Privacy-specific observations

### IP collection

On every authenticated session, the browser requests `https://api.ipify.org?format=json` and attempts to store the returned IP in `users/{uid}.lastIp`. This is third-party disclosure of the visitor's IP to the lookup provider and persistent storage of an identifier. Before retaining it, the product owner should approve a clear purpose, user notice, retention period, access policy and deletion behavior. Prefer not collecting it unless there is a documented security need. Do not use it as a reliable identity or authorization signal.

### Online status and last seen

The current frontend writes `isOnline` and `lastSeen` into the general user document and reads another user's profile document to display status. This mixes public profile fields with presence metadata. A future design should isolate presence from profile data, limit access to relevant conversation participants, avoid exposing exact timestamps by default, and provide a privacy/opt-out decision.

### Exact store location and contact details

Store records include phone/WhatsApp, address and coordinates. These are sensitive business contact/location fields. Public display should be an explicit owner choice with field-level validation; do not expose precise coordinates by default for private residences or home-based sellers.

### User-controlled display fields

Names, descriptions, filenames, offer text and product metadata are untrusted user content. Continue rendering plain text through safe DOM sinks and contextual HTML escaping; never treat stored values as executable markup. Validate URLs by protocol and host allowlist where possible.

## Prioritized remediation order

1. Keep deny-all rules in Staging until collection-level rules and emulator tests cover every operation.
2. Remove browser authority for featured/verified flags, chat membership, sender identity, read receipts, global deletion and shared counters.
3. Split public profile/product fields from private phone, IP, precise location and presence data.
4. Make image and attachment upload a trusted quarantine/validation pipeline; do not accept a client data URL as proof of safe content.
5. Bound all client-writable arrays, strings, map fields and message rates.
6. Add audit events for privileged changes without logging message bodies, tokens, IPs or unnecessary personal data.
7. Provide privacy controls for presence and seller contact/location exposure.
8. Re-run emulator authorization tests and verify fail-closed behavior before any migration or release.

## Release blockers

- Firestore deny-all rules currently prevent the app from functioning against Staging. This is expected and intentional until rules are ready.
- Current browser write flows are not approved for reconnection.
- No rule relaxation, backend deployment, migration, provider setup, billing, IAM, secrets or production change is authorized by this audit.

## Scope and limitations

This is a static review of the current frontend and admin source files, not a penetration test, live database audit, legal assessment or proof that all external integrations have been inventoried. Validate the findings against the final schema and owner-approved data policy before implementation.
