# Stores Feature & Admin Readiness Audit

**Branch:** `security-hardening-review`  
**Review type:** Static source review of `index.html` and `admin.html`  
**Status:** Documentation only. No live Firebase data, rules, indexes, or deployments were accessed or changed.

## 1. Existing Store feature

The public website already includes a Store creation, owner-edit, public-store, share-link, and product-category browsing flow.

### Store document shape observed in source

Store documents are stored at `stores/{uid}` and the client writes these fields:

- `uid`
- `shopName`
- `ownerName`
- `address`
- `mobile`
- `whatsapp`
- `sameAsMobile`
- `photoURL`
- `categories`
- `coords` (`lat`, `lng`)
- `createdAt`, `updatedAt`

The document ID is the signed-in owner's UID. The owner reads and writes their own document directly from the browser using Firestore client SDK.

### Public store behavior

- Public URLs use `#store-{uid}`.
- Public page displays shop name, owner name, address, photo, categories, phone/WhatsApp actions, map location, and products.
- Public product list queries `products` by `sellerUid == store.uid` and loads the entire matching result set without pagination.
- Store photo upload uses an unsigned Cloudinary upload preset (`Oldxbazar`) and writes the returned secure URL into Firestore.
- The form enforces a client-side 5 MB photo size check; this is not a server-side security boundary.
- The public page currently labels itself “OldX Verified Store Page”, but the observed Store document schema and flow do not establish a trusted verification status or moderation workflow.

## 2. Admin panel gap

The current `admin.html` exposes only two tabs:
- Manage All Ads
- Users & Investigation Logs

There is no Stores tab, Store search, Store detail view, Store verification status, Store moderation queue, or trusted Store action.

The Admin page currently fetches all `products` and all `users` directly from Firestore. Adding a Stores tab by copying that pattern would create another unbounded client-side read and would expose Store contact/location data to the browser.

## 3. Risks and user-impact

1. **Verification wording:** “Verified Store Page” may imply OldX has verified a shop when no trusted verification state or workflow is visible in the reviewed source.
2. **Sensitive contact/location fields:** Store documents contain phone numbers, WhatsApp numbers, owner name, full address, and precise coordinates. Admin list views should not expose these fields by default.
3. **Client-controlled writes:** Store profile writes originate from the browser. Client-side form validation cannot establish trusted identity, photo safety, or verification.
4. **Cloudinary upload:** Unsigned upload is performed directly by the browser; there is no server-side moderation step in this flow.
5. **Unbounded product reads:** Public Store pages load every product for a seller in one query. This can become slow and costly for stores with many listings.
6. **No explicit Store status model:** The observed Store schema does not include a trusted status such as pending, approved, rejected, suspended, or verification timestamps/reviewer.
7. **Rules status unknown:** Static code review cannot establish whether deployed Firestore Rules safely restrict owner writes and public reads.

## 4. Recommended safe Admin design

### Phase A — UI-only shell (synthetic fixtures)

- Add a Stores tab using synthetic sample data only.
- Show non-sensitive summary fields: shop name, category labels, creation/update date, and a neutral status such as “Status not available” until a trusted status model exists.
- Include accessible selected-tab state, mobile card layout, loading/empty/error/retry states, and search within the currently loaded synthetic fixture page.
- Do not show phone, WhatsApp, owner private details, full address, exact coordinates, or raw photo URLs in the list.

### Phase B — trusted read API (requires approval)

- Use a verified-admin backend; never rely on the browser's hard-coded UID check as authorization.
- Add cursor pagination, bounded page sizes, field projection, and server-side search/filter.
- Define exactly which Store fields Admin may read and for what purpose.
- Keep contact/location details hidden unless a separately approved investigation action needs them.
- Verify actual Staging Firestore Rules and collection readiness before connecting the UI to real records.

### Phase C — verification/moderation (requires explicit policy approval)

Before implementing actions, the owner must define:
- What “verified” means and what evidence is required.
- Whether Stores are automatically public, pending review, or hidden until approval.
- Which statuses and transitions are allowed.
- Whether rejection/suspension requires a reason and an appeal path.
- Who can perform actions and what immutable audit record is retained.
- Photo moderation and re-check behavior for edited photos.

All status changes must go through a trusted backend with authorization, validation, and atomic audit logging. Do not add direct browser Firestore writes for privileged actions.

## 5. Recommended next steps

1. Correct or qualify the public “Verified Store Page” wording so it does not imply a trust check that has not been established.
2. Build the Stores Admin UI shell against synthetic fixtures only.
3. Obtain explicit approval for a read-only Staging collection audit, then validate the actual Store documents and deployed Rules.
4. Agree the Store verification and moderation policy before designing trusted mutations.
5. Add paginated Store product loading as a separate, compatibility-tested performance change.

## 6. Scope and limitations

- This is a static review of source on the review branch.
- No live `oldx-staging` or Production Firestore reads were performed.
- No Firestore or Storage Rules were changed or published.
- No Cloudinary configuration was changed.
- No Store data, user contact details, or product records were accessed.
- No Admin UI or backend implementation was changed in this audit.
