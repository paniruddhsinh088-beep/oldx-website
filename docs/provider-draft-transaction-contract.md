# Inactive private Provider draft transaction port

`scripts/provider-draft-transaction.mjs` is disabled unless explicitly enabled by an
injected caller. It imports no SDK, exposes no endpoint and is excluded from static
browser packaging. All mutation tests use an in-memory fake. It does not activate
persistence or publication, or implement a Firestore repository.

## Identity and request

`save({requestId, expectedRevision, profile}, {credential, signal})` snapshots the
same strict draft request validated by existing preparation. No caller owner,
provider ID, role, public status, contact or privileged profile fields. Verified
identity comes solely from injected `authenticate`; current write permission and
suspension come from transactional actor state. Authentication must verify the token,
revocation and approved account policy. Current Provider contract IDs are bounded
ASCII (100 chars); other Firebase UID schemes require an approved identity mapping.

`providerIdForActor(uid)` supplies a server-only candidate for a new profile. It must
be synchronous and side-effect-free. Existing canonical mappings win. A future
repository must enforce unique owner->provider and provider identity creation;
this function does not reserve an ID or authorize overwriting an existing profile.

## Injected transaction repository

`runTransaction(callback, {signal, deadlineAt})` may retry the callback against fresh
transactional reads. It must return only the callback result after a known committed
outcome, or throw if acknowledgement is uncertain. The adapter rejects additional/
changed driver result fields. Required transaction methods:

- `getActorState(uid)` -> `{uid, canWrite, suspended}`.
- `getOwnedProvider(uid)` -> null or `{providerId, ownerUid, revision, status}`.
- `getProviderIdentity(providerId)` -> null or `{providerId, ownerUid}`; independently
  prevent taking a reserved canonical identity even when its draft is missing.
- `getDraftMetadata(providerId)` -> null or `{providerId, ownerUid, revision}`.
- `getIdempotency(uid, operation, requestId)` -> null or the adapter's receipt.
- `getAudit(auditId)` -> minimal adapter audit facts, for validating replay.
- `stagePrivateDraft(mutation)` -> stage only; must not independently commit.

Unknown/missing state is not permission. All reads precede staging. The engine must
atomically apply **owner/provider identity mappings + private draft + receipt + audit**, enforce
create-if-absent/update preconditions and read conflicts, and discard all staged
writes on failure/retry. Revalidate suspension/ownership in each callback attempt;
concurrent changes to those records must cause a transactional conflict/retry.
Engine supplies trusted commit timestamps; the port contains no caller timestamp.
No public collection, publication generation, visibility, verified claim or public
profile is written. Existing published status is preserved while only private draft
content changes. These are repository requirements, not enforced database Rules.

## Revision and idempotency

New owner mapping/draft requires expectedRevision 0 and both records absent. Updates
require owner/canonical/draft consistency and matching revision; accepted revisions
advance exactly once. Foreign ownership, suspended/unknown actor state and missing
metadata fail closed. The receipt is scoped by actor, operation and request ID;
SHA-256 binds normalized content and expected revision without storing draft text in
audit. SHA-256 is not publication authorization or a secret signature. Receipt/audit
access must remain private. Audit stores minimal actor/provider/request/revision
facts, not credentials or profile text.

Same key + same normalized request returns the original saved revision even after
later writes, without duplicate audit/mutation. Changed payload/revision conflicts.
Replay still requires current actor permission, ownership and a matching atomic
audit receipt. Retention/key reuse policy and private ledger quotas need owner
approval; no automatic deletion is implemented.

## Deadlines and unknown outcomes

Shared `scripts/verified-operation.mjs` verifies identity, bounds execution to 1–30000
ms, propagates AbortSignal/deadline and exposes a checkpoint/attempt marker. Before
mutation attempt, cancellation/deadline is reported normally. After transaction
attempt, failure/timeout/lost acknowledgement returns `OUTCOME_UNKNOWN` with
`retrySameRequest: true`. Never claim timeout rolled back a remote transaction;
retry with the same key and identical request. A known callback denial/conflict is
returned without marking it a successful save. Checkpoints prevent late callback
staging when dependencies ignore abort; an already in-flight remote commit may
still complete. The future repository must enforce deadlines/abort at its boundary.

The shared helper can support future Product/Store/text Chat server adapters after
their own authorization/schema/transaction contracts are approved. It does not make
legacy client UIDs or roles trustworthy and does not change legacy flows.

## Acceptance before activation

Approve runtime/region/budget/IAM/secrets, identity/ID allocation, write eligibility,
private schema and unique indexes, transaction isolation/retries, audit/receipt
retention and rate limits. Implement actual SDK repository; test concurrent owner
creation/update, permission changes, partial failures, request replay, commit
acknowledgement loss and public invisibility in isolated real adapter/Rules tests.
Keep staging deny-all/HOLD and require separate deployment/resource approval.
