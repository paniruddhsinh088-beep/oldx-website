# OldX Service — Storage-Independent MVP Scope

**Branch:** `security-hardening-review`  
**Status:** Planning document only. No application code, Firebase configuration, Rules, Storage, billing, data, or deployment changed.

## 1. Decision

Do not upgrade the Firebase plan solely to start the Service feature. First prepare and validate the parts that do not require file storage. Treat Firebase Storage as unavailable until its plan, bucket configuration, pricing and security requirements are confirmed by the project owner.

A Storage upgrade is not a prerequisite for designing the Service feature or for a text-only prototype. It is a prerequisite only for a Service implementation that depends on Firebase Storage uploads.

## 2. Storage-independent scope

The first product slice can be designed and usability-tested without provider photo uploads:

- Public provider display name or business name.
- Multiple services/skills under one provider profile.
- City, locality and provider-selected service area.
- Short provider-written introduction.
- Experience, languages and availability when supplied.
- Optional indicative price with clear unit/context.
- Separate, explicit consent for public phone and WhatsApp display.
- Search and filters using category, service, city/locality and availability.
- Text-based provider cards and profile pages with neutral category icons or initials.
- Profile sharing through a URL once a safe public route exists.
- Provider onboarding preview, validation messages and dashboard empty states.

Any sample provider shown in a prototype must be clearly labelled as demo data. Do not present generated, stock or placeholder imagery as a real provider or real completed work.

## 3. Explicitly out of scope until a secure media path exists

- Provider portfolio/photo uploads.
- Customer job-photo uploads.
- Public media galleries.
- Uploading documents or certificates.
- Reusing the existing Store's unsigned Cloudinary upload flow without a separate security review.
- Any claim that a provider's work, qualification or identity has been photo-verified.

If a neutral avatar or category icon is used, it must be visibly generic and must not imply a real person, business or completed job.

## 4. Backend and Firebase gate remains unchanged

Storage independence does not make live Firestore writes safe. Before any live Service profile, enquiry or review is enabled:

1. Review the exact currently published `oldx-staging` Firestore Rules and relevant project metadata.
2. Confirm the Staging project ID and environment isolation.
3. Approve the final public/private data contract and trusted backend approach.
4. Implement server-side ownership, validation, rate limits and state transitions.
5. Add authorization tests for public reads, private records, enquiries, reviews and moderation.
6. Run the approved Staging integration tests before considering a release.

The supplied Firestore rule is deny-all. It is a safe closed baseline, not a usable OldX application policy. Do not replace it with permissive rules merely to make the UI work.

## 5. Media options to evaluate later

When media becomes a real product requirement, compare these options before choosing or paying:

- Firebase Storage on an approved billing plan, with authenticated upload authorization, strict object ownership, size/type limits, moderation and deletion lifecycle.
- A separately approved managed media provider, but only after reviewing signed uploads, access controls, moderation, retention, cost and account ownership.

Do not choose an option based only on free-tier availability. Include expected monthly storage, bandwidth/download volume, image processing, abuse controls and operational effort in the comparison. No plan upgrade or paid integration is authorized by this document.

## 6. Acceptance criteria for the no-Storage slice

- Core discovery and profile layouts remain usable without uploaded images.
- Multiple services can be displayed clearly on one provider profile.
- Contact visibility is opt-in and independent for phone and WhatsApp.
- No dead upload controls or false “upload successful” messages appear.
- Demo content is isolated from real user data and clearly labelled.
- Mobile layout, keyboard navigation, loading, empty, error and retry states are reviewed.
- No live Firestore reads/writes, public profile publishing or enquiry/review actions are enabled before the backend gate is passed.

## 7. Approval boundary

This document authorizes no Firebase plan upgrade, billing change, third-party integration, Rules publication, schema migration, backend provisioning, Staging data change, Production change or deployment. Those require a separate proposal and explicit owner approval.
