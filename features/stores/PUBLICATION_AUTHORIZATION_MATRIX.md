# Proposed public-detail authorization matrix — inactive

`testing/publication-fixtures.mjs` and `publication-matrix.test.mjs` are synthetic
test inputs/expectations, excluded from browser packaging. They are not a role
middleware, deployed policy, approved schema or Firebase Rules enforcement.

| Proposed caller | Published, correctly associated public detail | Withdrawn Store/listing | Private seller fields via public detail | Admin/legacy selector via public detail |
| --- | --- | --- | --- | --- |
| Guest | Public allowlist only | Unavailable | Deny | Deny |
| Seller | Public allowlist only | Unavailable | Deny | Deny |
| Other seller | Public allowlist only | Unavailable | Deny | Deny |
| Moderator | Public allowlist only | Unavailable | Deny | Deny |

Roles deliberately do not reach the public DTO projector. Client role claims and
private/admin/legacy selectors are rejected by its request schema; this proves
schema/projection behavior only. The owner or moderator may eventually have a
separate authenticated private/privileged endpoint, subject to approved policy,
server token/role/ownership verification and audit. This table does not deny or
grant such future endpoints. A public listing belonging to seller A remains a
public listing for seller B; a response incorrectly associating it with B's Store
is invalid for every caller. No caller bypasses publication on this public path.

The 28 public cases cross four caller labels with seven publication scenarios.
Twelve denied-surface fixtures cross those labels with private seller, admin and
legacy selectors. Tests assert exact public Store/card fields, no private data,
malformed IDs/role overrides, cursor-to-detail revalidation, removed products,
seller mismatch and Store/listing publication changes after catalogue access.

## Cross-document consistency limitation and required evidence

The deterministic timeline is catalogue → Store read → publication change →
listing read → Store revalidation. One test intentionally demonstrates that an old
published Store plus a new published listing still looks valid to a DTO projector.
Only a trusted consistent read/revalidation can discover intervening suspension.
The fixture's revalidated Store denies that result. This is a documented gap to
real integration, not a claim that the browser provides transaction semantics.

Before activation, approve a consistent snapshot/transaction strategy or bounded
revalidation protocol, trusted Store/seller resolution, revocation/cache TTL,
deadlines/retry budget and uniform non-enumerating errors. Define freshness at a
specific read/commit point: a later revocation cannot retroactively erase data
already delivered. A public cursor is pagination scope, never authorization.

Actual Rules/adapter tests must replay the matrix with real isolated guest,
seller A/B and trusted moderator identities; verify direct get and constrained
list, parent Store and listing publication, immutable ownership, private/legacy
read denial, malformed scopes and revocation between reads. Rules cannot redact
fields or act as query filters. Approve sanitized public collections separately.
Direct document detail reads require no catalogue composite index; each resolver,
filtered list/order and signed cursor needs its own approved shape/index/tests.
Keep D1–D12, staging deny-all, backend/provider/schema and rollout gates intact.
