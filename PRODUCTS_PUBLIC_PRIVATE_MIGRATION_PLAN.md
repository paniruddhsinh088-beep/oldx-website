# OLDX Public/Private Product Migration Plan

**Branch:** `security-hardening-review`  
**Status:** Architecture proposal only; not an implementation or authorization grant.  
**Safety:** No Firebase Rules, data, IAM, billing, secrets, or deployment changed.

## Why a split is required

The existing `products/{id}` documents mix marketplace display data with fields that should not be exposed to every visitor. Firestore Rules authorize a whole document read; they cannot redact selected fields from a returned document. The observed legacy payload includes `userIp` and `phone`, while the browser also writes `isFeatured` and `isShopVerified`. Therefore, making the legacy collection publicly readable is not an acceptable shortcut for restoring the homepage feed.

## Proposed document boundaries

### `publicProducts/{productId}`

Candidate fields for the public marketplace representation, subject to a full UI field-use review:

- `sellerUid` (identity reference; immutable)
- `sellerName` (public display name only, not an authentication claim)
- `category`, `subCategory`
- `title`, `desc`
- `basePrice`, `mrpPrice`, `discountPercent`, `finalPriceStr`
- `location`, `state`, optionally validated `coords`
- `images` only after image size/count constraints and the storage decision are settled
- `isSold`
- `createdAt` (trusted server timestamp; immutable)
- `isFeatured`, `isShopVerified` only as trusted-backend-controlled fields

Do not copy `phone`, `userIp`, raw moderation notes, private audit data, or arbitrary unvalidated objects into this collection.

### `privateProductData/{productId}`

Candidate owner/backend-only fields:

- `sellerUid`
- `phone` and any additional contact details after privacy review
- `extraDetails` until each category's display/privacy schema is explicitly approved
- internal anti-abuse or moderation metadata only when collected by a trusted backend with documented purpose and retention

Do not put browser-supplied `userIp` into this record and treat it as verified. If IP-based abuse prevention is justified, collect it at a trusted server boundary and store it separately with restricted access and retention.

## Write and authorization model

- A signed-in seller may create a public listing only with `sellerUid == request.auth.uid`, validated ordinary fields, safe lifecycle defaults, and server timestamp creation.
- A seller may update only an explicit allowlist of ordinary listing fields and `isSold`; seller identity, timestamps, featured/verified flags, and moderation fields are immutable to clients.
- A seller cannot create or update `isFeatured` / `isShopVerified` to privileged values. Trusted moderation must use a separate backend operation.
- Private product data is owner-only or trusted-backend-only. Public clients cannot query it.
- Public reads apply only to `publicProducts`, never to legacy `products`.
- Product deletion and account deletion remain blocked from Rules rollout until the existing batch cleanup, chat references, store/media retention, and reauthentication behavior are redesigned and tested.

## Migration sequence (no live migration authorized)

1. **Complete source inventory:** find every product read/write in homepage feed, product detail, search/filter, My Ads, edit/stock/delete, chat creation, store views, Admin, and account deletion. Record each required field and query shape.
2. **Finalize field classification:** decide which listing fields are genuinely public; review contact/phone, coordinates, seller name, dynamic `extraDetails`, and images.
3. **Stop unsafe new writes in a separately reviewed code change:** stop browser IP collection for product docs; remove client authority over featured/verified flags; do not silently change user-visible controls before the moderation workflow is specified.
4. **Build deterministic migration tooling:** trusted Admin SDK only, idempotent, dry-run first, aggregate-only logs, stable source-to-target ID mapping, checkpoints, error report without personal data, and a verified rollback/backup plan.
5. **Test with synthetic emulator data:** include legacy records with and without optional fields, malformed values, oversized images, missing seller IDs, and private fields. Prove public projection excludes private data.
6. **Backfill only after separate explicit Staging approval:** verify counts and sampled schema using privacy-safe aggregate checks; never copy Production records or identities into Staging.
7. **Switch reads and writes behind a controlled compatibility boundary:** do not dual-write public and private documents from an untrusted browser when atomicity is required. Prefer a trusted backend transaction or a carefully tested seller write plus private-data endpoint.
8. **Run two-user regression tests:** guest browsing, seller create/edit/stock, My Ads, product detail, chat initiation, contact flow, search, store pages, and deletion lifecycle.
9. **Retire legacy collection only after verified client migration:** no public read to legacy `products`; cleanup requires explicit approval.

## Required tests before candidate Rules

- Guest can read only sanitized `publicProducts` documents.
- Guest cannot read `privateProductData` or legacy `products` documents.
- Seller A creates only a listing owned by A; claiming seller B is denied.
- Seller A cannot set or change featured, verified, moderation, IP, phone-private, or immutable identity fields.
- Seller A can update the approved ordinary fields and toggle `isSold`.
- Seller B cannot update or delete seller A's listing.
- Public query, detail, search and pagination use only the sanitized collection and required indexes.
- Invalid types, overlong strings, arbitrary nested `extraDetails`, invalid coordinates and oversized image payloads are rejected.
- Migration is idempotent; interrupted runs resume safely; rollback restores the previous read path without exposing private fields.
- Account deletion and chat references remain consistent under retry and partial failure.

## Current decision

Keep the Staging Firestore deny-all baseline. Do not add permissive Rules, deploy a migration, enable public reads on legacy `products`, or switch the production site. The immediate homepage Products loading error is expected while Staging remains deny-all; resolving it requires this migration and a separately approved, tested Staging rollout.
