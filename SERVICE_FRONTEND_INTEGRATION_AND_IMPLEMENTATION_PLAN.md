# OldX Service — Frontend Integration & Implementation Plan

**Branch:** `security-hardening-review`  
**Status:** Source-grounded implementation plan. No Service UI, schema, Rules, backend, live data or deployment changed.  
**Source reviewed:** `index.html`, `package.json`, chat/store contract inventory, Service UX and technical readiness documents.

## 1. Confirmed frontend integration points

### Navigation and route handling
- The app is a single-page application in `index.html`; `handleHashChange()` owns hash-based view switching.
- The Store route is `#store` for the signed-in owner's Store and `#store-{uid}` for a public Store.
- The Store route branch explicitly hides several existing views and shows `#storePage`. A Service route must be added as a separate, explicit branch and must hide all incompatible views, including Store, product detail, sell wizard, profile and chat overlays as appropriate.
- The mobile bottom navigation is already occupied by Home, Chats, Sell, My Ads and Profile. Service discovery should enter from a homepage section and a compact discovery shortcut rather than adding a sixth permanent bottom item before a mobile layout review.

### Authentication
- `auth.onAuthStateChanged` assigns `window.currentUser` and refreshes the Store header.
- Guest users can browse public Store pages; owner-only Store creation redirects to authentication.
- Service should follow the same principle: public browsing/profile viewing does not require sign-in; sign-in is required only for owner editing and account-bound actions such as trackable enquiries/reviews.
- Do not copy email, Auth UID, private user profile fields or IP data into a public Service profile.

### Existing chat integration
- Current product chat derives its room ID from `{productId}_{buyerUid}`.
- Opening the product chat writes `participants: [buyerId, sellerId]` and `productId: currentProduct.docId` to `chats/{roomId}` with merge semantics.
- Existing chat messages are children of `chats/{roomId}/messages`; the inbox queries rooms by `participants array-contains currentUid`.
- This is a product-centric room contract. A Service enquiry cannot safely reuse it by inventing a product ID or pretending a service provider is a product seller.
- **MVP recommendation:** keep the first Service enquiry as a distinct Service request flow with a stable request ID. Add an OldX Message action only after a backend-owned mapping between the Service request and a chat room is designed and tested. Until then, Call/WhatsApp are optional provider-consented external contact actions, and an in-app enquiry can capture the request without promising a chat thread.

### Media
- Store currently uploads images through a browser-side Cloudinary unsigned preset.
- That is not sufficient evidence that the same preset is appropriate for Service portfolios, nor that it provides trusted file validation, moderation, ownership checks or cleanup.
- Do not reuse the upload flow for provider portfolio photos until upload policy, size/count limits, ownership and removal/cleanup are approved and tested.

## 2. Recommended UI architecture

Create a self-contained Service view module/section with isolated IDs and functions, following the Store feature's isolation pattern without copying its data model.

Suggested route names (proposal only):
- `#services` — customer service discovery.
- `#service-{providerId}` — public provider profile.
- `#my-services` — signed-in provider dashboard/onboarding.

Route requirements:
- Validate route identifiers before reads.
- Show loading, not-found, unavailable, network-error and retry states.
- On every route transition, unsubscribe any Service listeners and clear stale provider/request state.
- Avoid global mutable state where a local Service state object or module closure can be used.
- Keep public rendering on explicit allowlisted view models; never render raw Firestore documents.

## 3. Screen build sequence

### UI-only slice (safe to build before backend approval)
1. Homepage “Find Local Services” entry card and category browsing shell.
2. Search layout with manual city/locality fields and filter controls; no live query yet.
3. Provider result-card component using clearly labelled sample data only in a non-production preview/test harness.
4. Public profile layout using clearly labelled sample data only; contact buttons must not imply a real provider is reachable.
5. Provider onboarding form layout with client-side required-field UX, multiple service selection, public-contact consent toggles and preview.
6. Provider dashboard empty state and profile-completion checklist.
7. Responsive/keyboard/focus/error-state checks.

Any preview/sample data must be isolated from real collections and must never be mixed into public search results. Do not ship dead controls or fake successful save states.

### Backend-connected slice (blocked pending owner approval)
1. Finalize public/private data contract and collection/query shape.
2. Select trusted backend runtime, region, IAM identity, secrets and billing controls.
3. Review actual deployed Staging Firestore and Storage Rules/configuration.
4. Implement trusted profile create/update and allowlisted public read projection.
5. Implement bounded discovery queries, pagination and required indexes.
6. Implement Service enquiry creation and valid state transitions.
7. Add dispute/completion confirmation and one-review-per-eligible-enquiry enforcement.
8. Implement upload validation, moderation/reporting and account-deletion cleanup.
9. Add emulator authorization tests and staging integration tests.
10. Enable UI actions only after end-to-end authorization tests pass.

## 4. Data and security boundaries

- A provider has one profile and may attach multiple services.
- Profile owner identity is private authorization metadata; do not expose Auth UID as a public field unless a specific public routing design requires a non-sensitive public identifier.
- Public profile projection contains only fields the provider explicitly chose to publish.
- Phone and WhatsApp visibility are independent explicit opt-ins.
- City/locality/service areas are public only as selected by provider; exact home coordinates are not required.
- Enquiry details, customer identity, private contact details, disputes, reports and moderation metadata are private.
- Provider-supplied experience, qualifications, prices and warranty statements must be labelled as provider-provided, not OldX-verified.
- Review eligibility derives from a trusted request record and server-enforced completion rule; client state, phone clicks and WhatsApp clicks are not proof.
- Search/review queries must be bounded and paginated.
- No direct client write may determine moderation state, review eligibility, enquiry ownership or privileged fields.

## 5. Current implementation blockers

1. No production-ready OldX Firestore Rules file was found in the reviewed branch; deny-all emulator fixtures are test baselines, not deployment policies.
2. No live deployed Staging Rules, Firestore data or Storage settings were inspected in this source review.
3. Existing product chat is bound to a product ID and buyer/seller room identity; Service needs a separate request identity and an explicit chat bridge contract if in-app messaging is desired.
4. Existing Store Cloudinary upload is unsigned and cannot be assumed safe for Service portfolio uploads.
5. Service public/private fields, data schema, query indexes, backend runtime, retention and account-deletion behavior still require an approved design.
6. Hash-based SPA routes do not by themselves provide dynamic social crawler metadata; share-card previews require a separate crawlable URL/hosting design.

## 6. Test plan for the UI-only slice

- Guest can open Services discovery and public provider preview without authentication.
- Provider dashboard/onboarding prompts sign-in without breaking guest browsing.
- One provider can select multiple services and review the profile preview.
- Public contact visibility toggles are explicit and default off.
- Manual city/locality search remains usable when location permission is denied or unavailable.
- Narrow Android viewport has no horizontal overflow or obscured primary action.
- All inputs have labels, validation messages and keyboard-accessible focus.
- Loading, empty, not-found, offline and retry states are distinguishable.
- Route transitions clear prior provider state and do not leave Store/product/chat overlays visible.
- Sample data is isolated from production Firestore and clearly identified as preview content.

## 7. Change boundary

This plan does not authorize:
- Firestore/Storage schema or Rules changes.
- Public profile or enquiry writes.
- New backend functions, hosting runtime, IAM, secrets or billing.
- Production or Staging deployment/configuration changes.
- Cloudinary preset changes or other paid/external services.
- Migration or deletion of existing user data.

These require a separate implementation proposal and explicit approval.
