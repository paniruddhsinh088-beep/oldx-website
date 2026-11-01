# OLDX Product Data API and Seller Consent Contract

**Branch:** `security-hardening-review`  
**Status:** Design contract only; no API implementation, Rules change, data migration, or deployment.  
**Safety boundary:** Staging-only future work; Production is out of scope.

## 1. Purpose

Define one safe contract for the OLDX marketplace to create, read, edit, contact sellers about, and moderate products after the legacy `products` collection is retired. This contract complements:

- `PRODUCTS_ACCESS_DESIGN.md`
- `PRODUCTS_PUBLIC_PRIVATE_MIGRATION_PLAN.md`
- `PRODUCTS_READ_SURFACE_AND_FIELD_EXPOSURE_AUDIT.md`
- `PRODUCT_WRITE_CONTRACT_INVENTORY.md`

The current Staging Firestore deny-all Rules remain unchanged. This document is not permission to enable any collection or deploy a backend.

## 2. Proposed document model

### `publicProducts/{productId}`

Only fields approved for public marketplace display:

- `sellerUid`: immutable owner reference; not a role or authorization claim
- `sellerDisplayName`: bounded public display label
- `category`, `subCategory`: approved identifiers
- `title`, `description`: bounded plain text
- `basePrice`, `mrpPrice`, `discountPercent`: validated numeric values
- `locationLabel`, `state`: seller-approved coarse location
- `images`: validated image references, not arbitrary unbounded data URLs
- `publicAttributes`: category-specific allowlisted key/value object only
- `isSold`: boolean lifecycle field
- `publicationStatus`: server-controlled state; only approved/published records appear publicly
- `isFeatured`, `isShopVerified`: server-controlled flags only
- `createdAt`, `updatedAt`: server-generated timestamps

Do not include phone, email, IP address, exact home coordinates, moderation notes, internal risk scores, or raw arbitrary `extraDetails`.

### `privateProductData/{productId}`

Owner/backend-only data:

- `sellerUid`
- `contactPhone`
- `contactConsent`: explicit consent record for phone display/contact
- `exactCoordinates`: only if genuinely needed and separately consented
- `privateAttributes`: only when justified by a documented product workflow
- server-only abuse/moderation metadata where justified, with purpose and retention

Do not store browser-supplied `userIp` as a verified IP. Do not collect/store IP unless a documented abuse-prevention need and retention policy are approved.

### `productModeration/{productId}` (restricted)

Server-only operational state and moderation references. Never public. Admin actions must be audited atomically with state changes. This collection is optional if equivalent private backend state already exists.

## 3. Contact and location consent

- A phone number is private by default.
- Seller must actively opt in to public phone/WhatsApp contact. No prechecked consent.
- Consent records must include seller UID, product ID, consent choice, policy/version, and server timestamp.
- Seller can revoke consent. Revocation stops subsequent public contact disclosure; it cannot retract information already copied by visitors.
- If consent is off, show a secure in-app chat/contact action only; do not fall back to a hard-coded phone number.
- Public listing shows a coarse location label only. Exact coordinates are private by default and must not be included in public documents.
- Existing legacy phone/location data must not be presumed consented. During migration, old phone numbers remain private unless the seller re-confirms consent.

## 4. Product lifecycle

Proposed server-controlled states:

`draft → pending_review → published → hidden / rejected / removed`

- New seller submissions enter `pending_review` or an explicitly approved low-risk publication path; the publication policy must be chosen before implementation.
- Only published and non-removed products are discoverable publicly.
- Seller can edit allowlisted listing fields and mark own listing sold/available.
- Any edit that changes sensitive or moderation-relevant attributes may return the listing to review.
- Seller cannot set publication status, featured, verified, moderation notes, or trust scores.
- Moderation uses reversible hide/quarantine and restore actions before permanent deletion.
- Permanent deletion is disabled until retention, evidence, chat references, media cleanup, legal holds, and recovery behavior are implemented.

## 5. Proposed marketplace API surface

The eventual API runtime is not selected. These routes describe behavior only; they do not imply Cloud Functions, Vercel Functions, or any service has been provisioned.

### Public reads

- `GET /api/products?pageSize=&pageToken=&category=&state=&q=`
  - Publicly returns published, non-removed product summaries only.
  - Enforce page size 1–50 and stable server ordering.
  - Do not accept arbitrary Firestore collection names, fields, or sort keys.
  - Search implementation must be explicitly selected; Firestore does not support arbitrary substring search natively.
- `GET /api/products/{productId}`
  - Returns one published public projection only.
  - Never returns private product data or internal moderation fields.

### Seller operations

All seller operations require a verified Firebase ID token. The server derives seller UID from that token; request-body UIDs are ignored/rejected.

- `POST /api/seller/products`: validate and create pending listing and private owner data; enforce ownership and safe defaults.
- `PATCH /api/seller/products/{productId}`: exact field allowlist; owner only; validate all values and field-level consent changes.
- `POST /api/seller/products/{productId}/stock`: set boolean sold/available state for owner only.
- `DELETE /api/seller/products/{productId}`: initially disabled; later only a safe reversible removal request, not immediate physical deletion.
- `GET /api/seller/products/{productId}/private`: owner-only private fields.
- `PATCH /api/seller/products/{productId}/contact-consent`: explicit opt-in/out; record consent/revocation audit event.

### Contact

- `POST /api/products/{productId}/contact`: verifies product is published and seller consent allows the requested contact method; returns only the minimum permitted contact result or starts in-app chat.
- If no active consent exists, return a safe in-app chat option; never return a legacy phone number as fallback.

### Moderation (trusted Admin only)

- `POST /api/admin/products/{productId}/publish`
- `POST /api/admin/products/{productId}/feature`
- `POST /api/admin/products/{productId}/verify`
- `POST /api/admin/products/{productId}/quarantine`
- `POST /api/admin/products/{productId}/restore`

Every moderation request requires a verified token, server-resolved active role, allowlisted action, bounded reason code, idempotency protection, and atomic state + append-only audit commit. Permanent delete is not part of v1.

## 6. Validation contract

- Reject unknown request fields.
- Reject missing, null, non-finite, negative, or out-of-range price values.
- Bound title, description, seller display name, location labels and category identifiers.
- Use category-specific schemas for `publicAttributes`; reject unknown keys and nested arbitrary objects.
- Validate image references, count, type and maximum size at a trusted boundary. Prefer object storage with controlled upload flow; inline data URLs are not an approved long-term public storage format.
- Validate coordinates numerically and geographically, but do not publish exact coordinates by default.
- Derive `sellerUid`, timestamps, publication state, featured/verified flags and moderation fields on the server.
- Use server-side rate limits and abuse controls; never trust client-calculated identity, role, price formatting, consent timestamps or IP values.

## 7. Legacy migration requirements

1. Inventory every field consumed by homepage, search/filter, product detail, store page, My Ads, edit, chat/contact and account deletion.
2. Build a pure, deterministic projection transformer with synthetic fixtures only.
3. For each legacy document, produce a public projection only from the approved allowlist.
4. Exclude all phone numbers unless explicit seller consent is newly recorded.
5. Exclude `userIp`, raw moderation data, unapproved `extraDetails`, and exact coordinates from public projections.
6. Preserve original source IDs and deterministic mapping; migration must be idempotent and resumable.
7. Dry-run first with counts and privacy-safe aggregate error reporting; no raw personal data in logs.
8. Prepare backup and rollback plan before any Staging migration.
9. Never copy Production records, users, Admin identities, or secrets into Staging.
10. Do not switch client reads until public projection, private owner reads, contact consent, search, pagination, seller operations and deletion behavior all pass tests.

## 8. Required Emulator and integration tests

- Guest reads published public projection, but not draft/pending/hidden or private product data.
- Guest cannot create/update/delete any product or set moderation fields.
- Seller A creates only with server-derived owner identity.
- Seller A cannot read Seller B's private phone or coordinates.
- Seller A can read/update only own private product data.
- No phone is returned without active explicit consent.
- Consent revocation prevents subsequent contact disclosure.
- Legacy records without fresh consent never publish phone.
- Public response excludes IP, phone by default, exact coordinates, internal notes and unknown fields.
- Seller cannot set featured/verified/publication state or timestamps.
- Seller A can update allowed fields and stock; Seller B cannot.
- Invalid price, oversized strings/images, unknown attributes and malformed coordinates are rejected.
- Product publication and moderation changes append an immutable audit event atomically.
- Pagination tokens cannot be reused with altered filters or forged to access arbitrary records.
- Migration can be safely rerun and resumed; no private fields leak through projections.
- All marketplace flows work with guest + two sellers + buyer synthetic accounts.

## 9. Release gates and current decision

- Keep Staging Firestore deny-all.
- Do not create/deploy an API runtime until platform, region, billing, service identity, IAM, secrets and Staging binding have explicit owner approval.
- Do not run data migration or scan live Staging collections without explicit approval.
- Do not deploy Storage Rules or assume Storage access; current billing limitation remains.
- Do not change Production, main branch, or live website.
- Do not promise that Products will load in Staging until the full migration and permission test suite is complete.

**Current result:** contract documented; implementation remains blocked on owner-approved contact-consent behavior, category attribute schemas, publication policy, backend runtime and Staging rollout approval.
