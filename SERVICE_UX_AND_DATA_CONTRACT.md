# OldX Service — UX Flow, Screen Specification & Data Contract Proposal

**Branch:** `security-hardening-review`  
**Status:** Design proposal only. Not a deployed schema, permission policy, UI implementation or launch approval.

## 1. UX principles

1. A first-time provider should be able to publish a useful basic profile in a few minutes.
2. Ask for essential information first; make portfolio, price guidance and detailed schedule optional and editable later.
3. One provider account owns one public profile and can attach multiple service skills/categories.
4. Customer discovery must work with manual city/locality selection; location permission is optional.
5. Do not require a customer to sign in just to browse public profiles. Require sign-in only for actions that need an account, such as creating a trackable enquiry or leaving eligible feedback.
6. Do not expose a provider's phone/WhatsApp by default. Provider chooses which contact methods to show.
7. Avoid presenting unverified claims as verified, guaranteed or endorsed by OldX.
8. Every screen must work on narrow Android phones, keyboard-only navigation and slow networks.

## 2. Provider onboarding — recommended 3-step flow

### Step 1: Basic identity
Required:
- Public display name (person or service business name).
- At least one main service category.
- City/town and one locality or service area.
- At least one contact route: OldX enquiries, phone or WhatsApp.

Optional:
- Profile photo.
- Short introduction.
- Languages.

Copy should explain which fields are public before save. Existing account email, private profile data and Auth UID must never be copied into the public profile automatically.

### Step 2: Services and coverage
- Select multiple categories and specific skills.
- Allow a short custom service label only if taxonomy governance and abuse controls permit it; otherwise provide a “suggest a category” request.
- Add one or more localities served.
- Optional service radius and travel limitations.
- Optional availability: Available / Busy / Temporarily unavailable.
- Do not require exact GPS coordinates or publish a home address.

### Step 3: Trust and portfolio
- Add real work photos, with preview, reorder and remove controls.
- Experience in years (optional).
- Optional starting price / price range with unit and “final quote after inspection” choice.
- Optional work hours.
- Optional qualifications or warranty terms as provider-supplied claims, clearly not OldX-verified.
- Preview the public profile before publishing.

After first save, show a profile completion checklist. Never block a basic profile solely because optional details or photos are missing.

## 3. Provider profile page layout

Recommended order on mobile:
1. Cover image or branded gradient fallback.
2. Profile image, provider name, primary service and locality.
3. Availability label (only if recently updated; otherwise show “Availability not updated”).
4. Clear contact actions respecting provider's visibility settings.
5. Services / skills chips.
6. About and experience.
7. Work gallery with tap-to-view.
8. Areas served and working hours.
9. Indicative price guidance with explicit context.
10. Customer feedback: completed-work and contact feedback separately.
11. Share profile, copy link, share poster and report profile.

Avoid a “Verified” badge until a separate identity verification program is approved and implemented. Avoid a five-star average for profiles with too few or no eligible reviews; show “New on OldX” or “No reviews yet”.

## 4. Customer discovery screens

### Homepage section
- Heading: “Find Local Services”.
- Short supporting line.
- Popular service categories with recognizable icons or real category illustrations.
- “Browse all services” action.
- A small number of nearby/recently active provider cards only when supported by bounded queries.
- “List your services” provider CTA.

Keep this separate from product listings and Store catalogue. Do not add a new bottom navigation tab until mobile navigation density is tested.

### Search page
- Search input: “Which service do you need?”
- Category selector.
- City/town and locality text selection.
- Optional “Use my location” with clear permission prompt and manual fallback.
- Filters: availability, service radius, experience and price guidance only when useful/comparable.
- Sort: relevance, recently active, most reviewed; rating alone must not determine all visibility.
- Results count, loading state, empty state and retry state.
- Paginated “Load more” or cursor-based continuation.

### Provider result card
- Profile image (or neutral fallback).
- Name and main service.
- Up to two additional service labels, then “+N more”.
- Locality / service area.
- Experience only when provided.
- Availability freshness.
- Review count and rating only when eligible feedback exists.
- “View profile” action; contact shortcuts only when the provider opted in.

## 5. Enquiry and review user journeys

### Customer enquiry
1. Customer opens provider profile.
2. Taps “Send enquiry”.
3. Selects one of that provider's services.
4. Adds short job description, optional preferred date/time and optional approximate locality.
5. Chooses an allowed reply route.
6. Signs in or creates an account if needed.
7. Trusted service creates a request ID and records customer/provider ownership.
8. Provider receives an enquiry and can respond.

Do not collect exact home address, sensitive access details or unnecessary personal data in the first enquiry form.

### Provider response
Suggested states:
- `new`
- `accepted`
- `declined`
- `in_progress`
- `completion_requested`
- `completed_confirmed`
- `disputed`
- `cancelled`

Only valid state transitions are allowed. The server must check actor identity, current state and allowed transition on every change. Keep a minimal append-only state history for support and audit.

### Completed-work review
- Provider marks work complete or requests completion confirmation.
- Customer confirms completion or disputes it.
- Only a customer who owns the enquiry can submit one completed-work review after the trusted completion rule is satisfied.
- Provider cannot review their own profile.
- A disputed or cancelled request cannot create a completed-work review.
- Review moderation/reporting is available.
- Contact-only feedback is separate and does not affect completed-work rating.
- A click on phone/WhatsApp is never treated as proof of completed work.

## 6. Provider dashboard

“My Services” should show:
- Profile preview and completion checklist.
- Edit profile.
- Manage multiple services.
- Manage portfolio photos.
- Update availability.
- Contact visibility settings.
- New / accepted / in-progress / completed enquiries.
- Feedback and report notifications.
- Share link and poster.
- Optional aggregate profile views/enquiries only after analytics privacy review.

Keep the dashboard task-oriented and avoid dense tables. Use simple cards, status labels and clear next actions.

## 7. Suggested starter service taxonomy

This is a starter taxonomy for validation, not a fixed or exhaustive list:
- Construction & repair: mason, carpenter, painter, tile worker, welder, waterproofing, civil repair.
- Electrical: electrician, wiring, inverter, solar installation/maintenance.
- Plumbing: plumber, water tank, pump, bathroom fittings.
- Appliance repair: AC, refrigerator, washing machine, TV, small appliances.
- Vehicle: mechanic, puncture/tyre, battery, towing.
- Home services: cleaning, pest control (subject to applicable compliance), gardening, packers/movers.
- Personal and professional services: tailor, beauty services, photographer, tutor, computer/mobile repair.
- Other local services: request a new category for review.

Taxonomy should support Gujarati and English display labels, stable internal IDs, synonyms and search terms. Avoid user-entered category strings becoming unmoderated public categories.

## 8. Data contract proposal (not final)

Potential logical records:
- **ProviderProfile**: owner UID, public name, profile/cover media references, public description, experience, languages, availability, city/locality/service areas, explicitly public contact preferences, lifecycle/moderation state, timestamps.
- **ProviderService**: provider UID, stable category ID, optional skill ID, display order, active flag.
- **ServiceEnquiry**: request ID, provider UID, customer UID, selected service, short job brief, preferred contact route, coarse location if needed, current state, timestamps.
- **EnquiryEvent**: request ID, actor UID, event type, previous/new state, timestamp, minimal support metadata.
- **ServiceReview**: request ID, customer UID, provider UID, review type, rating/text, moderation state, timestamps.
- **ServiceReport**: reporter UID, target provider/review/request, reason code, moderation state and audit timestamps.

Potential public/private split:
- Public profile view must be assembled from an explicit allowlist.
- Private contact fields, auth identifiers, enquiry descriptions, dispute details and report records must not be publicly queryable.
- Never return a raw Firestore document to public UI and hide private fields only with CSS.
- Public contact numbers are returned only if the provider has opted into that contact method.

The final Firestore document/subcollection structure, indexes, backend APIs, validation schema and security rules must be designed together. No schema changes are authorized by this proposal.

## 9. Interaction and error states

Every screen needs:
- Skeleton/loading state.
- No results / no profile yet state.
- Network failure and retry.
- Permission denied state with manual fallback.
- Invalid or unsupported image state.
- Save-in-progress and duplicate-submit protection.
- Clear validation messages next to the relevant field.
- Confirmation before destructive actions.
- Accessible focus order, labels and touch targets.
- Gujarati-first plain-language copy, with English/Hindi localization readiness.

## 10. MVP acceptance checklist

- [ ] Provider can create one profile with multiple services.
- [ ] Provider can add, reorder and remove portfolio photos.
- [ ] Provider chooses exactly which contact methods are public.
- [ ] Customer can browse and search by category and locality without granting location access.
- [ ] Near-me search is optional and has a manual fallback.
- [ ] Public profile displays only allowlisted public data.
- [ ] Provider can share/copy a stable profile link.
- [ ] Enquiry ownership and status transitions are trusted-server enforced.
- [ ] Completed-work reviews are restricted to eligible customer accounts.
- [ ] Contact feedback is not mixed with completed-work reviews.
- [ ] Search and review reads are bounded/paginated.
- [ ] Rules/backend tests cover unauthorized reads/writes, cross-user access, duplicate reviews and invalid transitions.
- [ ] No Production rules, migrations, deployments or paid integrations are changed without separate approval.
