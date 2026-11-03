# Product recovery and existing Store integration — 3 November 2026

Authorized branch only: security-hardening-review. Base `dadf8c7`; safely fetched,
read and fast-forwarded owner language decision `be48c7d6ca066fddb33b2a689a4d3a21f3c3098c`
and concurrent monitoring rule `4f87af436d5a4146cad971ef03e4c379a922a911`.
AGENTS, launch register, feature matrix, Product UI checkpoint and approved design
read. No concurrent executable changes or PR merges; previous ancestry preserved.

## Completed executable batch

- Marketplace SDK `owner` transaction: server-derived eligibility/ownership,
  one-Store owner index, strict private profile projection, archived denial and
  receipt/audit reconciliation. An old accepted receipt reports its mutation
  revision separately from the current draft revision. No new allocation/write.
- Product controller/DOM: owner draft reload/edit, public Product/edit/private Chat
  hash restoration, actual refresh/back/forward, participant metadata before history,
  bounded 20-message windows and revision-bound inbox cursor pagination. Cursor
  scope binds verified actor, role, limit and anchor revision; foreign/stale anchors
  deny. Block/withdrawal/ownership remain independently revalidated server-side.
- Pending Product save metadata (opaque request ID, Product ID and injected session
  scope only) survives refresh in browser history state; no draft, photo, credential
  or message content is stored there. Recovery is a verified receipt read, not an
  automatic repeated write. Different sessions/logout clear metadata/private UI.
  Host must supply a stable non-credential session scope across refresh and notify
  every mounted binding on Auth changes. Real Auth/retention approval remains open.
- Existing Store form/public wrapper: default-off owner create/edit/reload, explicit
  publication/withdrawal, curated catalogue pagination, relative Store share port
  and Product/Store navigation callbacks. No full private legacy documents enter
  public UI. Unsupported contact/GPS paths do not become trusted fields. Store
  schema still has the existing single category; full legacy multi-category/directory
  compatibility and operational route approval are NOT declared complete.
- Product titles/descriptions remain exact seller Unicode, including decomposed
  characters/whitespace. Store catalogue/snapshot normalization was corrected;
  normalized search comparisons do not rewrite displayed values. Safe description
  line breaks now work in SDK validation; markup/NUL/vertical-tab and invalid title
  controls still fail closed. No Translate button or translation API.
- Small shared navy/orange/white CSS, scoped to mounted controls; gu/hi/en recovery
  text, 44px targets and safe-area spacing. No dependency/native packaging changes.

## Executed local evidence

One broad sweep: all **34** non-runtime-Emulator package scripts passed, **878** test
executions. Logs `/workspace/work/product-store-recovery-regression/`; runner
`/tmp/oldx-recovery-regression.cjs`. Integration **96**, Service modules **196**,
Admin **115**, source safety **83**, Store models **82**, Store browser **28**,
combined Service/marketplace browser **39**, locale **11**, static build **3**.

New actual-markup browser cases: Product **7** (320/375/768/1280px; actual refresh,
back/forward, gu/hi/en, 200% text, local image selection, receipt reconciliation)
and Store **3** (320px gu/hi/en owner/edit/publish/share/withdraw). Final Store public
status/next-button placement passed targeted browser/static **6/6**; final multiline
and unsafe-control SDK checks passed targeted recovery/Store/durable **8/8**.
Additional final receipt/validation helper run **4/4**. No failure was skipped.

Development failures fixed: owner read cleanup incorrectly cleared revision after
publication; refresh fixture reused its deterministic write-key counter (backend
correctly rejected conflict; fixture now uses fresh UUID prefixes); old catalogue
expectations normalized titles contrary to the new owner decision (now assert exact
source values, preserving all security checks). One interim test-edit typo was fixed.
Official local Emulator download remains blocked; no bypass/mirror/live project.
New shared acceptance helpers are wired into actual SDK Emulator CI separately.

## Observable readiness / ordered P0

| Area | Evidence / remaining gate |
| --- | --- |
| Product | Existing UI + disabled SDK recovery/enquiry journey; real Auth/runtime/media acceptance missing |
| Store | Existing UI + disabled owner/catalogue ports; directory, full category compatibility, approved real links/media missing |
| Service Providers | Prior multi-service/UI/HTTP/SDK source retained; no new Provider activation or completion claim |
| Chat | Product metadata/history/inbox pagination added; legacy Chat delete/receipt/retention and blocked-history policy integration remain |
| Admin | Existing source + 115 local checks retained; real roles/IAM/mutation/audit activation missing |
| Photos | Prior journal/processor/moderation contracts retained; provider/scanner/quota/private-byte delivery still blocked |
| Languages/UI | Exact authored text + scoped approved styling/tests; whole-app/native-speaker/device QA incomplete |
| Security | Owner/participant projection and deny-all preserved; actual deployment security acceptance absent |
| Staging/live | None accessed or activated; isolated results only |
| Android | Portable web modules retained; packaging/signing/Play/device gates untouched |

Fastest next batch: Store directory/multi-category compatibility and complete
Product-to-Store owner/catalogue navigation acceptance, then existing Provider
owner/buyer UI session orchestration. Complete Chat lifecycle/Admin/private media
and whole-app QA before approved staging. Do not replace working legacy features.
Owner approvals still required: operational namespace/compatibility, identity/session
and cursor keys, runtime/commercial eligibility, privacy/retention/history metadata,
Rules/indexes, media provider/scanner/moderation/quota and separate staging acceptance.
Recommendations are not approvals. No live Firebase/Cloudinary, Rules/index, IAM,
secrets, deployment, migration, main/merge, billing or paid action. **HOLD/NO-GO**:
November 7 web and November 14–19 conditional Android remain targets, not guarantees.

Exact implementation SHA and GitHub CI evidence follow after verified delivery.
