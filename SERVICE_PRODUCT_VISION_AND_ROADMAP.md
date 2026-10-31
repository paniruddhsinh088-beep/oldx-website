# OldX Service — Product Vision & Delivery Roadmap

**Branch:** `security-hardening-review`  
**Status:** Product planning and source audit; no Service feature implementation or deployment in this document.  
**Purpose:** Help local service professionals create attractive, shareable profiles and help customers find and contact suitable providers with confidence.

## 1. Product vision

OldX Service should work like a lightweight professional mini-website for each local service provider, similar in quality and simplicity to OldX Store.

A carpenter, mason, plumber, electrician, painter, appliance repairer or other local professional should be able to:
1. Create one provider profile using their OldX account.
2. Add multiple services to the same profile.
3. Describe skills, experience, service areas, availability and optional price guidance.
4. Add genuine work photos (and later, carefully bounded video support if justified).
5. Share a permanent profile link or branded share poster.
6. Receive customer enquiries and respond through OldX Message, phone or WhatsApp.

Customers should be able to search by service, city/town/locality and (with permission) distance; compare profiles and work examples; read meaningful feedback; and contact the provider directly.

The first version should be free to join and should connect customers and providers. OldX should not initially collect service payments, guarantee workmanship, or take commission.

## 2. Provider profile content

### Essential fields
- Display name / professional or business name.
- Profile photo and optional cover photo.
- One or more service categories and specific skills.
- Short introduction / description.
- Experience duration (optional if unknown).
- City/town and service localities; optional service radius.
- Preferred contact methods: OldX Message, phone and WhatsApp (provider opt-in).
- Availability status: Available, Busy / temporarily unavailable.
- Work portfolio photos.
- Languages spoken (optional).

### Optional fields
- Starting price or indicative price range, with unit/context (for example, per visit, per hour or “quote after inspection”); never imply a guaranteed quote.
- Working hours / days.
- Emergency or same-day service (only if provider selects it).
- Warranty / workmanship commitment and its conditions (only if provider supplies explicit terms).
- Qualifications, licences or certificates (do not display as verified unless a real review process exists).

### Onboarding principles
- Keep first profile creation short: name, at least one service, city/area, one contact method.
- Let providers save a basic profile and complete photos/experience/pricing later.
- Use clear Gujarati/Hindi/English labels and examples.
- Support multiple services in one profile; do not force duplicate profiles for one person.
- Show photo guidance and preview before saving.
- Never insert stock/generated photos as if they were the provider's actual work.

## 3. Customer discovery and profile experience

### Search and filters
- Service category and specific service/skill.
- City/town and locality.
- “Near me” only after explicit location permission; always retain manual city/locality search.
- Distance / service radius when reliable coordinates exist.
- Availability.
- Experience range.
- Indicative price range where providers supplied comparable information.
- Rating / review count, with new providers still discoverable (do not rank only by rating).

### Search result card
Show a clear photo, provider name, main service(s), locality, experience (if provided), availability, rating and review count, plus a direct profile action. Keep call/contact actions accessible but avoid exposing phone numbers in the card unless the provider opted in.

### Provider profile page
A mobile-first mini-site with:
- Cover / profile image and name.
- Main service tags and service area.
- Availability and experience.
- Short introduction.
- Work photo gallery.
- Optional indicative prices and working hours.
- Review summary and review list.
- Prominent Call, WhatsApp and OldX Message actions based on provider consent.
- Share profile, copy link and share poster actions.
- Report profile action.

### Shareability
Each provider should have a stable, human-friendly share link and poster containing the real provider photo, name, services, service area and QR/link. The share sheet should degrade gracefully: share image when supported, otherwise offer image download and copy-link options.

The current site uses client-side hash navigation. Social platforms generally need server-rendered metadata to create reliable link previews. A dynamic crawlable route and Open Graph image/metadata are a separate hosting/backend decision; do not claim that changing share text alone solves previews.

## 4. Enquiries and trustworthy feedback

### Enquiry model
- A signed-in customer can create an enquiry from a provider profile, selecting the service and entering a short description and preferred contact method.
- Generate a unique enquiry/request ID.
- The provider can accept, decline, mark in progress, or indicate completion.
- The customer can confirm completion or report that the work did not happen / is disputed.
- Phone and WhatsApp remain optional direct-contact routes; an external call or WhatsApp click is not proof that a job was completed.

### Review types
1. **Completed-work review:** only eligible after a recorded enquiry and a completion confirmation flow. Clearly label it as a completed-work review.
2. **Contact feedback:** optional, separately labelled feedback about responsiveness/contact, not counted as completed work.

### Anti-abuse requirements
- One completed-work review per eligible enquiry.
- Only the customer account associated with the enquiry can submit that review.
- Provider cannot review their own profile.
- Prevent duplicate submissions and edits that bypass moderation.
- Provide report / moderation handling and an audit trail.
- Do not treat client-side flags or a simple button click as proof.
- If provider and customer disagree about completion, do not issue a verified-work badge automatically; keep the state disputed/pending resolution.
- Do not show a “verified provider” badge without a separately approved identity/business verification process.

A customer who only called or used WhatsApp cannot automatically receive a completed-work review entitlement. We must explain this limitation clearly in the UI.

## 5. Navigation and placement

- Add a clear **Services** entry alongside the existing Store discovery, not buried in account settings.
- Homepage: a dedicated “Find Local Services” section with popular service categories and local provider cards.
- Keep “Create Service Profile” / “List Your Services” as a clear provider CTA.
- Add Service to the existing navigation/account area only after auditing mobile layout and current navigation behavior.
- Keep Store and Service distinct: Store is for products/catalogues; Service is for people/professionals and their work.
- Avoid duplicating the existing product search or featured-products section.

## 6. Provider dashboard

A simple “My Services” area should allow the provider to:
- Create/edit one profile and manage multiple service tags.
- Add, reorder and remove portfolio photos.
- Update service areas and contact preferences.
- Change availability.
- View and respond to enquiries.
- View completed-work and contact feedback separately.
- Copy/share the profile link and create a poster.
- See privacy-conscious aggregate profile views and contact/enquiry counts only after analytics policy is approved.

## 7. Data, privacy, security and performance constraints

This is a planning document, not an approved Firestore schema or permission policy.

Before implementing live writes or public search, inspect the deployed Firestore Rules and current Auth/profile model. There is no confirmed production-ready Firestore Rules implementation in this review branch. Do not enable public writes or rely on client-side checks for ownership, enquiry status, review eligibility, moderation or badges.

Design principles:
- Separate intentionally public profile fields from private account/contact and operational fields.
- Public phone/WhatsApp visibility must be an explicit provider choice.
- Do not expose exact home coordinates by default; use city/locality/service areas or approximate location.
- Keep internal enquiry details private to the customer, provider and authorized support.
- Validate ownership, allowed fields, state transitions, rate limits and review eligibility on a trusted backend before launch.
- Use bounded queries, pagination and appropriate indexes; never load every provider or review into the browser.
- Validate and moderate uploaded media on a trusted pipeline; browser-side size/type checks are usability only.
- Avoid collecting private chat content for service analytics or moderation.
- Define report handling, retention, deletion and appeal processes before launching moderation workflows.
- No new paid services, external integrations, Firestore/Storage Rules publication, migrations or Production changes without owner approval.

Potential data concepts (not final collection names or fields): provider profile, provider services, service enquiry, enquiry state history, customer review, profile report, and aggregate public discovery metadata. Choose document vs subcollection layout only after query patterns, security rules and index costs are reviewed.

## 8. Delivery phases

### Phase 0 — source and architecture audit (current)
- Map existing authentication, account/profile, navigation, messaging and Store patterns.
- Inspect current Firestore reads/writes and deployed rules status where authorized.
- Identify safe public profile fields and private data boundaries.
- Define profile, search, enquiry and review state diagrams.
- Prepare an implementation plan and test matrix without changing production data.

### Phase 1 — profile and discovery MVP
- Provider profile onboarding and edit.
- Multiple services per provider.
- Service categories and location/service-area fields.
- Public profile page and share/copy-link UX.
- Basic bounded search and category/locality filters.
- Call / WhatsApp / OldX Message actions controlled by provider preferences.
- No completed-work review claims until trusted enquiry flow exists.

### Phase 2 — enquiries and feedback
- Trusted enquiry creation and state transitions.
- Completion confirmation and disputed state.
- Completed-work reviews and separate contact feedback.
- Duplicate prevention, report flow and moderation controls.
- Security and emulator tests for every ownership/state transition.

### Phase 3 — growth and provider tools
- Provider dashboard and enquiry inbox.
- Portfolio improvements and share poster.
- Near-me search with permission and manual fallback.
- Availability and practical filters.
- Performance, pagination and accessibility refinements.

### Phase 4 — trusted previews and insights
- Crawlable provider URLs and server-generated social metadata.
- QR/share poster refinements.
- Privacy-reviewed aggregate analytics.
- Optional provider verification only after evidence, policy, expiry, appeal and audit requirements are approved.

## 9. Acceptance criteria for a real launch

- A provider can create and edit one profile with multiple services on a mobile phone.
- A customer can find providers by category and locality without granting location permission.
- Near-me is optional and has a manual fallback.
- Profile and portfolio content render safely (no untrusted HTML injection).
- Only intentionally public fields are visible to unauthenticated visitors.
- Contact choices respect provider consent.
- Enquiries and review eligibility are enforced by trusted server-side authorization, not client flags.
- One enquiry cannot produce duplicate completed-work reviews.
- Pagination / bounded queries prevent unbounded reads.
- Share links have a graceful fallback; social preview support is tested separately.
- Emulator/source tests pass and no production deployment is implied by preview CI.

## 10. Decisions intentionally deferred

- Final Firestore collection names, document layout and indexes.
- Trusted backend platform/runtime, region, IAM and billing.
- Exact provider identity verification policy.
- Whether photo storage remains on current provider or moves to Firebase Storage.
- Review dispute and moderation service levels.
- Whether any paid promotion or subscription is ever introduced.
- Crawlable URL / server-rendered metadata architecture.
- Analytics events, aggregation and retention.

These must be proposed with impact and cost before implementation.