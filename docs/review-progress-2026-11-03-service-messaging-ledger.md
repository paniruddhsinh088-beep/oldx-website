# Durable Service two-way messaging ledger — 3 November 2026

Authorized branch: security-hardening-review only.
Preserved checkpoint: f0a5a66d0ece75962794fea3c69cb40447beccba.
Implementation: 6350ca17eeada1230a245936d35511bb25eb3240.
Diagnostic test checkpoint: 2c5ebb8cfeeb47f182808a673f613b9a680e9595.
Final executable race fix: 1fab65ca1bed141b673e888d1f32ff6368304e58.
Fresh remote reconciliation matched prior HEAD; push succeeded without force,
merge, main changes or concurrent-history replacement. This ledger is docs-only.

Implemented source: default-disabled Service participant read/send repository,
atomic message/sequence/receipt/audit writes inside existing enquiry transactions,
current ownership/publication/blocks and verified sender checks, revision/generation
preconditions, replay-safe keys, bounded private history, verified no-store HTTP
ports and both-role messaging in existing conversation markup. Existing enquiry
journal/reply mode and Product contract retained. Authored Unicode is preserved;
new gu/hi/en app text and 320/375px/doubled-font browser regressions pass.
No new page, dependency, general enquiry state machine or actual resource enabled.

Local final evidence: integration 112/112, browser 53/53, i18n 11/11, static package
3/3, source safety 83/83: 262 passing executions, not unique coverage. Initial
failure-injection fixture bug was fixed and the affected full integration group
rerun; the failing assertion was preserved. Focused new/old conversation/client
8/8 also passed. Commands, logs, limits and exact implementation are recorded in
[batch checkpoint](review-progress-2026-11-03-service-messaging.md).

Exact-source GitHub CI (1fab65ca1bed141b673e888d1f32ff6368304e58):
- Service SDK/Rules 41694228364: success: 35/35 actual SDK/Rules cases, including three forced-first-write-overlap trials.
- Review Safety 41694228392: success.
- Branch Security 41692982428 passed on initial source 6350ca1; the path-filtered
  workflow did not rerun for the later SDK/test-only correction. Do not label that
  run as an exact-final-SHA run.
Initial Service SDK run 41692982753 failed (33/34); diagnostic source 2c5ebb8 then
passed run 41693597423, but that alone was not considered a fix. The final adapter
returns known precondition conflicts so Firestore verifies its read set and can
retry, rather than generic exceptions bypassing verification. Original exact
sent/replayed assertions remain; three independent forced-overlap scenarios and
an unchanged-write conflict regression are added. Final local focused Service/
client group 7/7 passes. See batch checkpoint for the full failure/correction record.
Local SDK tests are mocks. The new GitHub SDK/Rules acceptance runs against an
isolated Firestore Emulator with guest private reads denied, never live Firebase.

Ranked remaining P0:
1. Mandatory-photo integration: trusted processing/moderation/public/private byte
   delivery and parent-reference replacement/deletion acceptance; provider/quota/
   privacy decisions remain unapproved. Preserve existing legacy references.
2. Real runtime: approved operational schema, Auth verification/revocation, rate
   enforcement, same-origin endpoints, Rules/indexes/IAM/secrets and device sessions.
   Emulator-locked adapters cannot simply be used as a live Firebase binding.
3. Chat read receipts/deletion/retention/account lifecycle, trusted minimum Admin,
   remaining whole-app locale/mobile/accessibility and security acceptance.
4. Approved staging end-to-end acceptance and a separate explicit launch decision.

Next safest repository batch: exercise existing inactive photo release/journal/
parent-reference adapters through one complete Product/Store/Provider replacement
and revocation acceptance path using mocks/Emulator, fixing demonstrated gaps;
keep actual image providers and runtime disabled. Do not repeat completed Chat
send/read or add a new demo page. No operational action without owner approval.

Owner decisions before activation: operational runtime/schema/identity/Rules/
indexes/IAM/secrets; private-text retention/deletion and abuse policy; photo
provider/quota/consent/moderation/private-delivery policy; staging/deployment and
launch authorization. Recommendations are not approvals; no spending authorized.
No live/staging Firebase/Cloudinary/data, deployed Rules/indexes, IAM/secrets,
billing, storage/media enablement, migrations, native packaging, merges or deployment.
HOLD/NO-GO. November 7 remains a readiness target, not a launch guarantee.
