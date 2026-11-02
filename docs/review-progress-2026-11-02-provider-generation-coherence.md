# Public Provider generation coherence — 2 November 2026

## Reason for this isolated fix

The existing publication writer advances one **global** generation on every
Provider publish or withdrawal. Previously the public discovery/detail reader
required every still-published Provider row and canonical publication to have
that exact latest generation. Publishing an unrelated Provider therefore hid
older valid Providers from discovery and detail until all their rows were
rewritten. Rewriting every public row per publication would be unbounded and
expensive.

## Source change

`features/service-providers/provider-discovery.mjs` now distinguishes the
current global read/cursor generation from a Provider's own last-publication
epoch. Public rows must have a safe positive integer epoch **no later than**
the global generation. Detail additionally requires the public row epoch to
equal the independently rechecked canonical publication epoch for that exact
Provider. Global generation is still checked before and after reads and cursor
issuance. The repository remains default-disabled and projects only the
existing public field allowlist.

`features/service-providers/provider-detail.test.mjs` covers an older
still-published Provider after an unrelated publication, mixed-age discovery,
stale generation links, canonical/row mismatch, future epochs, withdrawal
and generation changes during reads.

## Boundaries and remaining gates

This is a source-only compatibility fix, **not** permission to publish data.
Real Firebase reads, schema/index/identity/IAM decisions, consent, audit
retention, Rules and deployment remain unapproved. The global generation
remains a conservative invalidation strategy: unrelated changes may invalidate
a cursor or stale link and require a fresh page, but must not hide valid
Providers from a fresh request. Atomic publication and deletion are required
of the trusted repository; browser-side filtering is not a substitute.
Staging deny-all and release HOLD/NO-GO remain unchanged.
