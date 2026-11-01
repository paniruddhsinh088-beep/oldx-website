# OLDX Product Read-Surface and Field-Exposure Audit

**Branch:** `security-hardening-review`  
**Status:** Static source audit; not a runtime trace or authorization policy.  
**Safety:** No code, Rules, Firebase data, billing, IAM, secrets, or deployment changed.

## Reviewed sources

- `index.html` at source blob `7d42c67ec8b960937ebd4a2703d754f81cfc45d1` (5,226 lines).
- `admin.html` at source blob `168f65e7352fe9c44576c2a6b17cf23d87a6a5b0` (442 lines).
- Existing product write inventory and public/private migration design.

## Every direct legacy product collection access found

| Source | Operation | Purpose | Migration target / constraint |
|---|---|---|---|
| `index.html` account deletion | Query `products` by `sellerUid`, batch delete | Seller account cleanup | Trusted resumable deletion workflow; do not grant broad client delete |
| `index.html` My Ads stock toggle | Update product `isSold` | Seller stock control | Owner-only allowlisted update on public listing or trusted write endpoint |
| `index.html` My Ads delete | Delete product doc | Seller deletes own listing | Must reconcile chat references, retention, media cleanup and account deletion before allowing |
| `index.html` edit open | Get product by document ID | Seller edit form | Read own private data through owner-scoped private path; public listing read for shared fields |
| `index.html` edit save fallback | Get product by document ID | Recover images/current record before save | Separate public listing and private fields; avoid unrestricted legacy document read |
| `index.html` homepage listener | Ordered query by `createdAt`, limited | Public marketplace feed | `publicProducts` only; legacy collection must not be opened to public |
| `index.html` public store page | Query by `sellerUid` | Store's product grid | `publicProducts` only; ensure only approved public listings appear |
| `index.html` listing submit | Add product document | Seller creates listing | Trusted/validated public + private write contract; no browser IP or privileged flags |
| `admin.html` dashboard | Unbounded full collection read | Admin Ads table and featured count | Remove; bounded backend read with minimal projection |
| `admin.html` delete | Direct browser document delete | Admin moderation | Remove; trusted authenticated API with atomic audit |

No other direct `collection('products')` calls were found in the reviewed `index.html` and `admin.html` source versions. This does not rule out indirect reads through other modules, old deployed bundles, or external services.

## Important UI dependencies discovered

- Public store product grid uses seller UID to find listings; it must move to `publicProducts` and apply publication/moderation visibility filters.
- Product detail and chat contact actions read the product's `phone` field. Current UI constructs a telephone link and WhatsApp link from it. This means contact number is currently intended to be shared with interested visitors, but it is still personal contact data and should only be public if the seller explicitly consents. Prefer an explicit `contactVisible` / consent workflow or a controlled contact endpoint; do not silently expose every legacy phone number during migration.
- Product detail renders dynamic `extraDetails` key/value pairs. Current creation includes `brand`, `model`, and `type`, but a complete category-specific schema and key allowlist is still needed before public projection.
- Product cards/detail use title, price fields, location, category, images, featured/verified flags, sold status, seller UID/name, MRP and discount. Public field list must be finalized from the complete render paths and privacy review.
- Recently viewed local storage stores a small public summary (document ID, title, price, location, category, images, featured/verified/sold, MRP, base price and discount); this should not store phone, IP or private product fields.
- Product image data is stored inline in Firestore documents. Public image reads must be constrained by count/size and XSS-safe rendering; long-term object storage needs its own signed upload and access design.

## Sensitive and privileged fields

| Field | Current behavior | Required decision |
|---|---|---|
| `userIp` | Browser-supplied value in listing create payload | Remove from product documents; do not treat client-supplied value as verified |
| `phone` | Used for tel and WhatsApp contact actions; also editable by seller | Explicit seller consent and controlled public exposure; keep private by default until consent model is implemented |
| `extraDetails` | Rendered dynamically on public product detail | Allowlist keys and types per category; reject arbitrary nested values |
| `isFeatured` | Browser checkbox is read and written on create; also rendered in cards | Backend-controlled only |
| `isShopVerified` | Browser checkbox is read and written on create; also rendered in cards | Backend-controlled only |
| `sellerUid` | Used for owner checks, chat routing and store filtering | Public identity reference only if justified; immutable and must match authenticated UID on create |
| `coords` | Used by map/location features | Decide location precision and seller consent; avoid exposing exact coordinates by default |
| `images` | Inline data URLs | Strict count/size/type constraints; separate storage migration and abuse controls |
| `createdAt` | Server timestamp on create; used for ordering | Server-generated and immutable |

## Blocking implementation risks

1. Public read on legacy `products` exposes all fields in each returned document; Firestore Rules cannot redact `userIp`, `phone`, or other fields.
2. Making `publicProducts` available before all homepage, search, detail, store, My Ads, edit, chat and deletion paths are migrated will cause partial breakage or force insecure fallback reads.
3. Contact-number exposure requires explicit product-owner consent and a migration rule for existing listings.
4. Admin's full collection read and direct delete must remain disconnected from Firestore.
5. Account deletion currently batches product deletes with user deletion and has not been proven safe for high listing counts, chat references, stores or media.
6. Exact map coordinate exposure needs a privacy decision; location labels may be sufficient for public browse.
7. Featured and verified UI controls must not imply that sellers can grant themselves these statuses.

## Acceptance checklist before implementation

- [ ] Finalize public listing field allowlist with seller contact consent and location precision.
- [ ] Define category-specific `extraDetails` schemas and reject unknown keys.
- [ ] Define publication lifecycle (draft/pending/approved/rejected/removed) and public visibility conditions.
- [ ] Trace all product-detail, search, chat, store and seller UI consumers against the new split.
- [ ] Define owner-private read/write API for phone and other private fields.
- [ ] Remove direct Admin Firestore reads/deletes and connect only after trusted backend approval.
- [ ] Implement idempotent migration and dry-run report using synthetic/emulator data.
- [ ] Add full candidate Rules Emulator tests, not only deny-all baseline tests.
- [ ] Run guest + two-seller + buyer regression tests.
- [ ] Obtain explicit approval before any Staging Rules/data change; Production remains out of scope.

## Decision

Keep Staging Firestore Rules deny-all and do not enable public reads on legacy `products`. The current Products loading error remains an expected consequence of the deny-all staging baseline. No migration, Rules publication or deployment is authorized by this audit.
