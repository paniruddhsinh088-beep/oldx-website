# OLDX User Privacy Controls and Data Retention Policy

**Status:** Design proposal only — not an active product policy  
**Scope:** Static source-informed privacy and retention design for OLDX  
**Branch:** `security-hardening-review`  
**Last reviewed:** 2026-11-01

## 1. Purpose and safety boundary

This document defines a privacy-first target design for user controls, data minimisation, retention, and deletion. It is not legal advice, a published privacy notice, or evidence that the controls are implemented.

No production or staging Firebase data was read or changed to prepare this proposal. No runtime settings, Firestore rules, Storage rules, provider accounts, billing, IAM, secrets, or deployments are changed by this document.

All retention periods and limits below are proposals. The owner must approve them after jurisdiction-specific legal review and operational feasibility review. Do not claim compliance with any law solely because this proposal exists.

## 2. Privacy principles

1. Collect only data needed for a clearly stated marketplace purpose.
2. Make personal contact details and precise location private by default.
3. Obtain specific, understandable, revocable consent before exposing optional contact/location details.
4. Do not treat client-side UI checks as security controls; enforce access on a trusted server and in applicable database rules.
5. Separate public listing data from private seller/account data.
6. Keep sensitive operational and moderation data restricted to authorised personnel with audit trails.
7. Provide clear access, correction, export, consent withdrawal, and deletion-request pathways.
8. Fail closed when identity, authorisation, consent, or deletion state cannot be verified.

## 3. Data classification and proposed handling

| Data class | Examples / source surfaces | Proposed access and purpose | Proposed retention / trigger |
|---|---|---|---|
| Public listing data | Approved title, category, description, price, broad area, approved images | Public only after trusted validation and publication | While published; remove or archive after seller deletion/expiry under approved policy |
| Seller identity | Auth UID, display name, account email | UID internal; display name only where needed for a published listing; email private | Account lifetime plus approved closure window |
| Contact details | Phone, WhatsApp number, email | Private by default; reveal only after explicit per-purpose consent; consent must be revocable | Retain privately only while needed for account/listing or a documented dispute |
| Location | Exact coordinates, store address, listing location | Exact coordinates private by default; public listing may show only an approximate locality/area | Exact location removed when no longer needed or consent withdrawn |
| Presence | `isOnline`, `lastSeen` | Opt-in; coarse presence only; allow user to hide status | Keep only the latest necessary state; no long-term presence history by default |
| Chat content | `chats/{chatId}/messages`, attachments, read state | Only conversation participants; support access restricted and audited | Conversation lifecycle plus an owner-approved dispute/safety retention window |
| Saved/favourite ads | `users/{uid}.savedAds`, browser storage | Private to the account/device; never public | Until user removes it, account closure, or local device data is cleared |
| IP/network data | Existing sign-in lookup and `lastIp` write | Disable IP collection by default unless a documented security purpose requires it; do not expose in admin UI by default | If approved, short, fixed retention with access logging and no indefinite history |
| Store data | Store name, phone, WhatsApp, address, coordinates, photo URL | Public fields explicitly selected by store owner; sensitive contact/location separately controlled | While store is active; deletion/closure workflow applies |
| Moderation/report data | User reports, abuse evidence, moderation decisions (future design) | Restricted to authorised reviewers; collect only evidence needed to resolve a report | Case-based retention, then deletion or legally required hold |
| Security/audit events | Admin mutations, account deletion jobs, access decisions | Restricted, append-only where practical; no secrets or full message bodies by default | Fixed, approved security retention; redact identifiers where feasible |
| External media references | Inline data URLs, Cloudinary URLs and future object storage IDs | Do not assume deleting a Firestore document deletes external media | Maintain an ownership/reference inventory and delete only after verified unreferenced state |

## 4. User-facing privacy controls (target behaviour)

### 4.1 Profile and contact visibility
- Provide separate controls for public display name, phone, and WhatsApp visibility.
- Phone and WhatsApp are private by default.
- Consent must state what will be shown, to whom, and for which listing/store.
- Revoking consent prevents future disclosure; cached copies or information already seen by another user cannot be guaranteed to disappear.
- Do not infer consent from filling in a phone field or creating a listing.

### 4.2 Location privacy
- Ask for location only when the user invokes a feature that needs it.
- Explain whether the app uses device location, a manually selected area, or an address.
- Use an approximate locality for public discovery by default.
- Keep exact coordinates private unless the user explicitly chooses to share them for a specific purpose.
- Do not persist precise location merely because the browser permission was granted.

### 4.3 Online and last-seen status
- Offer a clear opt-out.
- If disabled, do not publish online/last-seen state to other users.
- Avoid storing a detailed presence timeline unless a separately approved need exists.

### 4.4 Saved ads and recently viewed items
- Explain whether these are stored on the device or synchronised to the signed-in account.
- Provide a remove/clear action.
- On logout, clear account-scoped local UI state and prevent the next account from seeing the previous account's saved content.
- Do not put private messages, tokens, or sensitive profile data in local storage.

### 4.5 Chat and blocking
- Provide block and report actions with clear consequences.
- A block must be enforced by trusted server/database authorisation, not only by hiding a UI element.
- A report should collect the minimum evidence necessary and show the user what is submitted.
- “Delete for me” and “delete for everyone” must have distinct, server-enforced semantics.
- Read receipts and unread counters must not let one participant mutate another participant's private state.

### 4.6 Notifications
- Push notifications must be opt-in and revocable.
- Offer a privacy-conscious lock-screen preview setting; default to generic notification text where message content could be sensitive.
- Do not request notification permission before explaining the benefit and asking at a relevant moment.

### 4.7 Data access, correction, and deletion
- Provide a request path to access/export account data and correct inaccurate profile data.
- Show deletion-request status (for example: received, processing, blocked pending review, completed).
- Do not claim deletion is complete until all required data and external media references have been reconciled.
- Explain any narrow retention exception before the user confirms deletion.

## 5. IP collection and third-party disclosure

The source audit identified a sign-in flow that obtains an IP address through an external IP lookup service and writes a `lastIp` value to the user record. This is a privacy-sensitive operation.

Target decision:
- Remove IP collection from ordinary sign-in by default.
- If retained for a documented fraud/security purpose, first approve the purpose, notice, access roles, retention period, and deletion behaviour.
- Never display raw IP addresses in a general-purpose admin dashboard.
- Avoid sending IP addresses to third parties unless necessary, disclosed, and approved.
- Review external IP lookup, Cloudinary, Firebase, Vercel, analytics, map tiles, fonts, and CDN dependencies as separate processors/service providers. Confirm current contracts, regions, subprocessors, and data transfer terms before production use.

## 6. Draft retention schedule — owner/legal approval required

The following is a starting proposal, not an active retention promise:

| Data | Draft retention approach |
|---|---|
| Unpublished/abandoned listing drafts | Delete after a short inactivity window selected by the owner |
| Published listing | Retain while active; prompt owner to renew or expire after a defined listing lifecycle |
| IP/security event data | Avoid collecting by default; if approved, use a short fixed window (suggested starting point: 7–30 days) |
| Presence | Keep only current state; clear stale state on a short TTL (suggested starting point: 24–48 hours) |
| Chat content | Retain while needed for the conversation; define a separate, disclosed dispute/safety hold period before implementation |
| Reports/moderation cases | Retain until case closure plus a defined appeal/safety window; restrict access and log access |
| Admin audit events | Retain for a defined security/accountability period; proposed 90–180 days pending legal and operational review |
| Deletion job metadata | Retain minimal non-content completion/failure metadata long enough to support retries and prove processing; no message bodies or secrets |
| Backups and external media | Publish a realistic purge window only after provider capabilities and backup lifecycle are verified |

No suggested number above should be implemented without explicit owner approval. Legal holds, fraud investigations, and statutory requirements must be handled through a documented exception process, not indefinite blanket retention.

## 7. Account deletion and external media reconciliation

Account deletion must be a trusted, resumable workflow, not a browser-side batch followed by immediate Auth deletion.

Required stages:
1. Authenticate the requester and bind the request to the verified UID.
2. Create an idempotent deletion request and return a visible request status.
3. Inventory owned profile, listings, stores, saved items, chats, nested messages, reports, and media references.
4. Distinguish user-owned content from shared conversation records and content another participant is entitled to retain.
5. Apply the approved policy to remove, anonymise, or retain each record category.
6. Delete external media only after ownership and zero-reference checks; never delete a shared object based only on one user's request.
7. Use bounded pages, checkpoints, retries, and idempotency keys; record partial and blocked states.
8. Delete or disable the Auth identity only at the correct final stage after required work can safely continue without that identity.
9. Verify completion and show the user an accurate result. Never report success while any required step is unresolved.

This section complements `ACCOUNT_DELETION_AND_DATA_RETENTION_CONTRACT.md` and `ACCOUNT_DELETION_DRY_RUN_AND_RECONCILIATION_PLAN.md`.

## 8. Admin and support access

- Remove raw IP and unnecessary personal data from general admin views.
- Use least-privilege roles and separate moderation, support, and privileged administration.
- Require a documented purpose for viewing private data.
- Record who accessed or changed sensitive records, when, and why.
- Avoid bulk export by default; require a separate authorised workflow and audit event.
- Do not allow a browser-only admin flag or hidden button to grant authority.
- Admin access must be enforced by a trusted backend and IAM/database policy.

## 9. Implementation dependencies and release gates

Before enabling any control or changing database rules:
- Complete a field-level inventory and confirm it against current source.
- Approve the data purpose, lawful basis where applicable, notice wording, retention, processors, and deletion exceptions.
- Implement trusted server enforcement for visibility, consent, block/report, export, and deletion.
- Define collection-specific Firestore rules and test them in the emulator.
- Add tests for consent revocation, cross-user access denial, account switching/local-storage cleanup, shared-chat deletion, external-media reference safety, and retries.
- Test on low-end Android and weak networks; privacy controls must remain usable without blocking normal browsing.
- Publish a clear privacy notice and support contact only after owner/legal review.

## 10. Explicit non-goals of this document

This proposal does not:
- change `index.html`, `admin.html`, Firebase configuration, Firestore/Storage rules, or live UI behaviour;
- access or alter production/staging users, products, chats, stores, or images;
- enable IP logging, analytics, push notifications, or any new data collection;
- create a backend, provider account, bucket, IAM identity, secret, or paid service;
- perform a migration, deletion, deployment, or Play Store release.

## 11. Owner decisions still required

The owner must approve, at minimum:
- the final public/private field matrix and consent wording;
- exact retention periods and any legal-hold exceptions;
- whether IP/security telemetry is necessary at all;
- report/moderation evidence scope and access roles;
- data export format and support process;
- third-party processor list and data-region requirements;
- final deletion semantics for shared chats, stores, and externally hosted media;
- implementation provider, budget, rollback plan, and release gate.

**Until those decisions and the required backend/security tests are complete, existing deny-all Staging Firestore rules must remain in place and no live client write path should be enabled as a workaround.**
