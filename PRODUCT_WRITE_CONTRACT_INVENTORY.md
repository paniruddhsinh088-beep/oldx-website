# OLDX Product Write-Contract Inventory

**Branch:** `security-hardening-review`  
**Status:** Static source inspection; not Firestore Rules and not runtime verification.  
**Safety:** No Rules, Firebase project, data, or deployment changed.

## Source paths reviewed

- `index.html` — listing creation object and `products.add()`
- `index.html` — `toggleAdStockStatus()`
- `index.html` — `renderEditAdView()` save handler
- `index.html` — seller delete handler

## Observed product create payload

The current browser create object writes these fields:

| Field | Current source value | Security direction |
|---|---|---|
| `sellerUid` | `window.currentUser.uid` | Must equal authenticated UID; immutable after create |
| `sellerName` | Auth display name or fallback | Seller-supplied display snapshot; bounded string |
| `userIp` | `userIp` from client flow | Sensitive/untrusted client value; do not treat as verified IP; preferably remove or replace with trusted server-side collection only if justified |
| `category` | selected category ID | Bounded string / approved category |
| `subCategory` | selected value | Bounded string |
| `title` | form value | Required bounded string |
| `desc` | form value | Bounded string |
| `basePrice` | parsed form value | Numeric, finite, non-negative and bounded |
| `mrpPrice` | parsed form value | Numeric, finite, non-negative and bounded |
| `discountPercent` | computed client value | Numeric and recomputed/validated; never trusted for authorization |
| `finalPriceStr` | formatted client value | Derived display field; validate consistency or derive server-side |
| `phone` | form value | Bounded string; privacy review |
| `extraDetails` | dynamic object | Needs per-category key/type/size schema before Rules |
| `coords` | selected map coordinates | Validate numeric ranges and optionality |
| `location` | village/district/state concatenation | Bounded string |
| `state` | selected state | Approved value |
| `images` | compressed data URLs | Strict count/length limits; Firestore Rules cannot inspect actual bytes; storage migration needed |
| `isFeatured` | client variable | **Privileged flag; client must not assign true** |
| `isShopVerified` | client variable | **Privileged flag; client must not assign true** |
| `isSold` | hard-coded `false` | Safe create default; seller may toggle own listing later |
| `createdAt` | Firestore server timestamp sentinel | Must be server timestamp and immutable |

The current create flow includes `isFeatured` and `isShopVerified` in its payload. A safe Rules rollout must first change this client payload to omit those fields (or force safe defaults under a carefully tested compatibility policy). Do not assume browser values are trustworthy.

## Observed seller update operations

### Stock toggle

`toggleAdStockStatus(docId, currentStatus)` updates only:

- `isSold`: inverse of the currently rendered status.

Required behavior: authenticated owner of the product can change `isSold` true ↔ false. Rules must verify the existing `sellerUid` equals `request.auth.uid`, the field diff contains only `isSold`, and the new value is boolean. This preserves the seller's In Stock / Out of Stock control.

### Edit save

The edit handler updates only:

- `title`
- `basePrice`
- `discountPercent`
- `finalPriceStr`
- `phone`
- `location`
- `desc`
- `images`

Required behavior: product owner only; exact changed-key allowlist; validate types and limits for each field; seller identity, category, state, coordinates, timestamps, verification, featured and moderation fields remain unchanged unless a separately reviewed product flow requires them.

### Seller delete

The My Ads UI directly deletes the selected product document. A future Rules policy may allow owner deletion only if the account-deletion and retention workflow is separately reconciled. The account deletion path currently uses batch deletes and has incomplete cleanup behavior. Do not tighten delete permissions until that workflow is redesigned and tested.

## Minimum Emulator test cases derived from observed source

1. Guest cannot create, update, or delete a product.
2. Seller A can create a product with `sellerUid == A`, safe defaults, valid fields.
3. Seller A cannot create a product claiming `sellerUid == B`.
4. Seller cannot create a product with `isFeatured == true` or `isShopVerified == true`.
5. Seller cannot later change `sellerUid`, `isFeatured`, `isShopVerified`, moderation fields, or `createdAt`.
6. Seller A can set own `isSold` false → true and true → false.
7. Seller A cannot change `isSold` to a non-boolean.
8. Seller A can edit the observed seller-editable fields within bounds.
9. Seller A cannot update a field outside the allowlist.
10. Seller B cannot edit or delete Seller A's product.
11. Public product reads remain available if required for guest marketplace browsing.
12. Oversized images, malformed extraDetails, invalid numeric values and overlong strings are rejected.
13. Account deletion cannot be assumed to work until its multi-document cleanup and reauthentication flow is migrated.

## Blockers before authoring deployable Rules

- Extract/validate every dynamic `extraDetails` schema by category.
- Establish image count and data URL limits, or complete storage migration.
- Decide whether `userIp` should be removed from product documents.
- Remove client assignment of privileged flags.
- Confirm all other product writes outside this inspected code path (including Admin page and any alternate edit/offer flows).
- Design account deletion and moderation lifecycle.
- Run the proposed cases against Firebase Emulator using the exact intended Rules file.

**No `firestore.rules` file is created by this inventory.** It is intentionally not safe to invent permissive or restrictive production Rules from partial source inspection.
