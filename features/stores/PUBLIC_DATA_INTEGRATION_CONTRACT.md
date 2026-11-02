# Store public-data integration — inactive review contract

No real-data adapter is connected or authorized. The offline preview reads
synthetic fixtures only. `public-data-contract.mjs` is deliberately excluded from
the browser asset manifest. Its pure tests describe a candidate server boundary;
they do not prove security Rules, publication authorization or deployment.

## Existing decisions to preserve

Follow `PRODUCTS_PUBLIC_PRIVATE_MIGRATION_PLAN.md`,
`PRODUCT_CATEGORY_AND_PUBLIC_ATTRIBUTES_SCHEMA_V1.md`,
`STAGING_BACKEND_OWNER_APPROVAL_REGISTER.md` and
`SECURITY_AUDIT_AND_RELEASE_READINESS.md`. D1–D12 remain unresolved. The candidate
`publicProducts` split and `publicationStatus` schema are proposals, not permission
to change the legacy collection, migrations or live Rules. No remote backend,
provider, image pipeline or publication policy has been selected by this work.

## Trusted read boundary

1. Resolve an approved public Store to its immutable seller association at a
   trusted server. A browser-supplied owner UID or verification claim is not an
   authorization grant. Reject unpublished, suspended, deleted and missing Stores
   uniformly, and clear stale client catalogue/detail state.
2. Query only an approved sanitized `publicProducts` boundary with exact seller
   equality and the candidate `publicationStatus == published` predicate. Never
   read legacy `products` or `privateProductData` into a public browser and redact
   afterward. Firestore Rules authorize documents; they cannot hide fields.
3. Enforce page size 1–24, fetch at most size+1, order by trusted `createdAt desc`
   and document ID ascending, preserve nanosecond precision, and bind cursors to
   Store, order and filters. The executable draft covers newest-order reads with an optional known category
   predicate and strict availability predicate (`isSold == false`). These filters
   are part of the trusted query, never post-pagination client filtering. Full-store
   search, price/name/availability sorting and unknown filter keys fail closed;
   each needs a separately reviewed query/index/cursor contract. The offline UI's
   extra sort modes operate only on the complete synthetic batch.
4. Future external cursors must be server-issued, bounded, validated and scoped;
   the draft's version-1 timestamp tuple is a synthetic test representation only.
   It binds seller, category, availability and the fixed `newest` order. Reject a
   cursor when any bound filter changes and restart from the first page. A locale
   change does not alter query membership. The response emits `nextCursor` only
   with lookahead, anchored to the last returned card (not the lookahead record).
   Preserve timestamp nanoseconds and ID tie ordering; no offset scans.
   No arbitrary client query path, collection, status, offset or limit is accepted.
5. Project only `id`, `title`, `category`, numeric rounded `price`, formatted
   `priceLabel`, `available` for catalogue cards. Contact, exact coordinates,
   IP, arbitrary attributes/images, moderation notes and trust claims are absent.
   Locale controls interface text/number formatting; authored content is preserved.
6. Validate response schema and limits at the server. The executable draft fails
   the batch closed for mixed sellers, unpublished/malformed records, duplicates,
   mismatched filters, unsorted input or records at/before the cursor. Every record,
   including lookahead, must satisfy publication; suspension/deletion between
   pages yields an error with no cards or cursor. An empty fresh response has no
   continuation cursor. This does not retroactively erase an earlier client cache:
   clients must discard stale responses and honor the approved revocation policy.
   Recheck publication/detail access on every read; expired cached public data
   must not resurrect withdrawn listings. Define freshness/revocation guarantees
   before activation. Do not log response bodies or private/raw input.

The offline preview's page number and `hasMoreInBatch` describe only its 13-item
sample batch. The draft server response's `hasMore` assumes a trusted limit+1
query; neither is evidence of a live exhaustive catalogue. Future media and
contact each require separate approved public policies and trusted resolution.

## Publication and Rules requirements before approval

- Define who can publish, required seller consent, allowed public fields,
  validation, suspension/unpublish behavior, retention and moderation appeals.
  Legacy migration starts `pending_review` and must never grant publication.
- Public readers may access only sanitized published documents belonging to a
  public Store. Deny legacy/private data, drafts, pending, suspended and deleted
  records; list constraints must match Rules (Rules are not query filters).
- Seller writes require server-trusted identity; forbid ownership/timestamp
  mutation and client publication, featured/verified or moderation grants.
  Ordinary fields and stock changes need strict schema and update allowlists.
- Test guest, seller A/B and moderator roles; direct get and bounded list;
  forged identities/cursors, private extra fields, unpublished Store/listings,
  revocation between pages, malformed/oversized records and missing indexes.
- Test compatibility for My Ads, edits/stock, product detail, search, chat/contact,
  migration retry/rollback and account deletion before switching clients.
- Require actual isolated Rules Emulator evidence plus owner approval of schema,
  indexes, backend/provider, rollout and rollback. Keep live deny-all untouched.

No Rules or indexes are changed by this contract. Deployment, live reads and
migration remain separate owner approval gates.


## Required future index and cursor validation matrix

| Candidate query | Equality predicates before newest order | Status |
| --- | --- | --- |
| Default | sellerUid, publicationStatus | Draft only |
| Category | sellerUid, publicationStatus, category | Draft only |
| Available | sellerUid, publicationStatus, isSold | Draft only |
| Category + available | sellerUid, publicationStatus, category, isSold | Draft only |

All four use `createdAt desc`, document ID ascending and limit 1–24 plus one
lookahead. Actual index definitions must be verified in isolated tests after
schema approval; no index is created here. Cursors are not an authorization
capability or a guaranteed snapshot. Concurrent stock/publication changes can
alter query membership; server reads must revalidate Store publication and clients
must reset query state/discard stale cards on revocation or scope changes.

Pure contract regressions cover filter changes, unsupported sorts/search,
lookahead anchoring, equal timestamps/nanosecond differences, cross-store replay,
unknown cursor versions, unsorted/replayed rows and publication withdrawn between
pages. They do not replace guest/seller/moderator Rules Emulator or real adapter
query tests. The contract is not included in browser packaging.

## Asynchronous client lifecycle — synthetic evidence only

The offline preview now uses `preview-load.mjs` and `preview-adapter.mjs`. The
adapter returns an in-memory, bounded sample snapshot only; filters and page
numbers still operate on that complete sample batch. This is not the trusted
cursor query adapter described above. No network/SDK/provider selector is added.

Each new read increments a request revision, aborts the previous read where
supported, immediately discards all accepted cards/header/detail state and
announces loading. Completion is accepted only for the active revision, even if
an adapter ignores cancellation. Route, seller, search, category, availability,
sort, page and retry changes invalidate old reads; locale changes only reformat
the currently accepted state and never start another read. Unknown routes and
explicit withdrawal cancel the active revision. History navigation re-reads
rather than restoring cached publication claims.

Only validated, explicitly projected public sample fields reach display state.
Snapshots are copied/frozen so later mutation of a mock payload cannot alter an
accepted view. Failure/invalid/withdrawn responses remove prior card and detail
state, disable paging and expose localized recovery; raw adapter errors are not
rendered or logged. Focus moves after keyboard navigation only if the user has
not moved focus while waiting. Query controls remain usable while loading.

Before real integration, define trusted revocation events, cache TTL/revalidation,
request deadlines, authentication and Store/listing publication checks. A client
revision is not authorization or a server snapshot guarantee. Data already seen
by a visitor cannot be retroactively erased. Never trust a browser's sample
`published`/`revoked` value, and never fetch private legacy rows to redact later.
Server-issued cursor scope, index verification, publication consent, strict
Rules tests and D1–D12 approvals remain mandatory. Late requests must not restore
withdrawn data after an explicit revocation event or a newer query scope.

Synthetic snapshots require every sample listing to be explicitly marked
`published`. Missing, pending or suspended markers fail the whole snapshot closed,
including when a product detail was previously visible. A fresh accepted snapshot
without that product shows not-found and clears detail fields. These markers are
mock inputs only, never a replacement for server-controlled publication or Rules.
