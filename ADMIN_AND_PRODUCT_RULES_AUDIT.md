# Admin Access and Product Edit Field Audit

## Scope

- Reviewed `admin.html` and relevant product edit/create code in `index.html` on `security-hardening-review`.
- This is a static source review, not a live Rules or runtime test.
- No Firebase Rules, production data, Cloudinary settings, or deployment were changed.

## Admin page Firestore access

Observed operations in `admin.html`:

| Collection | Operation | Purpose | Required security |
|---|---|---|---|
| `stats/traffic` | get | Display total visitor count | Admin-only read, or expose a sanitized aggregate counter. Do not grant all users access to admin data merely for this panel. |
| `products` | get all | Admin ads table and counts | Admin-only query/read. Public product read remains a separate marketplace requirement. |
| `users` | get all | Admin users table and counts | Highly sensitive: only verified admins via trusted authorization; long-term prefer a backend endpoint returning only fields needed by the panel. |
| `products/{docId}` | delete | Admin delete ad action | Must require verified admin authorization, independent of client UI. |

### Important compatibility/security conflict

The admin page currently loads the entire `users` collection and entire `products` collection from the browser. Tightening `users` to owner-only access will intentionally break the current admin users table unless that flow is migrated to a trusted backend or a separate minimal admin view. Do not weaken user privacy just to preserve this current implementation.

The admin page's current UID check is a client-side navigation/UI gate. It does not secure direct Firestore calls. Firestore Rules must independently enforce admin authorization. Preferred long-term approach: Firebase Auth custom claim set only by trusted Admin SDK code; admin endpoints and Rules verify the claim. Do not let clients set their own claim.

## Product edit flow in index.html

The edit form reads/updates these fields:

- `title`
- `basePrice`
- `discountPercent`
- `finalPriceStr` (derived display field)
- `phone`
- `location`
- `desc`
- `images` (existing images retained unless replacement files are selected)

It currently updates these fields together in one Firestore update. The edit flow also caches the changed product in memory and updates Recently Viewed localStorage.

### Proposed seller-editable allowlist (subject to full product schema verification)

- `title`
- `basePrice`
- `discountPercent`
- `phone`
- `location`
- `desc`
- `images`

Prefer deriving `finalPriceStr` in trusted code or validating it against the numeric price/discount; it is not an authority field.

### Fields that sellers must not be able to change

- `sellerUid`
- `isFeatured`
- `isShopVerified`
- moderation/approval state, admin notes, audit metadata
- original ownership/creation metadata such as `createdAt` unless an explicit product requirement says otherwise

The stock toggle separately updates `isSold`. Confirm that sellers should be allowed to mark their own item sold/available; if yes, permit only a boolean change to this field for the owner. Admin actions must remain separate.

### Product create payload concerns

The create flow writes a broad payload including seller identity, category/subcategory, title/description, prices, phone, extra details, location/state, images, `isFeatured`, `isShopVerified`, `isSold`, and `createdAt`.

- Do not trust client values for `isFeatured` or `isShopVerified`; force safe defaults or have a trusted admin/backend workflow set them.
- Require `sellerUid == request.auth.uid`.
- Require `isSold == false` on initial create unless a deliberate workflow needs otherwise.
- Validate price and discount ranges and all expected types.
- Limit text lengths, image count, and payload sizes.
- Firestore Rules cannot decode/inspect image bytes inside inline data URLs. A storage migration with server-side MIME/size validation is the durable solution.

## Recommended backend endpoints / callable operations

1. `getAdminDashboardSummary`: verified admin only; return aggregate counts and minimal necessary data.
2. `listAdminUsers`: verified admin only; pagination, minimum fields, no IP or private settings unless explicitly justified.
3. `adminDeleteProduct`: verified admin only; audit actor, target, timestamp, reason; perform delete server-side.
4. `setProductVerification` / `setProductFeatured`: verified admin only; validate and write privileged fields.
5. Admin claim provisioning: operator-only secure process; never callable by ordinary clients.

## Required Emulator and regression tests

### Admin
- Unauthenticated user cannot read admin-only user records or stats.
- Ordinary authenticated user cannot list all users.
- Ordinary user cannot delete another user's product.
- Admin UID/custom-claim user can perform only approved admin operations.
- Forged email, localStorage, hidden button, or direct SDK call cannot grant admin access.
- Admin dashboard shows required fields after backend migration without exposing email/IP/private settings to ordinary users.

### Seller product lifecycle
- Seller creates own listing with valid fields.
- Seller cannot spoof another sellerUid.
- Seller can edit only approved fields.
- Seller cannot alter featured/verified/moderation/admin metadata.
- Seller can toggle own `isSold` only if product policy confirms it.
- Other user cannot edit/delete the listing.
- Product image preservation works when no replacement is selected.
- Product image replacement works with valid images and rejects oversized/unsupported files.
- Public feed, product detail, My Ads, Recently Viewed, and store-linked product views still work.

## Decisions needed before final Rules implementation

- CONFIRMED BY OWNER: Sellers must retain the current ability to toggle their own `isSold` status (Sold / Available). Rules must permit only the owner to change this boolean field, without permitting changes to ownership or privileged fields.
- CONFIRMED BY OWNER: Admin Panel must continue to show all users, not a restricted subset. Preserve the current all-users management capability. Implement it through a verified-admin-only backend with pagination and least-privilege field selection; include email/IP only where required by the existing admin workflow, and never expose this dataset to ordinary users.
- Implementation requirement: Admin user listing must support all users with pagination/search so the panel remains usable as the user base grows. Confirm the exact columns currently rendered in `admin.html` before deciding which fields the backend returns.
- Confirm whether product verification/featured status is manual admin-only or has any paid/automated workflow.
- Confirm final attachment/image count and maximum payload targets.


## Owner clarification: Admin-only access and fraud-evidence retention

### Admin identity and visibility

- OWNER REQUIREMENT: Only the administrator account/email configured by the owner may access the Admin Panel and its user records.
- Enforce this on the trusted backend and Firestore Rules, not only by hiding the Admin button or checking a value in browser JavaScript.
- Bind the configured, verified Firebase Auth identity to its immutable UID (and verify the expected email where appropriate). Do not authorize by an email string supplied by the browser, localStorage, or an editable profile field.
- Admin may view the complete user directory and the user information needed for legitimate administration. Use pagination/search; protect sensitive fields such as email, IP, account identifiers, and evidence records from all non-admin users.
- Log administrative access and sensitive actions (admin actor UID, action, target record, timestamp, reason, and outcome). Protect these audit logs from client modification/deletion.

### Fraud investigation and account deletion

- OWNER REQUIREMENT: Preserve a usable record of every user's relevant account and platform activity so that, if a user deletes an account after suspected fraud, OLDX can preserve evidence and respond to a valid police/law-enforcement request.
- Account deletion must not immediately erase records subject to a documented legal hold, active fraud investigation, or other lawful retention requirement. Use a soft-delete/deactivation state first; separate public profile removal from restricted evidence retention.
- Evidence candidates, subject to legal review and data minimisation: stable internal user UID; registration and account-change timestamps; verified contact details where collected; login/session/security events; IP address with timestamp and timezone where lawfully collected; product/listing create/edit/delete history; transaction/order/payment references if those features exist; chat/message records and attachment metadata/content where necessary; reports, moderation decisions, and admin actions.
- Preserve original timestamps, source identifiers, and integrity metadata. Keep evidence in a separate restricted collection/storage area, encrypted and backed up, with immutable or append-only audit history and tightly limited access. Record every view/export.
- Provide a controlled evidence-export workflow: record the request authority/reference, legal basis, scope, approving admin, exported items, export timestamp, and recipient; export only the responsive records through a secure channel. Do not provide data merely on an informal request; verify and follow applicable legal process.
- Define retention periods by data category and applicable law. Expire/delete data when the purpose and lawful retention period end, unless a valid legal hold applies. Do not promise indefinite retention or collect/store every possible personal detail by default.
- The account deletion flow must first check for legal hold/investigation status and preserve required evidence, then remove or anonymise non-required personal data and public content according to the approved policy. Make deletion resumable and auditable.
- Static source review has not verified the live Firebase, Cloudinary, hosting, payment, or authentication logs. These systems must be inventoried before claiming complete evidence coverage.

### Compliance note (India; legal review required)

- CERT-In's 28 April 2022 Directions require entities within their scope to securely retain ICT system logs for a rolling 180 days in India; applicability and implementation details should be confirmed for OLDX's actual role and infrastructure. See the official [CERT-In Directions](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf).
- India's DPDP Act and 2025 Rules include erasure/retention requirements and exceptions where retention is necessary to comply with law; the final retention schedule and police-disclosure process must be reviewed by qualified Indian counsel. See the [MeitY/PIB announcement of the DPDP Rules, 2025](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190655&lang=2&reg=48).
- This document is an engineering plan, not a legal opinion. No production data, Firebase Rules, or deployment were changed.
