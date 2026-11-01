# OLDX Category and Public-Attribute Schema v1

**Branch:** `security-hardening-review`  
**Status:** Static source-derived schema proposal; no live data changes.  
**Safety:** No Rules, Firebase projects, backend, or deployment changed.

## 1. Source evidence

The current seller wizard in `index.html` defines these main category IDs and subcategories:

| ID | Subcategories |
|---|---|
| `cars` | Cars / 4 Wheelers |
| `properties` | For Sale: Houses & Apartments; For Rent: Houses & Apartments; Lands & Plots; For Rent: Shops & Offices; PG & Guest Houses |
| `mobiles` | Mobile Phones; Accessories; Tablets |
| `bikes` | Motorcycles; Scooters; Spare Parts; Bicycles |
| `electronics` | TVs, Video - Audio; Kitchen & Other Appliances; Computers & Laptops; Cameras & Lenses; Games & Entertainment; Fridges; Computer Accessories; Hard Disks, Printers & Monitors; ACs; Washing Machines |
| `commercial` | Commercial & Other Vehicles; Spare Parts |
| `furniture` | Sofa & Dining; Beds & Wardrobes; Home Decor & Garden; Kids Furniture; Other Household Items |
| `fashion` | Men; Women; Kids |
| `books` | Books; Gym & Fitness; Musical Instruments; Sports Equipment; Other Hobbies |
| `pets` | Dogs; Pet Food & Accessories; Other Pets |
| `jobs` | Data Entry & Back Office; Sales & Marketing; BPO & Telecaller; Driver; Office Assistant; Teacher |
| `services` | Education & Classes; Tours & Travel; Electronics Repair & Services; Health & Beauty; Home Renovation & Repair; Cleaning & Pest Control; Legal & Documentation Services; Packers & Movers; Other Services |

This list is copied from the current UI source, not inferred marketplace taxonomy. Changes to UI categories must be reviewed against this schema.

## 2. Actual legacy dynamic-field behavior

The current form only builds the following dynamic fields:

- For `cars`: `brand` (select) and `model` (text).
- For every other category: `type` (text).

The submit handler writes all three keys (`brand`, `model`, `type`) into `extraDetails`, usually with empty strings for unused fields. The detail view loops over every supplied `extraDetails` key and renders it. This is not a safe reason to allow arbitrary keys or values in a future public document.

## 3. Proposed v1 public attribute allowlist

### Cars

`publicAttributes` may contain:

- `brand`: one of `Maruti Suzuki`, `Hyundai`, `Tata`, `Mahindra`, `Honda`, `Toyota`, `Other`.
- `model`: plain text, 1–80 characters after trimming.

At least one non-empty field is required for a car listing; the current UI marks both as required, so the eventual API should require both unless the product owner explicitly changes the UI contract.

### All other current categories

`publicAttributes` may contain only:

- `type`: plain text, 1–120 characters after trimming.

This preserves the current generic “Type / Details” field but does not claim it is a category-specific structured attribute. It must be rendered as escaped/plain text, never HTML. Empty values are omitted. Unknown keys are rejected.

### Fields deliberately not defined yet

Do not invent public structured attributes for properties, mobiles, bikes, electronics, commercial vehicles, furniture, fashion, hobbies, pets, jobs, or services until the product owner approves field names, types, validation, privacy, and UI behavior for each subcategory. Keep them on the generic `type` field for this v1 compatibility proposal.

## 4. Common validation

- Category ID must exactly match one of the 12 IDs listed above.
- Subcategory must exactly belong to the selected category.
- Reject unknown keys, nested objects, arrays, booleans and numbers in `publicAttributes`.
- Trim strings and reject empty values after trimming.
- Enforce the field-specific maximum lengths above.
- Reject markup/control characters where they could cause unsafe rendering; output as text, not HTML.
- Do not place phone, email, IP, exact coordinates, private notes, identity documents or moderation data in public attributes.
- Category and subcategory are seller listing metadata, not authorization claims.
- Existing arbitrary legacy `extraDetails` must not be copied without this validator.
- Invalid or unknown legacy category/attribute combinations go to a migration exception report and remain unpublished; do not silently guess a category.

## 5. Migration policy

- Convert legacy `extraDetails.brand/model` only for `cars`.
- Convert legacy `extraDetails.type` only for non-car categories.
- Drop unused empty fields.
- If a car record has missing/invalid brand or model, or another category has missing/invalid type, it remains pending review and its public attributes are omitted or flagged for manual correction.
- Never use client `isFeatured`, `isShopVerified`, publication state, timestamps or arbitrary nested fields.
- Keep phone and exact coordinates in private projection with consent off.
- No migration execution is authorized by this schema.

## 6. Required tests before adoption

- Each known category and valid subcategory is accepted.
- Unknown category and mismatched subcategory are rejected.
- Cars accept only approved brand values and bounded model text.
- Non-cars accept only bounded `type`.
- Car cannot smuggle `type`; non-car cannot smuggle `brand` or `model`.
- Nested objects, arrays, numbers, booleans, unknown keys and overlong strings are rejected.
- Empty legacy values are omitted; missing required attributes remain pending review.
- Public projection never copies unapproved `extraDetails` keys.
- Rendered attributes are plain text, not HTML.

**Decision required before production-grade implementation:** approve whether missing dynamic details should block submission, permit a draft, or enter manual review. The safe default is pending review and no public publication.
