# OLDX User Data Field-by-Field Migration Matrix

**Branch:** `security-hardening-review`  
**Status:** Design / implementation preparation only.  
**Depends on:** `USER_DATA_READ_WRITE_AUDIT.md`, `PUBLIC_PRIVATE_PROFILE_MIGRATION_PLAN.md`, `FIRESTORE_RULES_HARDENING_PLAN.md`.  
**Safety:** No application code, Firebase data, Rules, backend runtime, secrets, or deployment changed.

## 1. Migration principles

1. Never copy an entire legacy document into a new collection. Transform only explicitly allowlisted fields.
2. Keep ordinary user actions simple: profile edit, Saved Ads, chat, store management, product edit and Sold/Available must continue to work.
3. Separate public display data from private owner data and trusted security/audit data.
4. Public access must be field-level by document design; Firestore Rules cannot hide selected fields inside a readable document.
5. Keep old schema readable during a controlled compatibility window. Do not delete legacy fields until all supported clients have switched and Staging regression passes.
6. Migration must be idempotent, checkpointed, resumable, dry-run first, and aggregate/redacted in logs.
7. No real-user PII scan or migration is authorized by this design document. Use synthetic Staging fixtures until separately approved.

## 2. Field mapping

| Legacy source / field | Proposed destination | Who may read | Who may write | Migration / compatibility notes |
|---|---|---|---|---|
| `users/{uid}.displayName` | `publicProfiles/{uid}.displayName` | Public, for profile/chat display | Owner, validated | Keep fallback to Auth displayName during migration. Never allow owner to change UID or privileged roles. |
| `users/{uid}.photoURL` | `publicProfiles/{uid}.photoURL` | Public, if user profile is public | Owner, validated | Existing values may be data URLs. Do not assume URL-only. Decide storage/host, type, byte and dimension limits before cutover. |
| `users/{uid}.email` | Firebase Auth as source of truth; no Firestore public copy | Owner via Auth; narrowly scoped verified Admin investigation only if justified | Firebase Auth account owner / trusted Auth flow | Remove from public profile. Keep legacy copy during compatibility only if a verified feature requires it; do not migrate to public profile. |
| `users/{uid}.lastIp` | Trusted server-only security event store, only if lawful and necessary | Restricted, purpose-limited audited Admin backend | Trusted server only | Current browser IP lookup and client write are untrusted; do not copy as verified evidence. Define retention/legal basis before collection. |
| `users/{uid}.savedAds` | `privateUsers/{uid}/savedAds/{productId}` or bounded owner-only private structure | Owner only | Owner, allowlisted product ID and metadata | Preserve legacy strings and objects with `docId`; dedupe. Keep local guest list merge. Choose subcollection vs bounded array after synthetic compatibility/performance tests. |
| `users/{uid}.blockedUsers[]` | `userBlocks/{blockerUid}/blocked/{blockedUid}` or equivalent trusted relation | Blocker only | Blocker for own relation; enforcement trusted | Never expose another user's block list. One-way block policy; preserve existing chat history. Directional send authorization must be proven. |
| `users/{uid}.isOnline`, `lastSeen` | `chats/{chatId}/presence/{uid}` (or equivalent chat-scoped presence) | Participants of that chat only | User's own presence state, with strict validation | Do not make global presence public. Define TTL/cleanup and behavior for users with multiple active chats. |
| `users/{uid}.name/fullName/username` legacy variants | Resolve to canonical `publicProfiles/{uid}.displayName` | Public display projection only | Owner after normalization | Inventory real legacy shapes in approved synthetic/aggregate-only Staging audit. Preserve deterministic fallback order until cutover. |
| `users/{uid}.status` | Not mapped until field meaning is confirmed | Depends on confirmed meaning | Depends on confirmed meaning | Do not assume this is a public status or account moderation state. Admin backend adapter currently mentions it; clarify semantics first. |
| `stores/{uid}.shopName`, `ownerName`, `photoURL`, `categories` | `publicStores/{uid}` projection | Public only after owner consent | Store owner, allowlisted | Public Store page depends on these fields. Preserve page and categories; validate text/image/category limits. |
| `stores/{uid}.address`, `mobile`, `whatsapp`, `sameAsMobile`, `coords` | Public Store projection only for individually opted-in fields; otherwise `privateStores/{uid}` | Public only where owner explicitly opts in; otherwise owner only | Store owner | Current public page displays these. Do not silently hide existing contact functionality; add clear visibility controls and migration notice. Coordinates may reveal home/private location. |
| `stores/{uid}.createdAt`, `updatedAt` | Public or private Store metadata as needed; canonical timestamps retained | Public created date only if useful; updated internal | Server timestamp preferred | Existing legacy coverage is not proven; Admin pagination cannot be enabled until valid immutable createdAt coverage/indexes are audited. |
| `chats/{chatId}.participants`, `productId` | Retain in chat room with immutable identity | Participants only | Trusted room creation only | Existing clients merge-write these values. Compatibility must move room creation to trusted/validated path before making immutable. |
| `chats/{chatId}.typing_{uid}` | Chat-scoped typing subdocument/field | Participants only | Participant may update only own typing state | Dynamic key validation required. Consider separate subcollection to avoid broad room writes. |
| `chats/{chatId}.lastUpdated` | Retain as server timestamp | Participants; perhaps query metadata | Trusted message/offer operation | Never trust client timestamp for ordering. |
| `chats/{chatId}/messages/{messageId}.senderUid` | Retain immutable | Participants only | Trusted message creation; equals Auth UID | Never allow sender spoofing or later sender change. |
| Message `text`, `attachment`, `createdAt` | Retain with strict schema; migrate large media to approved storage later | Participants, subject to hide/delete policy | Sender at creation; createdAt server-generated | Validate lengths, MIME/type, size and attachment references. Do not silently break existing base64 attachments during migration. |
| Message `status` | Retain read/delivery state with constrained transitions | Participants | Recipient-only transition where appropriate | Current read receipts update many docs; bounded batch/trusted endpoint may be required. |
| Message `hiddenFor[]` | Retain per-user hide state or normalize to per-user message visibility | Participants as needed; each user controls own hide | Caller may add only own UID | Delete for Me must not hide for the other participant or erase original message. |
| Message `deletedForEveryone`, cleared `text/attachment` | Retain deletion marker | Participants | Original sender only, within 15 minutes | Enforce with trusted server time / Rules-verifiable immutable createdAt; UI check is not sufficient. |
| Product `sellerUid`, `sellerName` | Retain product owner reference and public seller display projection | Public fields only | sellerUid immutable; sellerName may be derived/validated | Seller UID must match Auth identity at creation; avoid private user-doc read to display seller. |
| Product `isSold` | Retain on Product | Public | Product owner may toggle only this field | Preserve one-tap Sold/Available action; no Admin approval required. |
| Product `isFeatured`, `isShopVerified` | Trusted moderation/verification state | Public read of result only | Trusted Admin/backend only | Remove from client-controlled write allowlist. |
| Product `userIp` | Do not trust or use as verified security data; trusted security store only if justified | Restricted audited access only | Trusted server only | Current client-supplied value is untrusted. |
| `stats/traffic.totalViews` | Trusted aggregate counter / analytics service | Public aggregate if required | Trusted rate-limited service only | Browser currently writes increment; move before denying public client writes. Avoid allowing arbitrary counter set/increment. |
| Admin user email/IP/audit | Separate narrowly scoped Admin investigative operation | Verified Admin, purpose-limited and audited | Trusted backend only | Exclude from ordinary list. Never permit Admin UI to grant roles or alter immutable audit history. |

## 3. Migration stages and gates

### Stage A — Schema decisions (before any code)
- [ ] Decide profile visibility and exact public allowlist.
- [ ] Decide photo URL/data-URL migration and image limits.
- [ ] Decide Saved Ads subcollection vs bounded array using synthetic fixtures.
- [ ] Confirm Store public fields and opt-in controls, including coordinates.
- [ ] Define presence lifecycle and expiry.
- [ ] Resolve one-way block sender direction (blocker-to-blocked remains an explicit open question).
- [ ] Define product/store deletion and chat-history retention/legal-hold policy.
- [ ] Clarify legacy `status` field meaning.
- [ ] Confirm whether any approved use needs Firestore email copy.

### Stage B — Synthetic Staging preparation
- [ ] Create only synthetic accounts and fixtures in `oldx-staging` after separate approval.
- [ ] Include legacy shapes: string Saved Ads, object Saved Ads, missing/old profile fields, data URL photo, store contact variants, old chat messages, missing timestamps.
- [ ] Build pure transformation tests and dry-run report tests.
- [ ] Prove migration idempotency: second run changes nothing.
- [ ] Prove malformed values are rejected or quarantined without data loss.
- [ ] No PII values or raw identifiers in test artifacts/logs.

### Stage C — Compatibility implementation (future, not authorized yet)
- [ ] Add allowlisted helpers and schema validators.
- [ ] Keep current app behavior through explicit fallback during migration.
- [ ] Dual-write only after security rules and failure/retry behavior are tested.
- [ ] Backfill in bounded, resumable batches.
- [ ] Switch reads only after completeness evidence and rollback path.
- [ ] Retire legacy fields only after all supported clients are confirmed migrated.

### Stage D — Rules and user experience
- [ ] Positive and negative Emulator tests for every field boundary.
- [ ] Guest, ordinary buyer, seller, chat participant, nonparticipant and verified Admin test personas.
- [ ] Mobile, slow network, offline/retry and account-switch regression.
- [ ] Confirm users can still edit their profile, save ads, chat, manage stores, edit products and toggle Sold/Available.
- [ ] Confirm no private profile, presence, block-list, email or IP exposure to public/non-authorized users.

### Stage E — Production gate
- [ ] Written review of Staging evidence and rollback plan.
- [ ] Explicit owner approval for each Production schema/rules/data/deployment action.
- [ ] No automatic merge/deploy/cutover.

## 4. Release-blocking issues identified

1. Public profile split is required before any broad user-document read can be granted.
2. Block enforcement cannot rely on client reading another user's private `blockedUsers`.
3. Chat room identity/participants must be immutable and message operations constrained before strict Rules.
4. Delete-for-everyone 15-minute rule is not enforced by the visible UI code.
5. Current global presence violates the owner-approved chat-only visibility policy.
6. Admin current UI expects PII fields not present in the new least-privilege Users list contract; redesign required.
7. Users collection lacks verified universal `createdAt`, and Product/Store legacy timestamp coverage is unknown; do not enable paginated Admin list operations yet.
8. Account deletion is not yet a resumable, complete cleanup workflow.
9. Public Store currently exposes direct contact/location fields without a field-level opt-in boundary.
10. Product client creation includes privileged flags and client-supplied IP; these must be removed from trusted write contract.

## 5. Non-goals for this phase

- No production data export, scanning, migration or cleanup.
- No Firestore Rules publication.
- No Admin backend deployment or cloud resource creation.
- No real user email/IP exposure or processing.
- No public Store contact visibility change.
- No UI change or removal of existing features.
