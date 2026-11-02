# Isolated Firebase SDK repository and inactive publication boundary

## Guarded SDK mapping

`scripts/firebase-provider-repository.mjs` implements modular Firebase `doc`,
`runTransaction`, transaction `get/set/delete` and `serverTimestamp` calls through
injection. No app is initialized, credential loaded or SDK imported by this module.
Node-only imports and static packaging exclusion prevent browser use. Default is
disabled. The only enabled mode currently accepts **demo-oldx-* project IDs,
127.0.0.1 emulator endpoints with SSL disabled, and explicit distinct testProvider*
collection names**. Production/staging IDs, remote endpoints and legacy collections
are rejected before any SDK operation. There is no production-enable flag.

The guard reads the current modular SDK's `_getSettings()` only to verify emulator
transport; it is test-safety plumbing, not a production connection API. Actual
approved server SDK/identity/IAM configuration is still required later. Existing
Firebase dependency is reused; no Admin SDK/dependency/resource/secret is installed.
Collection names are injected **test schemas**, not approved deployment schema.

The SDK mapping implements existing private-draft transaction methods, caches
transactional reads, stages mutations until the callback finishes, then checks
receipt/audit absence and create/update preconditions before any write. Identity,
owner mapping, private draft, idempotency and audit share one SDK transaction;
server timestamps are added to private metadata. Callback retries are bounded to
three, and deadline/abort checkpoints run before staging/return. A remote commit
already in flight can still finish: unknown outcomes use same-key retry, never a
false rollback claim. Unexpected driver fields never escape the domain adapter.

## Publication command

`scripts/provider-publication-transaction.mjs` defaults disabled. Request permits
only request ID, expected draft revision, expected generation and publish/withdraw
action. It reads verified actor eligibility, **separate publication permissions**,
owner mapping and provider identity inside the transaction. Neither ownership alone
nor caller role/flags authorizes publication. It reads the stored private draft;
never accepts public content from the request. Service/locality relationships are
checked against injected trusted catalog; source/private fields outside the strict
public profile shape fail closed. Public output uses the existing exact public
field allowlist and no owner/contact/credential/audit/timestamp fields.

An accepted publication atomically updates canonical status, private publication
facts, public view, dataset generation, receipt and audit. Withdrawal deletes the
public view and advances the same generation with false publication facts. An
eligible owner with explicit withdrawal permission can withdraw a suspended
Provider without unsuspending it. Suspended account actors remain denied; trusted
moderator revocation policy/adapter is not invented. Private draft content/revision
is untouched by publication. SDK boundary independently rejects extra public fields.

Same-key retries are bound to actor/provider/action/draft revision/generation;
changed requests conflict. Current ownership and permission are rechecked even for
replay, including a matching audit receipt. Replayed historical publication outcomes
do **not** grant current visibility: clients must read current detail/publication.
Generation conflicts, malformed/foreign source and partial SDK failures fail closed.
No operation is connected to an endpoint, browser or real account.

## Generation/read compatibility gate

The materialized row's publicationEpoch is its **last mutation generation**. The
global counter invalidates discovery cursors after any publication change. Existing
mock discovery ports represent per-response snapshot freshness with a current
publicationEpoch on each result. The inactive SDK public-read bridge now connects those representations through
server-only queries, transactional canonical/generation checks and a final server
generation check. It cannot relabel cached rows or rewrite unrelated profiles.
Multi-provider reads, concurrent withdrawal, snapshot/cursor freshness, indexes and
cost budgets need explicit acceptance tests before any real read adapter is wired.
The bridge is still emulator-locked and requires actual schema/IAM/cost/security
acceptance; it is not a production public-query connection. A single global generation is a small initial
coordination point; measure contention before choosing a more complex scheme.

## Evidence and remaining gates

Unit integration fixtures emulate SDK transaction ordering/atomic rollback. Existing
Service Emulator CI now additionally executes **actual Firebase SDK** private save,
concurrent idempotent create, publication, replay, withdrawal and audit checks under
an isolated Rules-disabled test context. Guest reads of candidate private/public
collections remain denied by unchanged candidate Rules. This test proves isolated
persistence behavior, not live IAM, endpoint authorization, or approved client Rules.
Local official emulator binaries remain policy-blocked; distinguish CI evidence.

Owner has approved repository-only Firebase/Vercel architecture development and
isolated mock/emulator tests at zero additional spend. No schema, region, IAM,
secrets, live access, Rules change, infrastructure, billing or deployment approval
is inferred. Actual SDK server identity and schema adapter, public read bridge,
HTTP/auth/rate-limit composition, retention and isolated security/compatibility
acceptance remain before any separately approved staging deployment.
