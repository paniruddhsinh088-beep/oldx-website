# Service Providers — implementation contract (draft)

This is an additive feature specification. No production rules or UI are changed by this document.

## Data
Collection: `serviceProviders/{uid}` (one provider profile per signed-in owner).
Fields: `ownerUid` (immutable, equal to document ID), `displayName`, `description`, `serviceCategories` (array of allowed category IDs; multiple supported), `city`, `district`, `state`, `photoUrl`, `createdAt`, `updatedAt`, `status` (pending/active/suspended).
Public profile should show only approved public fields; never expose email, phone number, IP address or private location by default. Contact actions require deliberate user interaction.

Collection: `serviceProviders/{uid}/reviews/{reviewerUid}`.
Fields: `reviewerUid` (immutable), `rating` (1–5 integer), `comment`, `createdAt`, `updatedAt`.
Only signed-in eligible buyers can review, not the provider. One review per buyer per provider. Eligibility must be verified using trusted transaction/interaction records, not merely client-provided flags.

## Security invariants
- Public can read active, approved profiles only; owners can read their own pending profiles.
- Only authenticated owner can create/edit their profile, with strict field and type validation.
- Clients cannot self-approve or modify `status`, `ownerUid`, counters, verification flags or moderation metadata.
- Admin permissions must be derived from trusted server-managed claims or documents, never from client-provided profile fields.
- Review authors can edit their own reviews subject to validation; no client can impersonate another reviewer.
- Do not deploy rules before comparing against existing Firestore rules and testing deny/allow cases in emulator.
- Do not add unbounded public listing queries or store precise GPS in public profile data.
- Image uploads need MIME/size checks, owner-only write authorization, moderation and storage-cost review.
- Blocked-user behavior and existing chats/products/stores must remain unchanged.

## UI plan
1. Service category discovery and city filters.
2. Create/edit profile with multiple categories.
3. Public shareable provider profile and social preview.
4. Call/chat/WhatsApp controls with existing guest restrictions.
5. Eligible buyer reviews and moderation.
6. Gujarati, English and Hindi labels; mobile-first, accessible layout.

## Release gates
- Inspect current Firestore rules and deployment configuration.
- Implement on `service-providers-development` only.
- Add unit/emulator tests for owner, guest, buyer, admin and malicious client.
- Check indexes, performance, image storage pricing and staging deployment.
- Merge only after tests and explicit release review.
