# OLDX Service Providers — proposed data contract (review only)

Status: DESIGN DRAFT. This document does not enable Firestore access, deploy rules, or alter the live site.

## Goals
- A signed-in provider can maintain one public service profile with multiple service categories.
- Buyers can find providers by service and Gujarat city/town, view a shareable public profile, and contact providers only under their consent preferences.
- Only eligible buyers can submit reviews; administrators can moderate abuse.
- No client may assign itself admin privileges.

## Proposed collections
### serviceProviders/{uid}
Public, moderated fields: ownerUid (must equal uid), displayName, serviceIds (array of approved IDs; bounded), cityId, areaLabel, description (bounded), publicImagePaths (validated), status (pending|active|suspended), createdAt, updatedAt, ratingCount, ratingSum.
Do not include phone numbers, IP addresses, email addresses, exact home address, or other private information here.
Only trusted backend code may set status=active or suspended, ratingCount, ratingSum.

### serviceProviderPrivate/{uid}
Owner/admin-only: phoneE164, whatsappE164, allowPublicPhone (default false), allowWhatsapp (default false), privateAddress, verification metadata. Never expose this document in public queries. A public contact flow must use a trusted backend that checks consent and anti-abuse limits before returning permitted contact information.

### serviceProviderReviews/{reviewId}
providerUid, buyerUid, rating (integer 1–5), text (bounded), createdAt, status (pending|published|hidden). Only a verified eligible buyer can create one review per qualifying completed interaction; enforce this using a trusted backend and a stable interaction ID, not client-provided buyerUid alone. Buyers cannot edit rating aggregates or moderation state. Public reads only for published reviews.

### serviceProviderAudit/{eventId}
Server-only moderation and contact-consent audit events. No public reads or client writes.

## Security and validation requirements
1. Deny by default until a complete tested rule set and backend exist; do not copy this document as deployable rules.
2. Verify request.auth.uid for owner writes; whitelist editable fields and reject unexpected fields.
3. Enforce size/type bounds, approved service category IDs, timestamps, and immutable ownership.
4. Use server-side admin authorization (custom claims or a protected role source), not a client-supplied isAdmin field.
5. Do not publicly expose IP addresses; retain only for a legitimate limited admin/security purpose.
6. Use plain text rendering for user-provided content; prevent unsafe links and uploads.
7. Rate-limit profile creation, reviews, and contact actions; moderate abusive content.
8. Keep legacy products, stores, chat and admin behavior unchanged.
9. Review public contact consent separately from owner-only contact settings before shipping.

## Required tests before release
- Unauthenticated create/update/delete denied.
- Provider can update allowed own fields, not another provider's fields.
- Owner cannot self-approve, change rating aggregates, or assign admin role.
- Public cannot read private contact information or audit events.
- Review spam, self-review, duplicate review, and ineligible buyer review denied.
- Published-only review visibility and server-only moderation enforced.
- Multiple service categories searchable with validated index/query limits.
- Contact preferences default off; revocation takes effect.
- Existing store/product/chat tests pass; staging emulator tests pass before production deploy.

## Rollout
Design review → emulator rules and backend → staged UI integration → security regression tests → manual staging acceptance → explicit production release approval.
