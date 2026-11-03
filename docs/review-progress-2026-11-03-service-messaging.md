# Service two-way text messaging foundation — 3 November 2026

Branch: security-hardening-review. Preserved base f0a5a66d0ece75962794fea3c69cb40447beccba;
fresh remote matched HEAD and clean tree. AGENTS, latest ledger, launch decisions,
canonical enquiry/publication, existing Chat intent/HTTP/SDK/client code reviewed.
No new demo page, dependencies, Auth system or enquiry state machine.

Implemented, default disabled:
- Participant-only Service read/send repository reuses the existing enquiry SDK
  transaction: canonical opaque provider/owner allocation, eligible participants,
  service membership, current publication and both block directions are revalidated
  atomically. A thread is keyed to an existing authorized enquiry; there is no
  arbitrary conversation-creation or caller-selected sender/owner/role operation.
- Both buyer and provider may send in existing writable enquiry states. Closed
  enquiries retain authorized reads but reject new sends. Withdrawal, blocks,
  suspension, ownership mismatch or revoked publication fail closed for reads,
  writes and receipt recovery. No review permission or enquiry status is granted.
- Message counter, text, UID-derived sender, receipt and text-free audit commit
  atomically. Exact expected message/enquiry revisions and publication generation
  guard new writes; exact receipt/body/audit/message consistency permits replay
  without duplicate sends. Each thread is capped at 9,999 messages; parent revision
  DTOs are bounded too. No private message text enters public DTOs/audits/errors.
- Private read windows are at most 20 direct sequence reads, ordered and pinned to
  a conversation revision; current participants/publication are checked every time.
  Public API returns role labels, not participant UIDs or private parent records.
- Reuses Product HTTP verification/revocation, strict bounded JSON/headers, injected
  fail-closed rate enforcement, no-store responses, cancellation/deadline and
  unknown-outcome handling through a shared internal composition. Product wrapper
  retains its existing contract and is covered by regression tests. No endpoint.
- Optional messaging ports mount in existing conversation markup; old enquiry
  journal/provider-reply mode remains unchanged. Both participants can send/read;
  retained in-memory pending keys/bodies cannot retry in another scope. Logout,
  account/page/scope changes clear private views/drafts and reject late responses.
  Refresh rereads canonical history; no private drafts or text are persisted in
  browser storage, URLs/history state. No automatic resend on refresh.
- App-owned UI supports gu/hi/en, 320/375px and enlarged text. New Service message
  validation reuses the existing plain-text policy but stores/displays original
  authored Unicode (including combining forms) without NFC/translation changes.
  Existing Product and legacy Chat normalization behavior is unchanged.

Inactive test mapping only (NOT an approved operational schema):
`testOldxServiceChatThreads`, `Messages`, `Receipts`, `Audits` (same prefix).
Optional conversation mapping is validated for disjoint namespaces and constrained
by the existing demo-project + 127.0.0.1 Emulator SDK lock. No browser SDK imports,
credentials, provider initialization, deployed Rules/indexes or actual resources.
Actual Emulator acceptance uses a separate Provider Messages fixture namespace so
it cannot overwrite existing Provider journey fixtures. Guest reads stay denied.

Observed local evidence:
- Focused Product/Service repository/HTTP first: 6/6 pass after correcting an NFC
  preservation mismatch; original Unicode assertion retained, validation reused.
- New/old conversation browser plus client lifecycle: 8/8 pass (gu/hi/en send/read,
  unknown-ack retry exactly once, refresh, provider reply, back, logout, foreign
  denial, original Unicode and doubled text at 320/375px; no off-origin requests).
- One appropriate selected regression sweep: browser 53/53, i18n 11/11, static 3/3,
  source safety 83/83. Integration initially 111/112: a test fixture copied the fake
  SDK's mutable failSet flag, so it did not inject the intended failure. Fixed the
  fixture to retain the actual SDK object; assertion unchanged. Corrected complete
  Provider/Product/Store/media/integration group: 112/112 pass.
- Final applicable total: 262 passing executions across five selected groups, not
  unique coverage. No full 34-script repeat, no hidden/skipped security failures.
- Commands: npm run test:provider-draft:transaction; test:service-preview:browser;
  test:i18n; test:static-build; test:emulator:safety. Logs /tmp/oldx-messaging-*.log;
  corrected integration log /tmp/oldx-messaging-integration-corrected.log.
- New shared acceptance is wired into the existing actual SDK/Rules GitHub workflow;
  local tests are injected SDK mocks, NOT local Emulator evidence. Official local
  Emulator download remains blocked; no bypass or live connection attempted.
  Exact source SHA/CI results follow in the durable ledger. git diff --check passes.

Ranked remaining P0 / next safe batch:
1. Mandatory photos: existing media journal/proofs and trusted image processor
   need approved provider/quota/privacy/moderation/delivery policy and isolated
   end-to-end parent-reference/replacement/deletion acceptance. Do not activate.
2. Real runtime: approved server Auth/revocation/rate enforcement, operational
   schemas/indexes/Rules/IAM/secrets, same-origin bindings and real session handling.
   Current source cannot be activated merely by toggling these test adapters.
3. Complete Chat receipts/deletion/retention/account lifecycle and minimum trusted
   Admin; whole-app gu/hi/en, device/accessibility and security regressions.
4. Explicitly approved staging end-to-end acceptance, then separate launch approval.

Owner approvals remain runtime/schema/Rules/indexes/IAM/secrets, privacy/retention/
media provider, staging/deployment and launch. No live/staging Firebase/Cloudinary,
real data, main/merge, deployed Rules/indexes, IAM/secrets, billing, storage/media
activation, migration, deployment or spending. HOLD/NO-GO. November 7 is a target.

Actual SDK follow-up (do not erase failed evidence): initial Service run
41692982753 on 6350ca1 passed 33/34; the duplicate-race response did not contain the
expected replay status. Diagnostic assertion metadata was added in 2c5ebb8;
Service run 41693597423 then passed, so a single rerun was not treated as a fix.
Review identified a genuine staging race path: a sequence/receipt precondition
conflict threw a generic exception before Firestore could verify its read set and
retry the transaction. It now returns a known conflict without staging any writes,
allowing normal SDK read-version verification/retry. There is no application retry
loop or relaxed idempotency assertion. A local orphan-sequence fixture proves 409
with zero partial writes. Focused Service/client group 7/7 passes after this change.
Three independent actual-SDK forced-first-write-overlap cases are added using the
existing barrier; the original exact sent/replayed assertion is retained. Final
source and CI evidence are recorded in the following ledger; do not count the
initial failed run as successful or infer live acceptance from any Emulator test.
