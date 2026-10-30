# OLDX Comprehensive Admin Security, User Records and Fraud Evidence Plan

**Status:** Proposal / implementation blueprint only  
**Branch:** `security-hardening-review`  
**Production impact:** None. This document does not change live Firebase Rules, production data, Cloudinary settings, or deployment.  
**Owner decisions incorporated:** Admin-only access to the full Admin Panel; all users must remain visible/manageable to the authorised admin; preserve seller-owned Sold/Available toggle.

## 1. Objectives and non-negotiable principles

1. Only the owner's explicitly configured, verified administrator identity may access the Admin Panel and privileged data/actions.
2. The authorised admin can search and page through the complete user directory and view the fields genuinely required for administration.
3. Ordinary users and sellers must never be able to read another user's private/admin-only records.
4. Account deletion must not destroy records that must lawfully be preserved for a documented investigation, legal hold, or statutory retention obligation.
5. Police/law-enforcement disclosure must be verified, scoped, approved, logged, and securely delivered. No informal or bulk disclosure.
6. Collect and retain only data with a documented purpose and lawful basis. Do not promise indefinite retention or collect every conceivable personal detail.
7. Preserve current marketplace/chat/store behaviour unless a separately tested migration explicitly changes it.
8. No production deployment or live Rules change without the owner's separate approval.

## 2. Identity, roles and Admin Panel access

### 2.1 Canonical administrator identity

- Keep the owner-confirmed Firebase Auth UID as the stable identity anchor: `ghuDBBk8jdOfM2no7lyQobQN7WI2`.
- Verify the expected email on the trusted server against the authenticated Firebase ID token and the configured UID. Email alone is not an authorisation key; it can change and must not be trusted from browser input or profile documents.
- Provision an `admin: true` custom claim only through a private Admin SDK/operator process. Never expose a client-callable function that lets a user grant themselves a claim.
- During migration, support the confirmed UID/admin record only through a deliberately tested server-side compatibility check. Remove legacy checks after verification.
- Require MFA for the admin account where Firebase Auth/provider configuration supports it; use a strong unique password, secure recovery, and no shared admin login.
- Create a break-glass recovery procedure kept offline and tested. Do not create additional admins without the owner's explicit approval.

### 2.2 Every privileged request is checked server-side

- Admin page navigation/button hiding is only user experience, not security.
- Every admin API and Firestore privileged read/write verifies a valid Firebase ID token, UID/custom claim, and required role.
- Deny by default. Recheck role on every request; do not trust a role cached in localStorage, URL, client state, email field, or Firestore profile editable by the user.
- Restrict CORS/origin as a supplementary control only; it is not authentication.
- Admin sessions should expire appropriately; reauthentication is required for exports, account deletion, role changes, and other high-impact actions.
- Alert/log on repeated failed admin access, unusual exports, and changes to admin configuration.

### 2.3 Admin directory and least-privilege presentation

- The Admin Panel must show all users, as requested by the owner.
- Implement server-side cursor pagination and search (UID, display name, email/phone only where collected and needed). Do not download the whole users collection into the browser.
- Return a documented field set: UID, account status, created/last-seen timestamps, display name, verified contact fields where available, listing counts/status, report/risk flags, and only the additional fields the existing admin workflow needs.
- Show sensitive fields such as email, phone, IP/security events only to the authorised admin, with a clear purpose and access logging. Do not expose them to marketplace users.
- Mask sensitive fields by default in the UI; reveal only when needed, and log sensitive record views/exports.
- Admin actions (suspend, restore, remove listing, mark review status) require reason codes/free-text reason and are written to an append-only audit log.
- Keep all-user visibility while using pagination/search; pagination is not a restriction on which users can be found.

## 3. Data architecture: separate public, private, and evidence records

Do not keep sensitive and public profile fields together in a publicly readable `users/{uid}` document. Firestore Rules cannot hide individual fields from a document read.

### 3.1 Proposed logical data model

| Path / system | Purpose | Access |
|---|---|---|
| `publicProfiles/{uid}` | display name, profile image reference, public presence fields | Public read of approved fields; owner/backend write with validation |
| `privateUsers/{uid}` | email/contact, saved ads, blocked users, private preferences | Owner and trusted backend; Admin API only for authorised admin |
| `userSecurity/{uid}/events/{eventId}` | security events and account lifecycle events | Trusted backend write; restricted security/admin read |
| `userActivity/{uid}/events/{eventId}` | selected material actions: listing create/edit/delete, moderation, reports | Trusted backend write; restricted access |
| `adminAudit/{eventId}` | admin views, changes, exports, approvals | Append-only trusted backend write; security owner read |
| `evidenceCases/{caseId}` | case metadata, legal hold, scope, approvals, evidence manifest | Case-authorised admin/legal roles only |
| `evidenceObjects/{objectId}` or private object storage | encrypted evidence snapshots/files | No public/client access; backend mediated |
| `deletionJobs/{jobId}` | resumable account deletion workflow | Trusted backend only |

These are proposed names, not existing production collections. Final schema must be reconciled against all current code and data before migration.

### 3.2 Data inventory and provenance

For every field/event, document: source, purpose, lawful basis, whether user-provided or system-generated, accuracy/verification status, retention period, access roles, and deletion/hold behaviour.

Candidate records, only where relevant and lawfully collected:
- Stable internal Firebase UID and account lifecycle timestamps.
- Verified email/phone and verification status; do not claim an unverified field is verified.
- Authentication/security events available from Firebase/Auth provider and trusted backend (sign-in, sign-out where available, password/account recovery, suspicious failures).
- IP address with exact UTC timestamp and source, only where lawfully collected and necessary; record proxy/trust limitations. Never infer a real-world identity from IP alone.
- Product/listing creation, edits, status changes, deletion, seller UID, timestamps, and moderation history.
- Reports, complaints, case references, admin moderation decisions.
- Chat/message and attachment records only as required for service, safety, dispute, or legal purposes; apply separate access controls and retention.
- Store changes and Cloudinary asset identifiers/metadata.
- Transaction/order/payment references only if OLDX actually implements those functions; do not invent transaction records.
- Consent/notice version, user request, account deletion request, and processing/retention decision.
- Admin access/action/export history.

Do not store passwords, authentication secrets, raw payment card data, unnecessary device fingerprinting, or unrelated personal details in the evidence store.

## 4. Event logging and evidence integrity

- Generate security/audit events on the trusted server, not solely from client JavaScript.
- Use server timestamps in UTC and preserve original event time, ingestion time, source system, actor UID, target UID/object, action, outcome, request/correlation ID, and reason.
- Treat client-supplied timestamps/IP/user-agent as untrusted metadata; label their source.
- Use append-only permissions: clients cannot update/delete audit/evidence events. Corrections are new linked events, not edits to old evidence.
- Protect logs with encryption at rest/in transit, least-privilege IAM, separate project/bucket or equivalent isolation where feasible, and versioning/retention lock only after legal and operational review.
- Maintain integrity manifests (object hash, size, MIME, capture time, source path, case link) for exported evidence. Hashes support integrity checking; they do not by themselves prove authenticity or identity.
- Back up evidence securely and periodically test restoration. Record backup access and deletion/expiry.
- Synchronise backend clocks to reliable time sources; preserve timezone explicitly for displayed local times.

## 5. Fraud case and legal-hold workflow

### 5.1 Case creation

An authorised reviewer creates a case with:
- Unique case ID.
- Reason/category and concise factual description.
- Reporter/source and linked user/listing/chat IDs.
- Evidence scope and date range.
- Risk/severity and review owner.
- Whether there is a police request, court order, statutory requirement, or internal investigation.
- Legal basis/authority reference and review/expiry date.
- Approval status and who approved.

Do not label a user a criminal based only on an allegation. Use neutral statuses such as `reported`, `under_review`, `restricted`, `closed`.

### 5.2 Preservation

- When a credible report or valid legal preservation request is received, authorised staff can place a scoped legal hold on specific records.
- A hold must specify case, records, reason, legal basis/authority, approver, date applied, review date, and release authority.
- Freeze only the relevant evidence; avoid unnecessarily freezing unrelated personal data or ordinary account functionality.
- Snapshot records into the restricted evidence store with source IDs and hashes. Keep the original record and snapshot relationship clear.
- Prevent deletion/expiry only for the scoped records while the hold is valid.
- Review holds periodically; release promptly when no longer required and record the release decision.

### 5.3 Police / law-enforcement disclosure

- Verify the requesting authority, official channel, case/reference number, legal instrument/request, scope, and deadline. Escalate uncertainty to Indian legal counsel.
- Do not disclose data merely because someone claims to be police or sends an informal message.
- Require two-person approval for sensitive exports: the owner/authorised admin plus a designated reviewer or counsel where practical. If OLDX has only one authorised operator, record that limitation and obtain external legal review for high-risk requests.
- Export only records responsive to the request; minimise unrelated third-party data and redact where legally appropriate.
- Create a manifest: case ID, authority, request reference, legal basis, approved scope, data categories, date range, export hash, approvers, exported-at timestamp, recipient, transfer method, and delivery acknowledgement.
- Use encrypted files and a separately communicated secure password/key or secure portal. Do not send raw evidence via ordinary chat/email attachments unless counsel-approved.
- Preserve an exact copy of what was disclosed and the chain-of-custody log.
- Record refusal/partial disclosure and legal reason if a request is invalid or overbroad.

## 6. Account deletion: two-track lifecycle

### 6.1 User-facing deletion request

1. Authenticate the user and require recent reauthentication for high-impact deletion.
2. Create a deletion job; show the user a clear notice describing what will be deleted, what may be retained by law/security needs, and how to contact OLDX.
3. Check for active legal hold or documented investigation. Do not expose sensitive case details to the user where prohibited; have counsel approve user-facing wording.
4. Remove/deactivate the public profile and stop ordinary use as appropriate.
5. Remove or anonymise non-required personal data and public listings according to the approved policy and product requirements.
6. Preserve only scoped records required by law, valid legal hold, security/fraud purpose with a documented lawful basis, or unresolved statutory obligations.
7. Restrict retained records from routine product use; they are not a shadow active account.
8. Delete/anonymise retained records when their lawful retention period ends and no hold applies.
9. Complete Firebase Auth deletion only after required reauthentication and backend deletion steps are safely orchestrated. Make the workflow resumable and idempotent.

### 6.2 Failure-safe behaviour

- Never delete all Firestore user/product records first and only then attempt Firebase Auth deletion.
- Use a backend state machine such as `requested -> reauthenticated -> reviewed_for_hold -> public_data_removed -> retained_evidence_sealed -> cleanup_running -> completed`.
- Store progress, errors, retries, and per-collection checkpoints. Chunk writes to respect Firestore batch limits.
- Do not delete shared chat history blindly; apply a documented retention, redaction, and participant-rights policy.
- Remove Cloudinary assets only when ownership and retention/hold checks pass; persist `public_id`/asset identifiers for reliable cleanup.
- Notify the user when deletion is complete, subject to lawful exceptions.

## 7. Retention schedule: policy framework, not arbitrary forever storage

Create a lawyer-reviewed schedule by data category before launch. Minimum baseline:
- ICT system logs: assess and comply with CERT-In Directions where OLDX falls within scope; the 2022 Directions state a rolling 180-day secure log-retention requirement for covered entities, with logs maintained in India.
- DPDP Rules, 2025: Rule 6 includes security safeguards and one-year retention of relevant logs/personal data for specified purposes; Rule 8 includes erasure requirements and legal-compliance exceptions. Applicability and commencement are phased; confirm which provisions are in force on the implementation date.
- Specific sectoral obligations, payment/consumer/tax rules, court orders, and preservation notices may require different or longer periods.
- Case evidence: retain only for the period counsel documents as necessary for the investigation/legal proceeding/limitation or other lawful obligation; set review dates and legal-hold expiry checks.
- Routine profile, saved ads, chats, and analytics: separate retention periods and purposes; avoid keeping all fields forever.
- At expiry: automated deletion/anonymisation, backup expiry handling, deletion certificate/log, and exception for active legal hold.

Never treat a platform-wide blanket indefinite retention policy as the default.

## 8. Current OLDX-specific migration risks to resolve

1. Current supplied Firestore Rules allow public read of `users/{uid}`; that exposes all fields in the document, including email/IP/savedAds/blockedUsers if present. Firestore Rules cannot redact fields. Split public and private records before tightening access.
2. Current `stats/{docId}` read/write is public; traffic counter can be tampered with. Move authoritative counting to trusted backend before closing writes.
3. Current chat rules broadly allow authenticated message writes and do not sufficiently enforce participant membership, sender identity, delete-for-everyone ownership, or block enforcement. Design and test operation-specific rules/backend operations.
4. Admin page currently loads all `users` and `products` client-side. Replace with verified-admin backend pagination/search while retaining full all-user coverage.
5. Current account deletion can delete product/user documents before Firebase Auth reports `auth/requires-recent-login`. Reorder with reauthentication and a resumable backend job.
6. Product images and chat attachments are inline data in Firestore; store images use Cloudinary unsigned upload in the reviewed client code. Inventory, size limits, metadata, and cleanup before migration.
7. Frontend admin UID check is not backend security. Add server-side authorisation and Firestore Rules.
8. No Firebase Functions/backend directory was found in the previously inspected repository tree. Reinspect repository/config and choose a supported backend/runtime before implementation; do not assume a Cloud Function environment already exists.

## 9. Implementation phases and gates

### Phase 0 — Discovery and baseline (no production changes)
- Confirm Firebase project IDs/environments, Auth providers, hosting, Firestore indexes/rules, Cloudinary configuration, backups, repository structure, and admin table fields/actions.
- Export current Rules/config safely and make a restorable backup.
- Inventory every collection, field, read/write path, third-party processor, and deletion path.
- Produce field-level data map and legal retention questions for counsel.
- Gate: owner approves architecture, data inventory, and staging environment.

### Phase 1 — Secure admin access foundation
- Implement server-side UID/claim checks, admin API middleware, MFA, audit logging, and paginated directory endpoints.
- Preserve all-user visibility and required admin workflows.
- Gate: tests prove non-admin cannot read/list/export/administer even by direct API/Firestore calls.

### Phase 2 — Private/public data separation
- Create new public/private schema and dual-read/dual-write migration with reconciliation.
- Migrate in batches; verify counts and field equality; maintain rollback path.
- Switch clients to least-privilege reads.
- Only then tighten legacy `users` Rules and remove legacy fields.
- Gate: all existing flows (profile, saved ads, online status, blocking, chat, store, listing) regression-tested.

### Phase 3 — Evidence and legal-hold service
- Implement trusted event capture, restricted evidence store, case/hold workflow, access logs, export manifests, approvals, and expiry automation.
- Add account deletion state machine and Cloudinary/chat cleanup policy.
- Gate: restore test, integrity verification, deletion/hold test, mock police request exercise.

### Phase 4 — Firestore and product/chat rules hardening
- Deny by default; enforce owner/admin and participant membership; validate allowed fields/types/ranges.
- Preserve seller's own `isSold` boolean toggle.
- Protect privileged product fields and admin moderation.
- Gate: Firebase Emulator negative/positive rule matrix passes.

### Phase 5 — Staging, security and regression tests
- Test with anonymous, normal user A, normal user B, owner/admin, deleted/held user, and expired hold.
- Test direct SDK/API calls, forged email, changed localStorage, stale token, revoked claim, pagination, search, export approval, and deletion failures.
- Test all existing user journeys and mobile browsers.
- Perform independent security review/penetration test before production.

### Phase 6 — Controlled production rollout (separate owner approval)
- Back up production and verify rollback.
- Deploy backend first; verify health and logs.
- Migrate a small cohort; compare data and errors.
- Gradually migrate remaining users; monitor.
- Tighten Rules only after clients/backend are confirmed compatible.
- Enable evidence retention and deletion automation only after legal schedule and operational runbook are approved.
- Owner gives explicit approval for each production deployment; no automatic deploy from this review branch.

## 10. Required test matrix

| Scenario | Expected result |
|---|---|
| Anonymous / ordinary user opens Admin Panel | Denied server-side |
| Ordinary user changes localStorage/email/admin button | Still denied |
| Non-admin calls list-all-users API directly | Denied |
| Owner admin searches/paginates full directory | Allowed, complete results |
| User A reads User B private profile/IP | Denied |
| Seller changes own listing Sold/Available | Allowed only as boolean |
| Seller changes sellerUid/featured/verified/admin fields | Denied |
| Non-participant reads/writes chat | Denied |
| User requests deletion with no hold | Public/non-required data deleted or anonymised per schedule |
| User requests deletion with scoped hold | Held evidence preserved; unrelated data handled per policy |
| Deletion fails mid-process | Job resumes safely; no partial destructive inconsistency |
| Unverified informal police request | No disclosure |
| Verified valid request | Scoped, approved, encrypted export; full audit trail |
| Hold expires/releases | Scoped records return to normal retention/expiry process |
| Evidence restore | Restored object hash and manifest validate |

## 11. Required owner/legal decisions before implementation

- Confirm the canonical admin email and whether the owner wants only one admin identity. UID is the primary stable control; email is a secondary verified attribute.
- Approve which exact fields the Admin Panel needs (email, phone, IP, last login, listing history, reports, chat evidence, etc.).
- Appoint who can approve legal holds and police exports; define two-person approval if possible.
- Have Indian counsel confirm OLDX's role under IT/CERT-In/DPDP and any consumer, intermediary, payment, or sector-specific obligations.
- Approve retention periods per data category, deletion notice language, legal-hold policy, and disclosure SOP.
- Confirm whether minors can use OLDX and whether any child-data obligations apply.
- Confirm the backend hosting/runtime and a separate staging Firebase project.

## 12. Official/legal references for counsel review

- CERT-In Directions under IT Act section 70B: https://www.cert-in.org.in/Directions70B.jsp
- CERT-In Directions PDF (28 April 2022): https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf
- DPDP Rules, 2025 official notification/announcement: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014&lang=1&reg=3
- MeitY explanatory note: https://www.meity.gov.in/writereaddata/files/Explanatory-Note-DPDP-Rules-2025.pdf

Legal note: this is a technical implementation plan, not legal advice. The DPDP Rules have phased commencement; the exact provisions effective at the time of launch and OLDX's classification/applicability must be confirmed with qualified Indian counsel. Police disclosure must follow the applicable lawful process.

## 13. Completion criteria

OLDX is not considered complete until:
- Only the configured owner-admin identity can access privileged admin data/actions.
- Admin can find every user through paginated/searchable directory.
- No ordinary user can read another user's private data.
- Security/activity evidence is server-generated, access-controlled, integrity-checked, backed up, and retained only under a documented lawful schedule.
- Account deletion safely separates public deletion from scoped legal retention.
- Law-enforcement disclosure is verified, scoped, approved, encrypted, and fully logged.
- All Firestore Rules and backend tests pass in staging.
- Existing product, saved ads, chat, online status, stores, edit, and Sold/Available behaviour pass regression tests.
- Owner separately approves production rollout.


---

## Owner-approved decisions and implementation amendment (2026-10-31)

### Confirmed owner choices

- Admin access: **multiple Admin accounts may be authorised, but only accounts explicitly approved by the owner**.
- Evidence retention: **retain evidence for the period required by applicable law and for the duration of a valid Legal Hold; release/delete when the lawful period and hold both end**, subject to any other applicable obligation.
- Existing decisions remain: Admin must be able to find all users; seller can toggle own Sold/Available status.

### Multiple-admin governance (replace single-admin-only assumptions above)

1. Maintain a server-controlled allowlist of Admin UIDs. Each entry records UID, verified email, role, who approved it, approval timestamp, activation/revocation timestamp, and reason.
2. Owner approval is mandatory before an account is added, elevated, or restored. A user cannot self-enrol by changing their email, profile, Firestore document, localStorage, or client code.
3. Use Firebase custom claims or equivalent trusted role records set only by a private Admin SDK/operator process. The backend checks token validity, UID, active allowlist entry, role, and (where appropriate) verified email on every privileged request.
4. Define roles with least privilege:
   - `Owner Admin`: approve/revoke Admins, configure security, approve sensitive evidence exports and retention exceptions.
   - `Operations Admin`: manage listings/users and ordinary moderation; no role management and no unrestricted evidence export by default.
   - `Evidence Reviewer`: access only assigned cases and prepare evidence packages; cannot approve own export.
   - `Read-only Admin`: view operational dashboard fields only.
   These are proposed roles; owner must approve actual role assignments before activation.
5. Require MFA for all Admins. Require recent reauthentication for role changes, bulk exports, legal holds/releases, account deletion overrides, and sensitive record reveal.
6. Use two-person approval for Admin provisioning/revocation, legal holds, and police/law-enforcement exports wherever staffing permits. The requester must not approve their own action. If only one eligible operator exists, pause high-risk export until a second approver/legal counsel is available; document emergency exceptions.
7. Log every Admin login/access to sensitive user records, search/export, role change, moderation action, hold change, and disclosure. Alert owner on new Admin creation, privilege escalation, unusual bulk reads, and repeated failed access.
8. Revocation must invalidate/reject subsequent privileged requests promptly, revoke claims/tokens as supported, and preserve the audit trail. Maintain an offline break-glass recovery process; no shared accounts.

### Evidence retention policy decision

- Do not implement a blanket “keep everything forever” policy.
- Create a counsel-approved retention matrix per data category, purpose, legal basis, start event, standard retention period, legal-hold rule, backup expiry, and disposal method.
- Evidence linked to a valid case/hold remains restricted and preserved only for the documented scope and period. Record periodic review dates and the person approving release.
- On hold release, resume the ordinary retention clock or securely delete/anonymise if its lawful purpose/period has ended. Keep a minimal deletion/hold audit record where legally permitted/required.
- Police disclosure requires verification of authority and legal process, scoped data minimisation, approval, secure delivery, manifest/hash, recipient acknowledgement, and chain-of-custody record.
- A lawful preservation request may require preserving relevant records before any account deletion cleanup. Obtain counsel guidance on the precise scope and whether/when notice to the user is permitted.

### India legal commencement caution (verified against official sources on 2026-10-31)

- DPDP Act provisions and DPDP Rules 2025 are phased. The official commencement notification schedules some provisions from 13 November 2025, Rule 4 / specified provisions after one year, and the main substantive provisions after eighteen months (13 May 2027). Do not state that every DPDP duty is already fully operative on 31 October 2026; map each provision to its effective date and check later amendments/corrigenda before launch. Official MeitY materials: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa and https://www.meity.gov.in/writereaddata/files/Explanatory-Note-DPDP-Rules-2025.pdf. The PIB summary describes the phased implementation: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014&lang=1&reg=3.
- CERT-In Directions and the 180-day log-retention requirement must be assessed against OLDX's actual legal classification, covered systems, and current directions; do not assume all user content must be retained for 180 days. Official source: https://www.cert-in.org.in/Directions70B.jsp.
- Indian counsel must confirm applicable provisions, commencement dates, preservation/disclosure authority, retention periods, user notice, and any sector-specific rules before production implementation.

### Immediate implementation order following owner approval

1. **Discovery:** map existing Admin emails/UIDs and identify exact current Admin Panel actions/columns; inspect Firebase project, Auth providers, backend/runtime, Rules, and all data stores. Do not activate any additional Admin until the owner names/approves the accounts.
2. **Admin foundation:** implement owner-controlled UID allowlist, role claims, MFA, backend middleware, paginated all-user API, audit events, and revocation. Test direct API/Firestore bypass attempts in staging.
3. **Data split:** migrate public/private user fields with dual-read/write, reconciliation, rollback, then tighten Rules.
4. **Evidence service:** create event taxonomy, case/hold workflow, restricted encrypted store, retention scheduler, export approvals, evidence manifest, and access logs.
5. **Deletion workflow:** reauthentication first; case/hold check; preserve scoped evidence; remove public/non-required data; resumable cleanup; notify user.
6. **Rules/chat/product hardening:** enforce participant/owner/admin field-level operation constraints while preserving seller Sold/Available toggle.
7. **Staging and release gate:** emulator tests, regression tests, restore test, mock deletion/hold/disclosure exercise, independent security/legal review. Production deployment requires separate explicit owner approval.

**No Admin account has been added, no Firebase claim or Rules has been changed, no retention automation has been enabled, and no production deployment has occurred as part of this amendment.**
