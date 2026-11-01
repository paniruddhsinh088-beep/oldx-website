# Verified buyer reviews — secure data contract (design only)

**Status:** proposal. No production rules or review writes are enabled.

## Trust boundary
The client cannot prove a service was delivered. Never authorize a review from a
client-supplied `status: completed` object, a chat message, or a provider's claim.
The existing `canRequestServiceReview` helper only controls UI visibility.

## Collections

`serviceBookings/{bookingId}` — created and updated **only by trusted backend**:
- `buyerUid`: Firebase Auth UID of buyer
- `providerUid`: Firebase Auth UID of service provider
- `status`: `requested | accepted | completed | cancelled | disputed`
- `completedAt`: server timestamp, set only by trusted completion workflow
- `reviewEligible`: boolean, set only by trusted completion workflow
- `createdAt`, `updatedAt`: server timestamps
- `reviewedAt`: optional server timestamp, set by trusted review transaction

`serviceProviders/{providerUid}/reviews/{bookingId}` — review document ID equals booking ID:
- `bookingId`, `buyerUid`, `providerUid`
- `rating`: integer 1–5
- `comment`: trimmed string, maximum 500 characters
- `status`: `pending | published | rejected` (initially pending)
- `createdAt`, `updatedAt`: server timestamps

Do **not** use `reviewerUid` as the review document ID: a buyer may legitimately
have multiple completed bookings. One review per booking prevents duplicates.

## Authorization requirements
1. A verified signed-in buyer is required; no anonymous writes.
2. Buyer UID must equal booking buyerUid, provider UID must match booking providerUid,
   and buyer UID must differ from provider UID.
3. Booking must be completed, reviewEligible must be true, and completedAt must exist.
4. Review ID must equal booking ID; immutable ownership fields must match booking.
5. Create-only from buyer. No client update/delete, including moderation and rating edits.
6. Review publication and booking completion must be server-controlled. Do not let
   providers or buyers mark their own bookings completed.
7. Client may read only published reviews. Pending reviews should be visible only to
   appropriate authenticated participants if specifically required; default deny.
8. Booking reads should be limited to participants and authorized administrators.
9. The backend must prevent duplicate review creation atomically, e.g. a transaction
   that checks booking eligibility, creates review if absent, and marks booking reviewed.
10. Public profile ratings must be computed only from published reviews, not client-supplied totals.

## Proposed write flow
- Buyer clicks Review after trusted completion.
- Client calls authenticated backend endpoint with `bookingId`, rating, comment.
- Backend validates auth, ownership, booking completion, and content.
- Firestore transaction verifies no review exists, creates pending review, and
  marks booking reviewed.
- Moderation process publishes/rejects; public directory shows published only.

## Release blockers
- Choose and implement a trustworthy booking-completion/verification mechanism.
- Decide backend runtime and cost budget before selecting Cloud Functions or another
  privileged service. No privileged API keys or service-account credentials in frontend.
- Merge rules into the complete OLDX rules; do not replace them with an isolated draft.
- Emulator tests for forged completion, self-review, other-user review, duplicate
  booking review, pending-review visibility, and admin moderation.
- Only then enable review submission in the OLDX interface.

**Until these requirements are met, review submission remains disabled.**
