# OLDX Owner Admin Authority Matrix

**Branch:** `security-hardening-review`  
**Status:** Proposed authorization contract and synthetic tests only. No role is granted and no backend/Rules are deployed.

## Product decision

The single owner-approved **Admin** role is intended to have broad, end-to-end authority to operate and manage OLDX. Within the platform-management scope, Admin can view, create, update, moderate, suspend/restore and manage users, listings, stores, reports and operational settings through trusted server APIs.

This does not mean unrestricted access to credentials, secrets, or infrastructure, and it does not remove accountability.

## Admin capabilities

| Area | Admin authority | Mandatory safeguards |
|---|---|---|
| Dashboard | View operational counts and health summaries | Aggregated data; bounded queries |
| Users | Search, paginate, view necessary account/profile details, suspend/reactivate, initiate supported account workflows | Role-appropriate fields; sensitive reads audited; no passwords, tokens or authentication secrets |
| Products/ads | View, create/edit where operationally required, feature/unfeature, verify/unverify, quarantine/restore, manage reports | Server validates fields; reason required for moderation; seller ownership preserved for ordinary seller actions |
| Stores | Review, approve/verify, suspend/restore and update operational status | Do not expose private owner data unnecessarily |
| Reports/moderation | Review reports, resolve/escalate, attach case references, quarantine content | Immutable audit events and reason codes |
| Chats/safety | Access only reported, escalated or safety-relevant conversations when needed to resolve a case | Case-linked, least-privilege, audited access; no casual bulk browsing |
| Account lifecycle | Start suspension, restoration, deletion and recovery workflows | Reauthentication/identity checks where appropriate; legal hold, retention and resumable deletion |
| Platform configuration | Manage approved business settings and content categories | Allowlisted settings only; sensitive infrastructure/configuration stays outside Admin UI |
| Audit | View relevant operational audit history | Append-only; Admin cannot alter or erase audit events |
| Roles | Use assigned Admin powers | Cannot grant/revoke own role or promote another Admin; only owner-controlled role management |

## Non-delegable owner / infrastructure boundary

- Only the owner-controlled process may grant, revoke or promote Admin identities.
- Admin cannot change their own role, edit the trusted role registry, disable audit logging, erase audit records, or bypass server authorization.
- No Admin UI/API may reveal passwords, Firebase ID/refresh tokens, service-account keys, API secrets, payment credentials, or raw infrastructure secrets.
- Production Firebase/Vercel configuration, billing, deployment credentials and destructive infrastructure actions are not part of routine Admin authority.
- Access to private chat content and sensitive identity fields must be tied to a legitimate operational purpose and logged.

## Enforcement requirements

Every Admin request must use a verified Firebase ID token and a server-resolved active role. Never authorize using a hard-coded browser UID, request-body `role`/`isAdmin`, caller-supplied actor UID, or client-side visibility. Every mutation and sensitive read must produce an append-only server audit event with actor, target, timestamp, action, reason/case reference and request ID. Use pagination, rate limits, bounded filters and `Cache-Control: no-store` for sensitive responses.

## Synthetic authorization test expectations

1. An active Admin can perform all explicitly allowlisted platform operations.
2. A normal user and guest are denied all Admin-only operations.
3. A suspended/revoked Admin is denied immediately after role resolution reflects revocation.
4. Admin cannot grant or revoke Admin roles, alter audit history, or read infrastructure secrets.
5. Private chat access requires a case-linked safety permission and creates an audit event.
6. Admin user/product lists are paginated and field-minimized.
7. The seller still controls their own allowed listing fields and can toggle their own `isSold` status; Admin powers must not weaken seller ownership checks.
8. Permanent deletion remains blocked where retention, legal hold, evidence preservation or recovery requirements are unresolved.

## Implementation gates

This contract does not itself grant Admin privileges. Implement only after the owner-approved Admin identity, backend runtime, staging project/region, role registry and audit storage are confirmed. Test against synthetic data and Emulator. No Production settings, Production V13, `oldx-1c983`, live Rules or real user records may be changed as part of this review.
