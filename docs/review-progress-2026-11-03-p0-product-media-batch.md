# P0 Product/private conversation and media authority checkpoint — 3 November 2026

Branch: security-hardening-review only. Base safely fast-forwarded from 52f9e6d
to 7394dbf109878933405d88af59d4df183b598501 (two owner documentation commits).
All prior ancestry preserved. Open draft PRs were inspected; no PR was merged,
cherry-picked or duplicated. PR #10's descriptor/read mismatch was fixed directly
on canonical source. No overlapping local worker edits were present.

## Implemented source

- `scripts/firebase-media-delivery-read.mjs` and `media-delivery-contract.mjs`:
  missing independent release schema fails closed; no operational legacy approval
  branch. Every read requires current independent publication, revision/generation,
  review/hash, foreign moderator permission and publisher permission. Public DTOs
  contain only approved derivative identifiers; private Chat never falls back.
- `scripts/media-proof-snapshot.mjs`, `firebase-media-journal.mjs`: verifier output
  consumed once from flat data descriptors, frozen/prototype-free, exact operation/
  image/nonce/path/revision/source-or-asset bindings. Accessors, revoked Proxies,
  nested/private fields and check/get disagreement cannot alter journal authority.
  Transparent Proxies may normalize safely; JavaScript cannot detect every Proxy.
- `scripts/firebase-product-conversation-repository.mjs`: default-off actual modular
  Firestore SDK transaction/query mapping, hard-locked to demo project/loopback/test
  collections. Existing Marketplace save/publish/discover composes with buyer
  enquiry, private seller inbox/response and bounded revision-pinned history.
  Server-derived seller/participant identities, current publication, Store ownership,
  eligibility/suspension and explicit bidirectional blocks are rechecked. Message,
  thread revision, idempotency receipt and text-free audit commit atomically.
- `scripts/product-conversation-http.mjs`: inactive transport-neutral verified-token
  boundary, revocation flag, strict JSON/header/body limits, fail-closed injected
  rates, UID-derived repository binding, private no-store DTOs, cancellation/deadline
  and unknown-outcome retry semantics. No endpoint or real credentials exist.
- Shared acceptance cases run both with an injected fake SDK and from the actual
  Service Providers Emulator runner. They cover create/publish/discover/enquire/
  inbox/reply, gu/hi/en authored text, concurrency/replay, lost acknowledgements,
  malformed requests, guest/cross-account denial, stale revisions, blocks and
  withdrawal. Media negative cases cover absent/revoked reviews, revoked authorities,
  forged ownership/approval, stale publication/generation and unchanged quota/state.

## Executed local validation

One broad sweep: all 34 non-runtime-Emulator package test scripts passed, 854 test
executions, zero failures/skips hidden. Exact commands are the existing package
scripts, executed once via `/tmp/oldx-p0-regression.cjs`; results and per-command logs
are in `/workspace/work/p0-product-media-regression/`. Highlights:

- `test:provider-draft:transaction`: 83 pass (includes new Product and proof cases).
- `test:emulator:safety`: 83 pass (source/model checks, not actual Emulator).
- `test:admin-backend`: 115; `test:service-providers`: 196; `test:stores`: 81.
- Browser: Service preview/marketplace locale 29, Store 28, inbox 7, buyer 6,
  conversation 7, discovery 6. Chromium loopback fixtures only.
- Static build 3, i18n 11. No new browser/Node cross-import or dependency was added.

Local official Emulator binary download remains blocked; no bypass/untrusted mirror
was used. Exact-source GitHub CI results are recorded below after push. Neither mock
results nor candidate Rules prove deployment, approved IAM or live acceptance.

## Remaining P0 and next batch

This is repository integration, not an actually functioning public website. Existing
Login/Product/Store/Chat UI remains intact; trusted Product form/discovery/Chat session
binding, retry recovery, route/mobile/locale browser acceptance are the immediate
next source task. Seller inbox is a bounded first window, not complete pagination.
Chat delete/read-receipt/retention and review eligibility are not implemented by this
new port. Media bytes/provider delivery, Service v1 photo extension, whole-app copy,
moderation operations, privacy lifecycle and approved staging acceptance remain.

Before activation the owner must approve operational schemas/compatibility, identity/
eligibility/block bootstrap, privacy/retention, same-origin runtime/rate enforcement,
Rules/index candidates, provider/processor/moderation quotas and staging acceptance.
No recommendation is approval. No live Firebase/Cloudinary, deployment, Rules/index,
IAM/secrets, Vercel, billing, migration, main/merge or paid resource action occurred.
Legacy images are untouched. HOLD/NO-GO remains. November 7 web and conditional
November 14–19 Android targets remain targets; no native packaging started.
