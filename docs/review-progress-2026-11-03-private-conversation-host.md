# Private enquiry conversation and shared host — 3 November 2026

Branch: security-hardening-review only. Base 165ea82d22d1054771ba49b5175e3691b1070825
preserved; initial fetch matched HEAD and clean tree. AGENTS, launch register,
Provider ledger, Service roadmap, approved design and checkpoint policies reviewed.
No new pages, dependencies, Auth system, query/state architecture or live transport.

Implemented, default-disabled source:
- Existing conversation markup now accepts canonical participant-scoped private
  enquiry detail/history through createProviderPrivateIntegration. It renders the
  existing buyer note/provider replies/status journal (bounded 20-event windows),
  not a new general Chat message store. Buyer is read-only; provider replies use
  existing verified HTTP/atomic revision/idempotency/audit enforcement. No reviews,
  contacts, media or buyer message-write permission is granted.
- Existing private inbox exposes conversation handoff only after a validated
  private detail; existing public-page enquiry callback can open the private inbox.
  Conversation -> enquiry back link, refresh, browser history, logout/account switch,
  unavailable recovery, unknown-ack retry, paging and original Unicode are covered.
  Retry retains the original key/body within the session. Refresh clears drafts
  and rereads trusted history; private note/reply text is never persisted in URL,
  storage or history state, and refresh does not automatically replay a command.
- Existing synthetic conversation renderer pauses under an explicit trusted mount
  marker so late sample reads cannot repaint trusted private history. The role
  selector is hidden; injected audience is presentation, never server authority.
- A portable Provider host adapter exposes existing controllers or an injected
  allowlisted page/hash handoff. It constructs no browser redirect or transport.
  Only provider/enquiry IDs and fixed audience hints travel in routes; authenticated
  participant/block/publication checks remain inside server repositories.
- Shared existing main host now owns its mounted controllers' history listeners,
  delegates to existing Product/Store/Provider route parsers, supports #stores,
  refresh/back/forward and the existing Home service entry. Standalone feature
  mounts retain their original route behavior. Product/Store cross-links and
  original seller-authored combining Unicode are preserved.
- A reviewed scope bug is fixed: an unknown reply retains its original request
  key/body, but cannot be retried from another enquiry/provider scope. Mutations
  stay blocked until the original scope is reopened and reconciled or logout clears
  the session. Scope/page/offline invalidation removes retry eligibility.
- Malformed empty/inconsistent private history pagination now fails closed before
  exposing a selection or allowing another history request.

Evidence and exact commit/CI ledger follow after focused validation. Relevant logs
are /tmp/oldx-handoff-*.log, /tmp/oldx-handoff-results.json and focused browser logs.
Tests use loopback browser pages and injected SDK transaction mocks; they are not
local real Firebase tests. Existing GitHub isolated Emulator workflow is the actual
SDK/Rules evidence. Local Emulator download remains blocked; no bypass attempted.

Remaining P0 / next safe work:
- General buyer/provider text Chat send/read/receipt/delete integration is distinct
  from this canonical enquiry journal and remains unactivated; reuse existing
  messaging-intent contracts in the next repository-only batch.
- Full real Auth/runtime/session integration and native/device acceptance remain;
  injected page navigation must be supplied by an approved web/Capacitor host.
- Mandatory photo provider/processing/moderation/private delivery, trusted Admin,
  remaining whole-app locale/accessibility and staging end-to-end acceptance block
  complete website readiness. No agreed feature is removed or called live.
- Owner approvals required for operational runtime/schema/indexes/Rules, IAM/secrets,
  privacy/retention/image provider and real staging/deployment/launch. None assumed.

No live/staging Firebase/Cloudinary/HTTP, deployed Rules/indexes, main/merge, IAM,
secrets, billing, paid services, migration, native packaging or deployment actions.
Staging deny-all and HOLD/NO-GO remain. November 7 is a target, not a guaranteed launch.

Observed local validation:
- One selected six-script sweep: 259 executions, all pass: Provider atomic/integration
  105; existing Service/main Product/Store/public/private/new conversation browsers
  50; legacy conversation browser 7; i18n 11; static packaging 3; source safety 83.
  Commands are the existing npm scripts test:provider-draft:transaction,
  test:service-preview:browser, test:service-conversation:browser, test:i18n,
  test:static-build and test:emulator:safety. No full 34-script sweep repeated.
- Scope-retry hardening follow-up: 12/12 via node --test
  tests/integration/provider-private-client.test.mjs
  tests/browser/provider-private-integration.test.mjs
  tests/browser/provider-conversation-integration.test.mjs.
- Final scope/role/malformed-ID guards: 7/7 via node --test
  tests/integration/provider-private-client.test.mjs
  tests/integration/provider-journey.test.mjs. git diff --check passes.
- Browser evidence: gu/hi/en; 320/375px; all-element doubled fonts; unchanged
  Gujarati/Hindi/combining Unicode; real existing page hops and browser refresh/back;
  buyer read-only; provider reply lost-ack/retry writes one event; history windows
  20 then 2; private cleanup on logout and denial to foreign verified actor;
  actual main-page Product -> Store -> Product, #stores refresh, Home -> Provider
  route handoff and direct Provider/conversation routing. No off-origin requests.
These are overlapping execution counts, not unique coverage or live acceptance.
Source SHA and actual exact-source CI results are recorded in the subsequent ledger.
