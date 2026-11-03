# Mandatory-photo source checkpoint — 4 November 2026 (Asia/Kolkata)

Branch security-hardening-review only. Preserved base
1cc8133a1c3b50be015a09ab2a0d21c6e79f6166. Fresh fetch matched clean HEAD; base
Review CI 41694740273 success; prior executable Service SDK/Rules 41694228364 and
Review 41694228392 success. No concurrent commits found. AGENTS, latest ledger,
launch decisions, photo audit, journal/reference/release/delivery/processor read.

Implemented, explicitly injected/default disabled:
- Reusable platform-neutral selection/upload lifecycle and DOM binding for existing
  Product, Store and Provider forms. JPEG/PNG/WebP type/signature preflight, count
  6/1/1, bounded input 3/3/2 MiB; local blob preview; progress; remove/replace;
  cancellation/deadline/offline recovery and original-request/body retry. Concurrent
  selection cannot exceed count; late results cannot survive scope/logout changes.
- File bytes/previews stay private in memory; object URLs are revoked on removal,
  replacement/scope change/destroy/page exit. Failed uploads/offline preserve text
  drafts and selected bytes/request keys; account/parent revision changes clear
  private selections. File names/paths/URLs are never used as provider authority.
- Existing image processor still performs actual isolated decode/re-encode and
  metadata stripping. New preflight does NOT prove image validity or moderation.
  A server upload bridge derives UID from verified authentication, checks owned
  parent revision before/after existing quota/lease/quarantine lifecycle, and
  returns only a managed image ID, never a public/private provider URL. Unknown
  results stay retryable; stale-parent results remain quarantined, not published.
- A transaction-level mandatory-photo hook checks current private association,
  same owner/parent/revision/service, bounded unique managed IDs, trusted processed
  metadata, scan proof and an independent active moderator's current approval.
  Opt-in Product/Store publication and Provider publication use it inside their
  existing parent transaction. Missing checks fail closed. Drafts/withdrawals are
  permitted without photos; callers cannot set owner/role or bypass via body flags.
- Existing Provider v1 text projection stays unchanged; photos use the existing
  private sidecar concept. Product owner recovery accepts strictly typed managed
  references. Product/Store forms can consume an explicit photoWorkflow's staged
  references; unchanged selections retain existing legacy references. All mounts,
  upload providers, publication policy flags and transport ports require injection.

Important limits / incomplete integration:
- This is a private selection/upload + publication-eligibility foundation, not a
  deployed end-to-end public gallery. The host still must bind verified owner scope,
  upload ports and the existing authorized photo-reference apply transaction before
  publication; a client preview/quarantine response is never sufficient approval.
- Publication eligibility is NOT public release. Existing independent media release
  and delivery checks remain mandatory. Marketplace publication advances parent
  revision: references/reviews must be rebound/revalidated before release; until
  then delivery fails closed. Atomic combined parent/photo public materialization
  and Provider public media DTO/delivery remain next integration work, not claimed.
- Removing a selection is local and stages its next reference list; it never deletes
  a remote/legacy image. Existing owner/revision/reference/delete-lease/reconciliation
  contracts govern unlink/delete. Orphan cleanup scheduling/retention is not active.
- Automated explicit-content detection is NOT implemented or enabled. Existing scan
  interfaces and synthetic approvals are test doubles; no moderation service called.
  Absent scan/independent review blocks publication in the new mandatory policy.
- Legacy Base64/Cloudinary references, active legacy flows and existing listings
  are unchanged. New enforcement is opt-in server policy; no automatic unpublish,
  replacement, deletion, fetch, conversion or migration. Migration must separately
  review ownership/consent/content/visibility, stage metadata and prove rollback.

Testing evidence / exact source and CI ledger follow after validation. Relevant
logs: /tmp/oldx-mandatory-*.log and /tmp/oldx-photos-*.log. Local SDKs are mocks;
actual Emulator evidence comes only from the named GitHub workflow. No local
Emulator binary bypass, new dependency or full 34-script sweep.

Ranked P0 for 7 November (conditional target; HOLD/NO-GO):
1. Complete atomic parent/reference/public-derivative integration and approved media
   delivery, including Provider projection; quota/abuse/orphan/private-Chat safety.
2. Owner-approved media privacy/retention/consent/moderation/Admin-review policy and
   provider/free-tier hard limits. Cloudinary/Firebase Storage selection/activation,
   scanning accounts, secrets, IAM and billing remain unapproved.
3. Approved Auth/runtime/revocation/rate enforcement/schema/Rules/index deployment.
4. Chat retention/deletion/account lifecycle and minimum trusted Admin enforcement.
5. Whole-app gu/hi/en and real 320/375px browser/device/accessibility checks, future
   Android/Capacitor WebView compatibility and separately approved native work.
6. Explicitly approved isolated staging end-to-end/security/cost/rollback acceptance,
   followed by an independent release decision. No deployment/activation implied.

No live/staging Firebase/Cloudinary/data, Storage/Rules/index/IAM/secrets/billing,
provider resources, migration, main/merge, paid service or deployment action.

Observed local validation:
- Selected five-script regression: integration 118/118, existing/new browser 62/62,
  i18n 11/11, static browser package 3/3, source safety 83/83 = 277 executions.
  Commands: npm run test:provider-draft:transaction; test:service-preview:browser;
  test:i18n; test:static-build; test:emulator:safety. All passed; no full 34 sweep.
- Final photo/browser follow-up 14/14 after extra missing-scan/stale-association and
  offline-preservation assertions: node --test tests/integration/mandatory-photos.test.mjs
  tests/browser/mandatory-photos.test.mjs. Product/Store/model follow-up 16/16 after
  localized Product photo-required outcome mapping: node --test
  tests/integration/mandatory-photos.test.mjs tests/integration/product-ui.test.mjs
  tests/integration/store-ui.test.mjs. Counts overlap; not unique coverage.
- New actual SDK acceptance is wired into the existing Service Emulator runner:
  Product/Store/Provider empty/missing independent review, self-approval, foreign
  asset, absent scan, stale parent, approved gate, original Unicode, public-field
  separation, revision conflict and withdrawal. This is pending actual CI review
  until the exact source/run is recorded in the ledger.
- Browser uses existing forms (not a new demo), real synthetic PNG file selection
  and blob decoding, explicit injected mock upload/progress, retry same request,
  remove/replace, offline preservation, logout cleanup, gu/hi/en, 320/375px and
  all-element doubled fonts; authored draft text unchanged, zero off-origin calls.
- No automated content detector or real upload provider was used. Activation must
  explicitly enable mandatory policy for new publications, connect trusted private
  reference/release ports and complete actual runtime/staging acceptance; merely
  enabling the old compatibility defaults is not an approved launch path.
- Final mount lifecycle guard: remount/disabling a container destroys its prior
  binding and revokes previews; destroy is idempotent. Existing-form photo browser
  checks rerun 9/9 after this guard (log /tmp/oldx-photos-mount-final.log).
