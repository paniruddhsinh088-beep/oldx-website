# OldX Service — Backend Architecture & Approval Gate

**Status:** Proposal only. No backend, database, Rules, indexes, IAM, billing, Storage, Staging or Production settings changed.
**Branch:** `security-hardening-review`

## 1. Executive recommendation

Keep the current Service prototype isolated until a trusted backend and data-access boundary are approved. For the first live MVP, use a small Firebase-native backend only if the existing project, billing account, region availability and operational ownership are confirmed:

- Firebase Cloud Functions (2nd generation) / Google Cloud Functions as the trusted API layer, using the Firebase Admin SDK only on the server.
- Firestore for provider profiles, private provider settings, service requests and review records.
- Firebase Authentication for account identity; the backend derives the caller UID from a verified token and never trusts a UID supplied in request data.
- Firestore Rules deny direct client writes to protected Service records. Public profile reads are restricted to a dedicated allowlisted public projection.
- No payment, commission, live chat bridge, public phone number or portfolio upload in the first backend slice unless separately approved.

**Region:** Mumbai (`asia-south1`) is the initial region to evaluate for latency to India, not a final selection. Confirm current project region constraints, function availability, data residency expectations, latency, pricing and existing Firebase resources before provisioning anything.

If the current Firebase project is not suitable, stop and compare a separate Staging project/backend rather than changing Production.

## 2. Proposed logical data boundaries (not final Firestore schema)

| Logical record | Purpose | Access boundary |
|---|---|---|
| Public provider profile | Public name, selected services, city/locality, optional experience/about, availability, explicitly public portfolio references | Public read of allowlisted fields only; trusted backend creates/updates |
| Private provider profile | Owner UID, private phone/WhatsApp values, contact-consent flags, moderation and operational metadata | Owner and authorized support/backend only |
| Service request | Customer UID, provider reference, selected service, job description, approximate area, preferred contact route, timestamps and state | Requesting customer, selected provider and authorized support/backend |
| Review | Public rating/comment projection plus private request linkage and moderation metadata | Public read only after eligibility/moderation; create through trusted backend only |
| Reports / moderation cases | Abuse reports, dispute and moderation actions | Restricted support/backend access |

Use a stable opaque public provider ID distinct from the Firebase Auth UID. Never expose private provider fields in the public profile document. Do not store exact home coordinates as a default.

A provider has one profile with an array/list of multiple selected services. Search design must be validated against Firestore query capabilities and index limits before committing to the final schema.

## 3. Trusted API responsibilities

Proposed callable or authenticated HTTPS endpoints (exact transport to be selected during implementation):

1. Create/update provider profile: verify owner; validate allowed fields and lengths; normalize service taxonomy and locality; enforce contact opt-in.
2. Publish/unpublish profile: enforce moderation and profile completeness; public projection contains only approved fields.
3. Search public providers: validate filters, page size and cursor; return only public projection; rate-limit abusive search.
4. Create service request: derive customer UID from auth; validate provider/service; prevent malformed or excessive requests; return stable request ID.
5. Provider responds: only the selected provider may accept/decline or update allowed states.
6. Completion confirmation: customer and provider confirmations are recorded separately; disputed/cancelled requests cannot become review-eligible automatically.
7. Submit review: verify requester owns the eligible completed request; enforce one review per request; sanitize and moderate content; never trust client-supplied rating eligibility.
8. Report profile/review/request: record a restricted report for moderation.

Use idempotency keys for request creation and review submission where retries could create duplicates. Apply server-side rate limits and audit privileged actions without collecting private message content.

## 4. Enquiry and review state model

Suggested request states:
- `submitted`
- `accepted` or `declined`
- `in_progress`
- `completion_pending`
- `completed` only after the defined confirmation rule
- `cancelled` or `disputed`

A call or WhatsApp click is not proof of work completion. Contact-only feedback is separate and never contributes to completed-work ratings. One eligible review per request; no provider self-review; no reviews from cancelled or unresolved disputed requests. The exact dispute window and support override process must be agreed before launch.

## 5. Public/private field policy

Public only when explicitly selected and approved:
- Display name / business name
- Service categories and skills
- City, locality and provider-selected service area
- Provider-written introduction and experience
- Availability and provider-supplied indicative price, with clear labels
- Portfolio media references after upload moderation
- Phone and WhatsApp only through separate explicit opt-ins

Private:
- Auth UID and account email
- Private phone/WhatsApp when not opted into public display
- Exact address and precise coordinates
- Customer identity and enquiry details
- Moderation, abuse, dispute and internal support metadata
- Internal verification flags and security/audit metadata

Never describe experience, qualifications, prices or warranties as OldX-verified unless a separate verification process is actually implemented.

## 6. Media upload proposal

Do not reuse the Store's current unsigned Cloudinary flow by assumption. Before portfolio uploads:
- Select and approve a trusted upload path (for example, authenticated backend-issued upload authorization or Firebase Storage with strict object ownership rules).
- Enforce MIME/type, file size, image dimensions, count and rate limits on trusted infrastructure.
- Define malware/content moderation, removal, retention, orphan cleanup and account-deletion behavior.
- Store only approved media references in public profiles.
- Keep upload disabled until Rules and backend tests prove that one provider cannot overwrite or read another provider's private files.

## 7. Search, indexes and performance

- Search must be server-bounded or use carefully reviewed Firestore queries with explicit page size and cursor.
- No full collection download or client-side scan of all providers/reviews.
- Validate service + city/locality combinations and composite index requirements using representative test data.
- Do not sort by rating alone; include relevance and recency, and avoid implying trust from a small number of reviews.
- Add abuse controls for broad searches and repeated enquiry creation.
- Confirm index deployment is part of an approved release plan.

## 8. Privacy, retention and account lifecycle

Before launch, define:
- What customer/provider data is collected and why.
- Retention periods for enquiries, reviews, reports and audit records.
- User access, correction, deletion and support workflows.
- What happens to a review when a profile is deleted or suspended.
- Account deletion behavior for provider profiles, requests, media and legal/support records.
- Consent wording and contact visibility defaults.
- A privacy notice and abuse-report response process.

Do not silently delete records needed for an active dispute or abuse investigation; define a restricted retention policy with legal/product review.

## 9. Security and test gates

Before enabling any live Service writes:
- Inspect actual deployed Staging Firestore and Storage Rules/configuration (read-only first).
- Confirm Firebase project IDs, region, billing and IAM ownership.
- Implement deny-by-default Rules for Service private data and direct client writes.
- Add emulator tests for guest public reads, owner-only edits, private field isolation, request ownership, valid transitions, duplicate submissions, review eligibility, cross-account access and Storage object isolation.
- Add server-side validation, rate limiting, abuse reporting and moderation.
- Run staging end-to-end tests with test accounts and synthetic data.
- Review logs to ensure secrets, phone numbers and enquiry bodies are not leaked.
- Obtain explicit approval before deploying Rules, indexes, backend functions or any Production configuration.

Existing deny-all emulator fixtures are useful safety baselines but are not a deployable OldX authorization policy.

## 10. Frontend prototype review findings

- The current standalone preview is correctly labelled as demo-only and does not read or write Firestore.
- Phone and WhatsApp consent toggles default off.
- Provider card rendering currently uses `innerHTML` with hard-coded demo records. This is acceptable only while those values remain fixed local constants; before any API/Firestore data is connected, replace it with DOM construction and `textContent` (or a rigorously tested escaping layer) to prevent stored/reflected XSS.
- The current prototype does not save profiles, send enquiries, contact real providers or create reviews. Do not enable fake success states.
- UI behavior has passed the repository's local safety/emulator CI workflow, but no real Android device/browser visual test is claimed.

## 11. Approval required before backend-connected work

Please review and explicitly approve or request changes to these decisions:

1. Use Firebase-native trusted backend (2nd-generation Functions + Admin SDK) if existing project checks pass.
2. Evaluate Mumbai `asia-south1` as the initial region, subject to project, availability, cost and privacy review.
3. Keep Service profile writes, enquiries and reviews server-mediated; no direct browser writes to protected collections.
4. Keep public and private provider data in separate access boundaries.
5. Keep portfolio uploads, OldX chat bridge, payments and public phone display out of the first live slice until separately approved.
6. Permit read-only inspection of the actual Staging Firebase configuration and deployed Rules as the next investigation step. This does not authorize changes or deployment.

**No implementation or cloud configuration change is authorized by this proposal itself.**
