# First text-only OLDX launch: minimum owner decisions

Recommendations only, not recorded approvals. No provider pricing/account quota was
verified. “Free-tier possible” means technically plausible within the existing
account's eligibility/quotas; it is not guaranteed free hosting or approval to spend.
Keep staging deny-all and release HOLD/NO-GO until isolated tests, approved staging
acceptance and explicit rollout sign-off. A public-profile read slice alone is not
a functional marketplace release.

| Priority / decision | Recommended low-cost default | Security implication | Free-tier path? | Exact owner approval required |
| --- | --- | --- | --- | --- |
| 1. Scope and public/private schema (D9) | Text-only listings, Stores and Services; no uploads, payments, public phone/exact coordinates/IP, reviews or SMS in first slice. Reuse existing UI and projection contracts. Start with public Provider reads as the smallest integration checkpoint. | Materialize allowlisted public views; never expose legacy private documents then filter in browser. Existing features/data require a compatibility/migration plan. | Static UI and bounded reads may fit existing free quotas; review actual accounts. | Named fields/collections, contact consent, text-only limitations, legacy compatibility and each allowed operation. |
| 2. Runtime, region, budget (D1/D2/D4) | Keep Firebase Auth/Firestore and existing web stack; one small same-origin trusted API on the existing host if its current plan supports required auth/admin SDK and region. No new databases, queues or services. Initial spend ceiling zero. | Server performs token/ownership/privilege checks. Browser Firebase config is not an authorization boundary. Do not use a runtime that requires unapproved billing. | Possible only if existing plan/quota permits; Firebase Functions or upgrades may require billing. No assumptions or paid provisioning. | Exact runtime/account/region and verified quota/cost plan; any resource/deployment separately. If free path unavailable, remain blocked until explicit budget approval. |
| 3. Identity, ownership and publication | Reuse email/password and Google Auth source flows; no SMS. Require verified identity for writes, server-derived owner/provider IDs, private drafts then explicit publication. | Decide verification policy and canonical ID mapping. Atomic publication + generation update and fresh detail checks prevent stale/foreign public reads. | Auth/text CRUD may fit existing quotas; provider limits must be checked. | Auth providers/verification policy, ownership mapping, publication/moderation policy, service/locality taxonomy, public-view generation/index consistency. |
| 4. Service identity/secrets (D7/D8) | Dedicated least-privilege staging identity and managed secret injection on selected runtime; reuse server-side cursor codec with bounded expiry. Owner enters secrets directly in approved manager. | No credentials/signing key in browser/Git/chat; define rotation and revoke access. Server SDK bypasses Rules, so server policy enforcement is mandatory. | Plan dependent; do not create identities/secrets here. | Named IAM operations, identity, secret manager, cursor TTL/rotation and who operates them; separate setup permission. |
| 5. Minimum private interactions/Admin (D6/D10) | Text enquiries/chat only; participant-only bounded reads and server-validated transitions. Start Admin with narrowly scoped authenticated reads; enable only essential approved moderation operations with atomic audit. | Decide retention, withdrawal/history access, blocks, disputes and support disclosure. Browser Admin UID checks are not enforcement. No real review eligibility from client confirmation. | Small workloads may fit quotas; rate limits and bounded queries still required. | Roles/support access, retention/deletion, messaging namespace, rate limits, moderation operations/audit and cancellation/dispute policy. |
| 6. Acceptance and rollout (D11/D12) | Isolated Emulator/adapter tests, synthetic staging data only initially, owner-reviewed mobile smoke tests, disable switch and rollback; no Android release yet. | Cross-account/forged-owner/stale-publication/privilege/replay tests and legacy regression acceptance before real data. Alerts are not guaranteed hard spend caps. | Local/CI tests available; real runtime cost depends on approved plan. | Named rollback owner, staging resources/data scope/Rules/deployment, acceptance criteria and later separate production rollout approval. |

D3/D5 media provider/quota decisions can be deferred by explicitly excluding uploads;
D6 text retention cannot be deferred once real enquiries/messages exist. No part of
this checklist approves main changes, live access, Rules, migration, billing or deployment.

Shortest implementation sequence after named decisions: implement the actual public
view/canonical repository adapter and atomic publication writer; verify Provider
read slice in isolated integration tests; then authenticated private draft commits
with revision/idempotency/audit, reuse that ownership boundary for text listing/Store
writes, and integrate participant text enquiries/chat and minimal server Admin. Keep
legacy working source UI where compatible. No infrastructure for hypothetical
10,000 concurrent users: bounded pages, required indexes, cancellation, measured
query/read budgets and a small API suffice to start; revisit generation contention
and per-scope publication versions only with measured traffic/latency evidence.

Current blockers after inactive draft transaction implementation:

| Slice | Still blocking | Recommended low-cost default / approval scope |
| --- | --- | --- |
| First real public read | Approved curated public schema, canonical ID/service/publication mapping, generation consistency/indexes, runtime/region/zero-cost eligibility and read IAM; actual adapter + isolated Rules acceptance | Existing-stack text-only Provider public view; no private/browser filtering, one small approved API. Owner must approve those named data/runtime/IAM choices plus staging resource/Rules/deployment actions separately. |
| First real private draft write | All identity/runtime gates plus owner allocation, account write eligibility/suspension, private draft schema, atomic create/update/receipt/audit repository, isolation/retry/deadline policy and rate limits | One Provider per verified owner initially; owner index and opaque provider ID reserved atomically by trusted repository. Reuse existing datastore transactions if approved, no new queue/service. Owner must approve ID mapping, write policy and operation-specific IAM. |
| Audit/idempotency and unknown outcomes | Private ledger access/retention, server commit timestamps, request-key reuse/quota, acknowledgement-loss UX | Minimal metadata audit, no profile text/credentials. Keep receipts for an explicitly approved retry window; retries use same key/content. Timeout after commit attempt is **unknown**, not rollback. No cleanup/retention schedule is activated without policy approval. |

These implementations do not remove any activation gate or prove free-tier account
eligibility. The actual SDK transaction/public-view writer is still absent; mock
atomicity tests are not real database acceptance. No backend, secret, Rules or
billing approval has been supplied.
