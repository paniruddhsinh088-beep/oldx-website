# OLDX Firestore Security — Remaining Owner Decisions and Recommended Defaults

**Branch:** `security-hardening-review`  
**Status:** Decision brief only; no application/schema/Rules changes.  
**Safety:** No Firebase project, live user data, Staging data, Production, or deployment accessed or changed.

## Purpose

Static audits are complete enough to identify the main compatibility and privacy decisions that must be settled before writing application-specific Firestore Rules. This document recommends user-friendly defaults while preserving existing Buyer, Seller, Store and Chat journeys.

## Recommended defaults

| Topic | Recommended default | User benefit / safety reason | Status |
|---|---|---|---|
| Public profile | Allow only display name and profile photo for marketplace/chat identity; never expose email, IP, Saved Ads, blocks, global presence or Admin role. | Buyers can recognize sellers without exposing private account data. | Recommendation; owner approval needed before Rules. |
| Profile photo compatibility | During transition, keep existing photo data URLs readable as legacy input; do not blindly copy large data URLs into the new public profile. Introduce a size-limited upload/verified-host path and retain old photo until replacement is verified. | Prevents existing profile photos disappearing during migration. | Recommendation; upload/storage design required. |
| Saved Ads | Keep strictly private to the owner. Normalize both legacy string IDs and object entries using `docId`; deduplicate and preserve ordering where possible. Retain any user-visible metadata only after confirming it is actually used by the UI. | Existing saved products should not vanish or become public. | Privacy recommendation; exact legacy metadata mapping still needs approval. |
| Store public information | Add explicit owner-controlled visibility for address, phone and WhatsApp. Keep shop name, photo and categories public by default only if owner has published the Store page. Coordinates should be public only when the owner intentionally pins/publishes a visitable store location. | Store owners control what buyers can see; buyers still get useful Store information. | Recommendation; needs owner approval and UI design. |
| Presence | No global presence. Store per-chat presence only; show it only to participants in that chat. Mark stale sessions offline after a bounded heartbeat expiry and unsubscribe when leaving the chat. | Avoids exposing activity to strangers and prevents a crashed browser leaving users permanently Online. | Visibility owner-confirmed; expiry interval needs implementation design. |
| Block direction | Preserve the confirmed one-way behavior: the blocked user cannot start new messages to the blocker; existing chat history remains visible to both; unblock restores sending. Do not silently make the block mutual. | Matches the owner's stated policy and avoids erasing history. | Core behavior owner-confirmed; see one clarification below. |
| Email | Firebase Authentication remains the source of verified email. Do not copy email into public profile or ordinary Admin user list. A narrowly scoped Admin investigation endpoint may expose it only if separately justified, authorized and audited. | Less duplicate sensitive data and lower exposure. | Recommendation; no migration until field usage verified. |
| IP address | Do not treat browser-supplied `lastIp/userIp` as verified evidence. Avoid collecting it unless a documented security/legal need is approved; any necessary collection must be server-derived, purpose-limited, access-audited and retained under a schedule. | Prevents false security signals and unnecessary collection. | Recommendation; legal/operational review needed. |
| Legacy `status` field | Do not migrate or authorize it until every read/write and its exact meaning (account state, moderation state, availability, etc.) are identified. | Prevents accidentally granting users control over moderation or disabling normal accounts. | Open source inventory item. |
| Attachments | Preserve current chat behavior during transition with strict size/type limits; design a later controlled Storage upload for larger files. | Avoids breaking chat while improving reliability and document size. | Recommendation; size/type limits need measured UI contract. |
| Account deletion | Reauthenticate first; use resumable, idempotent cleanup with progress and retry. Do not silently erase shared chat history or legally held evidence. Clearly explain what is removed and what must be retained. | Prevents partial deletion and protects both parties' chat history. | Policy and trusted backend design needed. |
| Products / Stores | Keep seller's ordinary listing edits and Sold/Available toggle simple. Seller cannot edit owner UID, verification, featured, moderation or audit fields. Store owner can update their own normal Store fields only. | Security improvements should not add unnecessary Admin approval to ordinary seller tasks. | Product Sold toggle owner-confirmed; complete field allowlists still being inventoried. |
| Admin | Paginated, server-verified, least-privilege lists. Keep all-user visibility for the authorized owner Admin, but keep email/IP out of routine lists; use a separate audited investigation flow if justified. No Admin role management from the browser. | Keeps required owner oversight without downloading every private record to the browser. | Owner direction recorded; backend runtime/deployment details unresolved. |

## One remaining chat-policy clarification

The owner confirmed that blocking is one-way and that the blocked user cannot send new messages to the blocker. Existing history remains visible to both.

Please confirm the opposite direction before implementing enforcement: **after A blocks B, should A (the blocker) still be allowed to send new messages to B, or should sending be stopped in both directions?**

Recommended interpretation of the already stated one-way policy: A can still send to B; B cannot send to A. This is a recommendation only and will not be encoded until explicitly confirmed.

## Implementation gates

1. Finish the source inventory for product edit fields, Store public fields, legacy status, and all Admin read/write paths.
2. Confirm the one remaining block-direction detail.
3. Update pure synthetic helpers and fixtures only after the corresponding mapping policy is approved.
4. Add positive and negative tests against actual candidate Firestore Rules in the Emulator; the current deny-all fixture is not application Rules.
5. Run the complete CI suite and Staging user-journey regression (guest, buyer, seller, Store owner, chat participants and verified Admin).
6. Review a written diff, rollback plan and test evidence.
7. Obtain explicit approval before any Staging Rules publication, real-data migration, backend provisioning or Production action.

## Non-authorization

This brief does not authorize reading real user documents, migrating data, changing Firebase Rules, deploying an Admin backend, enabling public Store fields, or changing Production.


## Additional static source scan (current review-branch snapshot)

A repository client-source scan of `index.html` and `admin.html` found:

- No `users/{uid}.status` read/write usage in these two browser files. The `status` references found are message delivery/read states (`sent` / `read`) and HTML accessibility `role="status"`. Treat a legacy user-level `status` field as unused by the reviewed browser UI unless another service or older supported client is discovered.
- Email is written redundantly into the user document by auth/profile flows, while the profile page already has Firebase Auth's `user.email` and `user.emailVerified`. The Admin UI reads stored `u.email` for its ordinary list and forensic modal. This supports removing email from broad public/private profile migration targets, but Admin UI must be redesigned or supplied through a separately authorized, audited endpoint before the legacy field is retired.
- `lastIp` is populated from a browser-side external IP lookup and written to the user document; this is client-reported, not verified server evidence.
- Product creation writes a client-derived `userIp` field. It must not be treated as trusted forensic evidence or used for authorization.
- This scan is static and limited to the reviewed `index.html` and `admin.html`; it does not prove that no external integration, older app version or backend consumes these fields.

These findings refine the recommendations above but do not authorize changing existing user records or removing fields.


## Product write-path cross-check

The current Product write-contract inventory and source scan establish these concrete requirements for a future Rules/client change:

- Product creation currently sends client-controlled `isFeatured` and `isShopVerified` fields. The client payload must stop assigning privileged flags before Rules can safely reject them; server/Admin moderation owns those fields.
- Product creation also sends `userIp` obtained in the browser. It is not a verified IP signal and should be omitted from new writes unless a separately approved trusted-server design establishes a legitimate purpose.
- The seller edit form currently changes only `title`, `basePrice`, `discountPercent`, `finalPriceStr`, `phone`, `location`, `desc`, and `images`. This is the observed ordinary edit allowlist, subject to checking alternate flows.
- The Sold/Available action changes only boolean `isSold`; preserve this as a direct, simple owner action with no Admin approval.
- Dynamic `extraDetails` by category and compressed data-URL image count/size still need complete schemas/limits before Rules can be authored.
- Seller-side direct product deletion is still coupled to unresolved retention/account-cleanup policy; do not tighten it in a way that strands user listings or silently delete retained evidence.

This is a static source contract, not a code change. No Product payload, Firestore Rules or user data has been modified.
