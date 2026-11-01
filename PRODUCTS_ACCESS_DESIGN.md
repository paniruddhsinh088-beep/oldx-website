# OLDX Products Access Design (Review Draft — No Rules Deployment)

## Current loading failure

The homepage listener in `index.html` reads `products`, orders by `createdAt` descending, and limits the result. The current Staging deny-all Firestore baseline rejects this read, which triggers the generic “We could not load products” alert.

## Product document fields observed in the client

The current product creation flow writes:

- Seller/listing identity: `sellerUid`, `sellerName`
- Listing content: `category`, `subCategory`, `title`, `desc`, `basePrice`, `mrpPrice`, `discountPercent`, `finalPriceStr`, `phone`, `location`, `state`, `images`, `extraDetails`, `coords`
- Lifecycle: `isSold`, `createdAt`
- Sensitive or privileged fields currently written by the browser: `userIp`, `isFeatured`, `isShopVerified`

The browser also updates `isSold`, and edits `title`, `basePrice`, `discountPercent`, `finalPriceStr`, `phone`, `location`, `desc`, and `images`.

## Security blockers before public product reads

1. Firestore Rules cannot hide individual fields from a document. A public read of the existing `products/{id}` documents also exposes `userIp` wherever it is present.
2. The current browser create flow reads `adIsFeatured` and `adIsShopVerified` checkboxes and writes their values directly. A user can modify browser code or issue direct Firestore requests, so these flags cannot be trusted as client-authorized privileges.
3. The product creation flow fetches an IP address and stores it in the public product document. This must stop; do not use IP as a public listing field.
4. The seller's identity must be immutable: create must bind `sellerUid` to `request.auth.uid`; update must not permit changing it.
5. Public product reads are safe only after legacy documents containing private fields have been migrated or the public listing data has been split into a dedicated public document.

## Recommended migration

- Stop writing `userIp` from the browser. If there is a documented abuse-prevention need, collect it only in a trusted backend and store it separately with restricted access and retention.
- Remove client authority over `isFeatured` and `isShopVerified`. Default both to false or omit them on client creation. Only a trusted moderation/admin backend may set them.
- Introduce a public listing representation containing only fields required by browsing and product detail pages. Keep private/internal fields in a separate owner/backend-only record.
- Backfill existing products with synthetic-safe migration tooling and verify counts before switching reads. Do not expose old documents publicly until the legacy `userIp` field has been dealt with.
- Keep existing user flows compatible during migration; do not delete legacy fields or collections until reads/writes have been moved and tested.

## Candidate authorization requirements

| Operation | Intended result |
|---|---|
| Public listing read | Allowed only on the sanitized public listing representation |
| Unauthenticated product create | Denied |
| Authenticated seller create | Allowed only when seller identity is bound to auth UID and schema is valid |
| Seller update own listing | Allowed only for an explicit ordinary-field allowlist |
| Seller change sellerUid | Denied |
| Seller set featured / verified / moderation fields | Denied |
| Other seller update/delete | Denied |
| Owner delete own listing | Allowed if product lifecycle permits |
| Client write to private moderation/IP fields | Denied |

## Test requirements

Use only synthetic emulator documents and users:

- Public/guest can read a sanitized public listing.
- Guest cannot create, update, or delete.
- Seller A can create a valid listing whose `sellerUid` is Seller A.
- Seller A cannot create a listing for Seller B.
- Seller A can update permitted fields on their own listing.
- Seller A cannot change `sellerUid`, `isFeatured`, `isShopVerified`, `userIp`, or moderation fields.
- Seller B cannot update or delete Seller A's listing.
- Client cannot write the private/internal product record.
- Existing legacy documents with private fields are not made publicly readable before migration.

## Safety boundary

This is a design document only. Keep Staging Firestore deny-all until the sanitized data shape, complete client field inventory, emulator tests, and rollback plan are ready. Do not publish Rules to Staging or Production as part of this draft. Production project `oldx-1c983`, `main`, and the live site remain out of scope.
