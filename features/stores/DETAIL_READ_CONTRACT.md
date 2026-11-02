# Inactive synthetic Store product-detail read contract

`preview-detail.mjs` is a pure synthetic plan/projection module. The isolated
preview's mock adapter implements it with authored fixtures only. It is not an
approved backend, public schema, authorization decision or SDK query. Nothing
reads live Firebase, changes Rules/indexes or publishes a real Store/product.

## Bounded identity and publication contract

`planSyntheticDetailRead` accepts exactly `storeUid` and `productId`, each an
ASCII ID of 1–128 letters/digits/underscores/hyphens. It rejects arbitrary paths,
collection/provider overrides, pagination knobs and client publication grants.
The plan allows one logical Store document and one listing document per trusted
attempt. It does not choose a collection or hosting provider. A real transaction
could retry; these bounds are not an approved cost or retry policy.

The mock detail adapter selects the requested sample directly, not from a page
of catalogue results. Responses contain `{status, store, listing}` only. The
Store must independently match the requested ID and immutable seller association,
and explicitly be published. The listing must independently match the requested
product ID, belong to that seller and explicitly be published. A successful old
catalogue response is never a substitute for these detail checks.

Removed Store/listing and recognized draft/pending/unpublished/suspended/deleted
states map to one unavailable result with no fields. Malformed responses,
identity/ownership mismatch, missing publication, bad text/price/timestamp or
invalid scope fail closed with no snapshot. The UI does not show raw adapter
errors. Internal invalid-response vs unavailable states are synthetic diagnostics;
a real public endpoint must define uniform non-enumerating error semantics.

Successful projection copies/freezes only the Store's ID/name/city/description
and the existing public product card's ID/title/category/rounded numeric price,
price label and availability. No owner identity field, phone, email, coordinates,
IP, arbitrary attributes/media, moderation notes or trust claims are forwarded.
Synthetic `storeUid` follows the existing seller UID association, not an approved
slug or a new migration. User-authored content is preserved; locale switching
formats numeric price and interface copy without repeating a detail read.

## Shared preview lifecycle

Catalogue and detail share the existing request controller, deadline, cancellation,
revision gating, clear/revoke, page-cache invalidation and focus handling. Only
read/projection functions are selected by the validated local route. Navigating
between products or returning through history triggers a new detail read. Prior
headers, cards, links and detail fields clear immediately, including on failure,
unavailability and timeout. A late earlier result cannot restore another product.
The renderer uses the accepted detail DTO, never a 24-item catalogue lookup.

Tests cover invalid IDs, malformed payloads, Store/listing withdrawal independently,
seller/request identity mismatch, private field exclusion, removed products,
late/out-of-order completion, cancellation, timeout/retry, history, keyboard focus
and gu/hi/en unavailable text at 320px/200% computed font sizes. These are pure
and offline browser tests, not actual Rules or trusted endpoint validation.

## Required approvals before real integration

- D1–D12/backend/provider/schema decisions and immutable Store/seller resolution
  must be approved. Client-provided IDs/statuses/seller claims are never authority.
- Define server-controlled publication, consent, validation, suspension, deletion,
  media/contact policy and strict public/private separation. Never send private
  legacy documents to a browser to redact later.
- Recheck Store and listing together with approved consistency/revocation freshness;
  define transaction/read semantics, cache TTL, deadlines and retry bounds. Two
  independently read documents can change between reads. Synthetic DTO checks do
  not prove freshness or atomicity, and cannot erase data already seen.
- Preserve the approved bounded/scoped catalogue query and cursor contract. Detail
  gets must not fall back to a collection scan or cached catalogue card. Direct
  approved document reads do not require a catalogue composite index; any slug
  resolver or alternate query needs its own bounded shape, index and scope tests.
- Actual isolated Rules Emulator tests must cover guest/seller A/seller B/moderator,
  direct detail gets and lists, private/legacy access denial, withdrawn Store or
  listing, ownership mutation, query constraints and revocation between reads.
- Require compatibility/migration, rollback and real browser cache/freshness
  evidence before changing clients. Rules cannot redact fields from a document.
  Keep live deny-all and all deployment/production gates untouched.

## Cancellation settlement follow-up

The shared controller now also settles a cancelled request's caller promptly,
even if the mock ignores AbortSignal. Clear, withdrawal and replacement invalidate
its revision before signalling cancellation. The request race keeps handlers for
late adapter resolution/rejection and unregisters its cancellation listener on
settlement. This is client lifecycle cleanup, not a claim that an uncooperative
remote operation has stopped. A future real adapter still needs approved server
request deadlines and cancellation/retry limits.
