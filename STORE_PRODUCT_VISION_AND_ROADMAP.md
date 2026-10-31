# OldX Store — Product Vision & Improvement Roadmap

**Branch:** `security-hardening-review`  
**Purpose:** Turn Store into a practical mini-website and shareable product catalogue for local sellers.

## Product vision

OldX Store should let a local seller who cannot afford or build a separate website/app create a professional online shop with minimal effort:

1. Create a Store profile once.
2. Add and manage all their products on OldX.
3. Have a single memorable Store link.
4. Share that link on WhatsApp, Telegram, Instagram, Facebook and other platforms.
5. Let customers view the shop, browse products, and contact the seller directly.

Store is a core marketplace feature, not a secondary profile page.

## Important improvements

### 1. Store should feel like a real online shop

- A polished shop header: shop photo/cover, shop name, short description, location, categories and clear contact actions.
- A searchable, filterable product catalogue.
- Product cards with price, discount, availability and clear product details.
- Sort options such as newest, price low-to-high and price high-to-low.
- A clear “All products” view and category filters.
- Empty states that guide a new seller to add their first product.
- Responsive mobile-first layout; most seller customers will open links on phones.
- Keep the current seller product association based on `sellerUid` unless a separately reviewed migration is approved.

### 2. Sharing should advertise the shop, not just send a URL

Implement two complementary sharing experiences:

**A. Social link preview (essential)**

When a seller pastes the Store URL into WhatsApp, Telegram, Facebook, etc., the platform should be able to fetch server-rendered Open Graph metadata:

- `og:title`: shop name + OldX
- `og:description`: short shop description, location and a call to browse
- `og:image`: an attractive image representing that exact shop
- `og:url`: canonical Store URL
- Twitter/X card metadata where useful

Important technical constraint: the current Store route uses a hash URL (`#store-{uid}`) inside a client-rendered `index.html`. Social crawlers generally do not execute the full client-side app or treat the hash as a server route. Changing JavaScript share text alone will not create a reliable dynamic preview. A crawlable server route or server-generated metadata endpoint is required.

**B. Shareable Store poster image**

Provide a “Share Store” action that creates a branded poster image containing:

- Seller's actual shop photo (not a generic unrelated stock photo).
- Shop name and a short tagline.
- Main categories.
- A short OldX Store URL or QR code.
- “Browse products on OldX” call to action.

The seller should be able to preview the poster, share/save the image, and copy the Store link. On supported phones, Web Share API file sharing can attach the image; fallback should clearly offer image download/copy link. Do not promise every app will attach both image and URL in the same share action—platform share-sheet behavior varies.

### 3. Store photo should represent the actual shop

- Ask for a clear shop-front/interior/product-display photo.
- Show framing/cropping preview before saving.
- Offer a cover-photo crop that looks good in both the Store header and the share poster.
- Keep the seller's existing photo if they edit without selecting a replacement.
- Add a concise photo quality hint: good light, shop sign visible where possible, no personal documents or private information.
- Keep file type/size validation client-side for usability, but enforce upload constraints and moderation on a trusted server before treating a photo as approved.
- Do not silently replace a seller's photo with a generated or stock image.

### 4. Make sharing and onboarding simple for local sellers

- Explain in Gujarati/Hindi/English how to create a Store and share it.
- After first Store save, show a guided “Add your first product → Share your Store” checklist.
- Keep the Store link and share action easy to find in My Store.
- Give sellers a ready-to-send short WhatsApp message, editable before sharing.
- Keep customer contact actions prominent, but do not expose private seller data in Admin lists.
- Provide a clear manual location correction option if GPS is inaccurate.

### 5. Build trust without false verification claims

- Do not label every page “Verified” unless an actual approved verification process exists.
- Distinguish clearly between “Store created on OldX” and “Identity/Business verified by OldX”.
- If verification is introduced later, define evidence, review, expiry/re-check, appeal and audit requirements first.
- Never allow a browser-only field to grant a verified badge.

### 6. Measure usefulness without invading privacy

Future seller dashboard metrics could include:
- Store visits
- Product views from the Store
- Clicks on Call / WhatsApp / Directions
- Most viewed products

Use aggregate counters or privacy-reviewed analytics; do not collect or expose private chat content. Explain to sellers what is counted.

## Suggested delivery phases

### Phase 1 — safe UX improvements

- Correct unsubstantiated “Verified Store” wording (completed in this branch).
- Improve Store header, onboarding guidance, share CTA and mobile layout.
- Add product search, sorting and bounded/paginated catalogue loading after compatibility tests.
- Add poster preview/download with a deterministic design and existing seller photo, subject to image handling tests.

### Phase 2 — reliable share previews

- Choose a crawlable Store URL strategy (for example, `/store/{uid}` or a short slug route).
- Add server-rendered Open Graph/Twitter metadata and a dynamic image endpoint or safely generated image asset.
- Validate previews using actual WhatsApp/Telegram/Facebook crawler behavior.
- Keep canonical URLs stable and handle deleted/unavailable Stores gracefully.

### Phase 3 — trusted media and data services

- Decide whether Store photos remain on Cloudinary or move to a trusted upload pipeline.
- Define server-side validation, moderation, ownership checks, size/type limits, and public-read behavior.
- Audit deployed Firestore Rules before connecting new Admin/Store capabilities.
- Add trusted, bounded, paginated product/Store APIs if needed.

### Phase 4 — seller insights and trust features

- Add privacy-reviewed aggregate Store analytics.
- Add an optional verification process only after policy and evidence requirements are approved.
- Add campaign/share templates and seller education.

## Decisions that must not be guessed

These require owner approval before implementation:

- Whether to keep Cloudinary or migrate Store images to Firebase Storage.
- Whether a new server route/backend is permitted and which hosting/runtime should own it.
- Any Firestore schema migration or new trusted collection.
- Store verification policy, seller identity evidence, retention and appeal process.
- Analytics events and retention.
- Any paid service or new external integration.

## Current implementation boundary

- Existing Store documents and product ownership model have not been migrated.
- No live Firestore or Cloudinary settings were inspected or changed.
- No Storage/Firestore Rules were published.
- No social crawler preview is claimed to work yet.
- No production deployment was performed.
