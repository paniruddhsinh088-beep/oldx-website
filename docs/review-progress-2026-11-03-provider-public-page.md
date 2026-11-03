# Provider public-page integration checkpoint — 3 November 2026

Branch: security-hardening-review only. Base 816ec804597a673c9b28a63c460326578490cb86
preserved; fresh fetch matched local HEAD. Owner requested P0-only work and focused
checks. No dependencies, new pages, framework/router/Auth replacement or live ports.

Implemented source (explicitly injected, default disabled):
- Existing Provider directory/category/locality controls issue bounded discovery
  through existing public ports. Exact supported city resolves only to a unique
  service area; ambiguous areas fail closed. Next-page cursors stay opaque. Free
  text/availability/sort operate on the loaded bounded page, not a global search.
- Existing profile route independently rereads current public detail, displays
  multiple original-language services and retains safe sample-page sharing links.
  Browse/detail/back/forward/refresh use the existing hash-route controller.
- Existing enquiry form uses the canonical buyer controller and private command
  port, retaining unknown-outcome retry identity and rejecting repeated submission
  while busy/uncertain. Only the created enquiry identity reaches an injected
  private-navigation callback; no note enters public rendering or share payloads.
- Public loading/recovery, exact-area feedback and private enquiry outcomes have
  gu/hi/en app copy. Route/session/offline/withdrawal clears stale public details
  and private form content. App-created categories do not translate authored data.
- Existing shared navigation port can call this page's discover/detail/enquiry
  methods; enquiry navigation revalidates detail before moving keyboard focus.
  Route ownership is explicit so late generic hash listeners cannot cancel the
  fresh read started by the page's own route handler. No competing query model.

Local observed checks:
- Focused public/legacy Provider browser + private lifecycle/integration + i18n +
  static packaging: 46/46 pass. Command:
  node --test --test-isolation=none tests/browser/provider-public-integration.test.mjs
  tests/browser/service-preview.test.mjs tests/integration/provider-private-client.test.mjs
  tests/integration/provider-journey.test.mjs features/i18n/i18n.test.mjs
  scripts/build-static-assets.test.mjs
- Final updated public/shared navigation, private inbox, existing Product/Store host
  browser checks: 14/14 pass via node --test tests/browser/provider-public-integration.test.mjs
  tests/browser/provider-private-integration.test.mjs tests/browser/product-integration.test.mjs
- gu/hi/en, 320/375px, all-element doubled fonts, keyboard retry/enquiry focus,
  offline recovery, withdrawal, refresh/back/forward and zero off-origin requests.
- Logs: /tmp/provider-public-focused.log and /tmp/provider-host-final.log.
  Restricted-shell localhost EPERM was resolved with the environment network
  permission profile; that initial attempt was not a passing browser test.
  No full 34-script suite repeated. Git diff --check passes.

Previous source 816ec804597a673c9b28a63c460326578490cb86 now has verified successful
exact-source CI: Service SDK/Rules 41661993525, Review-safety 41661993666, Branch
Security 41661993580. This supersedes its emergency checkpoint's pending-CI note.
This batch's exact source SHA and CI are recorded in the following ledger commit.

Remaining P0 / exact next batch:
1. Complete trusted private conversation DOM binding and existing inbox ->
   conversation handoff with participant checks; current callback is an injection
   boundary, not a claim that a real conversation endpoint is connected.
2. Finish single approved host/cross-page native navigation acceptance and full
   shared Home/Store-directory/Provider entry wiring. Product -> Store -> Product
   is already tested; do not rebuild that or the completed private inbox.
3. Mandatory photos, real Auth/runtime, privacy/retention, trusted Chat/Admin and
   whole-app/device QA still block launch. No full-text global Provider query or
   canonical production sharing/OG route is asserted by this bounded page work.
4. Owner approvals still required for operational schema/indexes/Rules, runtime,
   IAM/secrets, image provider/privacy/retention, real staging and deployment.

All live/staging Firebase/Cloudinary/HTTP bindings remain inactive. No Rules/index,
IAM/secrets, provider account, billing, main, merge, migration, spending or deployment.
Existing Products/Stores/Chat/Admin and authored Unicode retained. Platform-neutral
ports stay suitable for later Capacitor; native-device acceptance remains untested.
November 7 is a conditional target; HOLD/NO-GO remains unchanged.

Saved implementation milestone: 00fd7ec3ca2a263ea503fe67d3d61476f1364e96,
pushed without concurrent changes. Final locale follow-up preserves the private
in-memory enquiry fields only when the same validated public profile remains
selected during catalog repaint; scope/session/offline cleanup still clears them.
Updated three-language browser regression passes 3/3, including language changes
with an authored Gujarati buyer note. Log: /tmp/provider-public-locale.log.
