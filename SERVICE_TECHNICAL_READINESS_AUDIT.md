# OldX Service — Technical Readiness Audit

**Branch:** `security-hardening-review`  
**Audit type:** Static source review of the existing single-page application and Store feature.  
**Scope:** Read-only inspection; no live Firebase data, deployed Rules, Storage settings, user records or Production environment were changed or inspected.

## 1. Existing integration points

### Frontend and navigation
- The primary application is a single-page `index.html` with client-side hash navigation handled by `handleHashChange()`.
- The homepage already contains a bounded Local Stores discovery section.
- Store has its own page container, owner form, public view and share action.
- The mobile bottom navigation is already dense (Home, Chats, Sell, My Ads, Profile); adding another permanent bottom-nav item would risk crowding small screens.
- Recommended placement: a dedicated homepage **Find Local Services** section and an accessible Services entry from the main discovery/navigation area. Add a “My Services” action near account/profile and Store actions after checking the complete mobile layout.

### Authentication
- Firebase Authentication is initialized in the browser.
- The app stores the signed-in Firebase user in `window.currentUser` via `auth.onAuthStateChanged`.
- Existing Store creation requires sign-in and stores one document at `stores/{uid}`.
- This is useful for a provider's account ownership, but client-side authentication alone does not enforce the business rules needed for enquiry completion, review eligibility, moderation or public/private field projection.

### Store feature patterns
- Store owner profile is currently a single `stores/{uid}` document.
- Store data includes shop name, owner name, address, mobile, WhatsApp, categories, photo URL, coordinates and timestamps.
- The Store public route is `#store-{uid}`; its public view reads the Store document and loads products using `products.sellerUid == store.uid`.
- Store creation currently writes directly from the browser to Firestore and uploads its photo through a Cloudinary unsigned upload request.
- Store sharing currently uses `navigator.share` or clipboard with the hash-based URL.
- These patterns provide useful UX references, but Service must not copy Store's exact data model blindly: Service has different privacy, discovery, enquiry and review requirements.

### Messaging
- Existing OldX chat is tied to a product buyer/seller context (buyer UID, seller UID and product details).
- A generic Service enquiry is not necessarily a product conversation. Before reusing chat, inspect its room identity, duplicate-room behavior, permissions and message context. Do not silently create fake product records to represent services.
- A service enquiry should have its own stable request identity even if it later opens the existing chat interface.

### Rules and backend readiness
- No production-ready `firestore.rules` file was found in the reviewed branch.
- Existing emulator safety setup uses a deny-all fixture for baseline tests; this is not a deployable OldX permission policy.
- No live deployed Firestore Rules were inspected during this audit.
- Therefore, a public provider directory, profile writes, enquiries and reviews must not be enabled on the assumption that current permissions are safe.
- The current app contains direct browser Firestore writes. Client validation is not an authorization boundary.

## 2. Main design implications

1. **One provider profile, many services:** Keep one profile owner identity and associate multiple service categories/skills with it. Do not require one profile per service.
2. **Separate public and private information:** Publish only profile fields the provider explicitly chooses to show. Keep account identity, private contact data, enquiry details and moderation state restricted.
3. **Approximate service area:** Prefer city/town/locality and service radius. Do not expose exact home coordinates by default.
4. **Real completed-work feedback:** A call or WhatsApp click is not evidence of completed work. A review entitlement must derive from a trusted enquiry and a controlled completion state.
5. **Trusted state transitions:** Enquiry creation, provider/customer completion confirmations, dispute states, one-review-per-request checks and moderation must be enforced server-side before public launch.
6. **Bounded discovery:** Query by category and location with pagination and reviewed indexes. Do not download all providers or all reviews to filter in the browser.
7. **Media:** Existing Store Cloudinary usage is not proof that the upload preset, moderation or privacy model is suitable for Service portfolio uploads. Review the media pipeline before reuse.
8. **Share preview:** Hash URLs are not reliable dynamic social-preview URLs. A crawlable route and server-generated metadata are a separate hosting/runtime decision.

## 3. Recommended implementation sequence

### Step A — product and interaction design
- Define provider onboarding fields and optional fields.
- Define service taxonomy and multi-service selection UX.
- Define customer search/filter behavior and provider card.
- Define provider profile layout and mobile actions.
- Define availability and contact-consent controls.
- Define enquiry state machine and review eligibility rules.
- Define report / dispute / moderation UX.

### Step B — backend and data design review
- Propose public/private profile data boundaries.
- Choose profile/service/enquiry/review data layout based on queries and security rules.
- Confirm trusted backend platform, region, IAM, billing and staging project.
- Inspect actual deployed Firestore Rules and Storage configuration.
- Define rate limits, abuse prevention, retention and account deletion behavior.
- Obtain owner approval before implementing any new backend, schema, Rules or migration.

### Step C — frontend MVP
- Add Service discovery section without disturbing existing product/store discovery.
- Add provider profile creation/edit form with multi-service selection.
- Add responsive public profile view and safe rendering.
- Add bounded customer search with manual location fallback.
- Add provider share link/poster UX with honest fallback behavior.
- Add OldX Message / Call / WhatsApp actions according to provider preferences.

### Step D — trusted enquiries and reviews
- Add server-authorized enquiry creation and state transitions.
- Add customer/provider completion confirmation and disputed state.
- Enforce one completed-work review per eligible request.
- Keep contact feedback separate from completed-work reviews.
- Add tests for ownership, cross-account access, duplicates, abuse and moderation.

## 4. Not implemented / not verified

- No Service collections, documents, indexes or Firestore Rules were created or changed.
- No Service UI or user-facing controls were added.
- No provider profile, enquiry, review or moderation workflow is live.
- No live Staging Firestore/Storage inspection was performed.
- No image upload provider was selected for Service.
- No server-rendered Service URL or social crawler preview was built.
- No Production deployment was performed.

## 5. Release blockers

Service should not launch with public writes or verified-work ratings until:
- Actual deployed Firestore Rules are reviewed and tested.
- A trusted backend enforces ownership and enquiry/review state transitions.
- Public/private profile field access is tested.
- Upload validation and moderation are defined.
- Abuse reporting and dispute handling are operational.
- Search queries are bounded and indexes are deployed through an approved process.
