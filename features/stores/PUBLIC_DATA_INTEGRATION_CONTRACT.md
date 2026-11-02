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
   Store, order and filters. The executable draft covers unfiltered catalogue
   reads only. Any future category/availability/search/sort query requires its own
   tested cursor binding, query shape and index; client filtering of one server
   page must never be described as full-store search.
4. Future external cursors must be server-issued, bounded, validated and scoped;
   the draft's plain timestamp tuple is a synthetic test representation only.
   No arbitrary client query path, collection, status, offset or limit is accepted.
5. Project only `id`, `title`, `category`, numeric rounded `price`, formatted
   `priceLabel`, `available` for catalogue cards. Contact, exact coordinates,
   IP, arbitrary attributes/images, moderation notes and trust claims are absent.
   Locale controls interface text/number formatting; authored content is preserved.
6. Validate response schema and limits at the server. The executable draft fails
   the batch closed for mixed sellers, unpublished/malformed records or duplicates.
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
