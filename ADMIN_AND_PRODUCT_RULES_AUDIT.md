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

- Confirm whether `isSold` can be changed by sellers after listing creation.
- Confirm which admin user fields are actually needed in the admin table; avoid showing IP and private settings by default.
- Confirm whether admin user listing must support pagination/search and which fields are essential.
- Confirm whether product verification/featured status is manual admin-only or has any paid/automated workflow.
- Confirm final attachment/image count and maximum payload targets.
