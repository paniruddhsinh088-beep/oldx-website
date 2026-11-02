# Inactive Provider HTTP composition and consistent public reads

## Command composition

`scripts/provider-http-composition.mjs` exports a disabled framework-neutral function,
not an endpoint/router/listener. A future transport normalizes `{method, headers,
body}`; body is raw UTF-8 string/bytes. POST and JSON/UTF-8 only, no compressed body,
16 KiB maximum, bounded nesting/nodes/arrays, duplicate keys (including escaped
aliases) and prototype keys rejected. Existing draft/publication strict schemas
reject caller UID/role/provider/status fields. No CORS/cookie/session behavior is
activated; recommend same-origin bearer-token transport once approved.

`verifyFirebaseToken(token, {checkRevoked:true, signal, deadlineAt})` is an injected
**real-verifier requirement**, not implemented token cryptography. The future
Firebase Admin verification wrapper must honor revocation and approved account
policy. Only its own data-property UID enters the operation context. Caller roles,
claims and IP headers cannot supply ownership. The required trusted role resolver
returns `{uid, role, active}`: eligible member/provider may prepare/save their own
draft, provider role is additionally required to manage publication. No Admin bypass.
Actual role values/promotion/account eligibility remain policy decisions. Transaction
ports still revalidate current write eligibility, ownership, suspension and separate
publication permission; role alone never grants a publication or cross-owner write.

Required `consumeRateLimit({actorUid,operation,requestId}, context)` must atomically
allow/deny through a trusted enforcement adapter. Missing/unknown/thrown enforcement
fails closed (503); deny returns 429 with bounded Retry-After. No in-memory limiter
is represented as production protection; real thresholds/store/failure policy and
transport ingress/pre-auth abuse limits are approval/implementation gates.

The composer instantiates existing atomic draft/publication ports with the verified
identity, shared deadline and AbortSignal. It never returns tokens, claims, profiles,
owner IDs, receipts, audit or raw errors. Responses contain only fixed safe command
outcome fields and codes, no-store/nosniff/Vary Authorization headers. Auth 401,
permission 403, schema 400, conflict 409, enforcement 503, pre-dispatch deadline 504
and cancellation 408. After command dispatch/possible commit, uncertainty is HTTP
202 OUTCOME_UNKNOWN + retrySameRequest; identical key/body retry is required. A
replayed historical publish result is not proof of current visibility.

## Consistent public read bridge

`scripts/firebase-provider-public-read.mjs` is default-disabled and shares the SDK
repository's demo-project/loopback/test-namespace-only guard. No production enable
mode, app, credential, live read or endpoint exists. Shared bounded-read lifecycle
settles ignored SDK delays/cancellation; the SDK itself may not abort an in-flight
RPC, so this is not a promise about billable work if later activated elsewhere.

The existing public repository still plans filters, bounded page size/sentinel,
ordering, IDs and cursor scope. The bridge validates that exact plan; no caller
collection, projection, query operator or unbounded read. It fetches only curated
public-view records with SDK getDocsFromServer, rejects cache/pending-write snapshots
and extra/private/invalid public fields, and preserves seller-authored text. The
modular SDK has no server-side select() API: approved public-view documents must
contain public fields only; do not substitute a private collection and redact it.

Before query, dataset generation must match the plan. After query, a read-only SDK
transaction rechecks that generation and each bounded candidate's canonical
publication version/services, provider identity and owning canonical published
status. A final server-generation check rejects a concurrent mutation. Only after
this barrier is a stored per-row last-mutation version represented as the existing
port's current snapshot generation. Older unchanged rows remain valid; cached
rows are never blindly relabeled, and unrelated rows need not be rewritten. Detail
uses the same canonical bridge and existing independent detail repository checks.
All publication changes must use the atomic generation writer; direct mutation
without generation discipline is unsupported and must be prevented by Rules/IAM.

Queries read at most 25 public documents (24 + sentinel), plus bounded per-row
canonical/identity/owner reads and generation checks. Actual cost/index/collation,
revocation freshness and contention must be measured and approved. No cache or
long-lived listener was introduced. Cursors use the existing trusted issuer/verifier
and bind filters, limit, order and generation. Withdrawal deletes public materialization
atomically, invalidates old cursors and causes detail/page failure; retry from first
page recovers. No instant revocation beyond a completed response is claimed.

## Acceptance and current limits

Mock integration tests cover HTTP/rates/roles/errors/unknown outcomes and concurrent
read/withdrawal/cursor/forged identity/privacy. Existing Emulator suite adds actual
SDK multi-provider publication, HTTP composition, consistent discovery/detail,
pagination and withdrawal in a privileged isolated test context with mock token/rate
injections. It does not verify real Firebase tokens, real IAM, production client
Rules, actual rate storage or an active endpoint. No Rules file changes.

Approve actual schema/indexes and canonical role/publication policy, verifier/runtime
identity/IAM/secrets, data/privacy/retention, rate/ingress limits, consistent-read cost
budget and revocation targets. Then bind actual verified-token/role/rate adapters,
review the production SDK connection guard separately and verify isolated acceptance
before separately authorized staging transport/Rules/deployment. HOLD/NO-GO remains.
