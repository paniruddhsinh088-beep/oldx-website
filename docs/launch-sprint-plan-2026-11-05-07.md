# November 5–7 P0 plan — audit on 4 November 2026 (Asia/Kolkata)

HOLD/NO-GO. Dates are priorities, not promises. No reset activation is assumed.
One small source correction only in this session; no runtime/deployment is authorized.
Base 88620e85003ff3f3258c8a4bd57dcb4ffcab912d fetched unchanged, clean tree;
AGENTS, latest photo ledger, launch register and relevant atomic adapters reviewed.

## Exact P0 audit

| Area | Verified source / isolated evidence | Missing before real website acceptance |
| --- | --- | --- |
| Product/Store photos | Default-off atomic parent/reference/release metadata, rollback/retry/replacement/withdrawal; actual SDK/Rules source CI 41707371193 passed 37 cases | Actual byte gateway/storage, scan/provider, approved privacy/consent/retention/moderation and runtime bindings. Existing legacy Base64/unsigned Store uploads are not an approved managed pipeline; no automatic migration/unpublication |
| Provider photos | Default-off profile-image contract, canonical ownership/publication plus approved-media checks; four synthetic contract tests | Approved sidecar design/epoch mapping, atomic SDK snapshot/release adapter and byte delivery. No Provider image writer or SDK reader is implemented; v1 text DTOs unchanged |
| Auth/runtime/Rules | Existing client Login, injected verified-token/revocation/role/rate ports; test-only SDK/Rules coverage | Operational runtime/region/project/schema/quotas, actual token/role/rate implementation and approval to provision identities/IAM/secrets/Rules/indexes. Staging intentionally deny-all; no trusted runtime or staging integration accepted |
| Chat retention/deletion | Participant/block/revision-safe text foundation, idempotency and model/privacy/candidate-rule tests | Approved retention/deletion/tombstone/account-export policy and trusted persistent enforcement/workers, media cleanup and actual receipt/delete acceptance. Existing tests are not live message-lifecycle acceptance |
| Admin/moderation | Injected authorization/HTTP/read/mutation contracts; existing isolated Admin tests and independent photo-review checks | Approved server roles and scoped durable mutations/audit, abuse/moderation workflow and actual trusted identities. Legacy UID/UI/direct writes cannot authorize backend access; automated explicit-content detection is not enabled or verified |
| Staging/mobile | Existing isolated 320/375px, enlarged-text/focus/history/offline/gu/hi/en regressions | Full authenticated backend journeys, all essential locale/error copy, native-speaker and physical mobile/WebView checks, rollback/revocation/CDN/private-byte acceptance. No staging/live feature or Android release readiness claimed |

## One small verified improvement this session

Atomic parent receipt replay previously did not verify its associated immutable
photo receipt/audit. Product and Store corruption fixtures reproduced this before
fix (both failed expected-denial assertions). The new read-only replay hook requires
exact matching media acknowledgement identity, action, fingerprint, revision and
counters, without changing current publication. Missing/malformed/corrupt metadata
fails IDEMPOTENCY_CONFLICT and writes nothing. Draft receipts stay independent;
withdrawn/archived publication cannot be resurrected by old successful replay.
Default/legacy mode unchanged, no new transport or schema. Archive replay also
uses the same check. Focused tests 12/12 pass:
node --test --test-isolation=none tests/integration/atomic-photo-replay.test.mjs
 tests/integration/atomic-photo-publication.test.mjs
 tests/integration/provider-photo-contract.test.mjs tests/integration/media-delivery.test.mjs
Logs /tmp/oldx-replay-before.log (observed failure), /tmp/oldx-launch-focused.log
(final pass). Synthetic SDK/contracts locally; exact-source CI follows in ledger.
No full local sweep, dependency, demo page or SDK/runtime migration.

## Ranked November 5–7 execution plan

1. **November 5 — decisions before activation.** Owner selects zero-cost-eligible
   existing runtime/account/region and approves operational schemas/roles/rates;
   Provider media-sidecar design; media provider/scan/consent/moderation/retention;
   Chat deletion/receipt/account lifecycle policy. Provisioning, IAM/secrets and
   staging must each be explicitly authorized. No free unlimited storage/scan claim.
   Code-ready meanwhile: policy-derived deletion dry-run/contracts, scoped Admin
   DTO/mutation checks and essential locale/a11y fixes with demonstrated failures.
   Minimum checks: participant/owner denial, tombstone/replay safety, private fields,
   gu/hi/en and focused 320/375px. Do not rebuild completed photo selectors/Chat send.
2. **November 5–6 — Provider adapter, conditional on design approval.** Reuse the
   completed profile-photo contract and canonical identity ports for a default-off
   atomic snapshot/release adapter. Synthetic/Emulator tests need no live credentials;
   minimum cases: foreign owner, stale public epoch, withdrawn/suspended profile,
   missing/revoked scan/review, replacement and unknown-outcome replay. Approval of
   repository design does not approve resources or activation.
3. **November 6 — actual integration only if separately approved.** Owner-provided
   staging identities, runtime/project settings and credential/IAM provisioning are
   required; no credentials here, no new spending assumed. Bind one complete
   Product/Store/Provider journey including mandatory photos and participant Chat,
   then minimum Admin. Run real token/role/rate, denied-read/write, retention/delete,
   photo quarantine/revocation and current Rules/storage acceptance. If storage or
   moderation needs billing/unapproved resources, stop activation; document blocker.
4. **November 7 — acceptance and explicit go/no-go.** Only in an approved staging
   environment: guest/buyer/seller/moderator/Admin negative access, create/edit/
   publish/replace/withdraw, private bytes and old-link revocation, Chat/delete/account
   lifecycle, offline/unknown retries, logout/cross-account cleanup, gu/hi/en and
   physical mobile/WebView accessibility. Review rollback, quotas/cost limits and
   every P0 gate. Production release/merge/deployment still needs separate approval.

Realistically: a reviewed isolated source candidate and focused integration handoff
can be ready by November 7. A complete live marketplace cannot be promised from
current evidence; late decisions, missing storage/moderation/runtime credentials,
remaining Chat/Admin enforcement or failed real staging acceptance keep NO-GO.
No agreed photo, multilingual, privacy or accessibility requirement is dropped.
No main/merge/live Firebase/Rules/IAM/secrets/billing/media/deployment or Full Reset.
