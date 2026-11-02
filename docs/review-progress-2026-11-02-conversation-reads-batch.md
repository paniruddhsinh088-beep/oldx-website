# Bounded conversation reads and inactive Service executor — 2 November 2026

## Review and preservation

AGENTS.md, feature matrix, security/release HOLD and conversation checkpoint read.
Clean branch and fresh remote matched `7b4ef98`; canonical enquiry model, prior
Store/Service/localization/security and automation work preserved. No new dependency,
live backend/data/Rules, deployment, paid resource, Full Reset or main action.

## Concrete source changes

- Transport-independent single-flight read helper reuses existing Store deadline,
  AbortSignal, generation and cancelled-caller settlement patterns. Working Store
  modules were not rewritten. Deadlines capped at 30 seconds, safe errors, no cache.
- Conversation mock reads project an immutable scope-bound DTO through the existing
  canonical participant/provider/service/publication/revision checks. Maximum 35
  messages; invalid, foreign or oversized results fail closed. No partial history
  or invented pagination cursor. Blocks must be explicitly known false.
- UI clears history/drafts at load start, scope change, block, withdrawal and page
  exit. Delayed/failed/timeout/empty/malformed synthetic modes, loading announcement,
  retry/recovery and localized empty/error states use gu/hi/en. Locale changes do
  not restart reads or translate authored content. Stale completion and stale focus
  callbacks are generation guarded; drafts remain local and are never sent/saved.
- Default-disabled Node-only Service read executor composes injected authentication,
  trusted snapshot reads and the existing public/private response projector under
  the bounded lifecycle. Private identity is derived from authenticate, never the
  request. Public profile reads stay guest/public-only. Request accessors are
  rejected without execution; credentials and raw exceptions never enter output.
  Cancellation and timeout settle even when dependencies ignore AbortSignal.

This is reusable integration preparation, not an implemented identity provider,
permission-enforcing repository, HTTP endpoint or actual trusted Firebase read.
A production adapter must enforce canonical identity mapping and bounded queries
inside readSnapshot; current synthetic schemas are not production authorization.

## Minimum decisions for a first text-only Service slice

Start public text-only profiles, then private enquiry reads/transitions, then text
conversation reads; do not map Service conversations to fake legacy product IDs.
Owner must explicitly decide D1 runtime, D2 region, D4 budget, D7 service identity,
D8 secrets, D9 public/private collections/fields/operations, D10 moderation/support,
D11 rollback and D12 rollout/security acceptance. Message/enquiry retention (D6),
provider publication/contact consent, namespace/identity mapping, withdrawal/history
access and cancellation/dispute messaging need explicit policy. Media D3/D5 and
uploads/reviews remain out of scope and unapproved. None of these is assumed here.

Acceptance before real integration:
1. Verified token -> server actor -> canonical provider/service/enquiry membership;
   forged roles/IDs cannot select private reads. Guest profile output contains no
   contact/participant/admin fields; legacy private documents never reach clients.
2. Actual bounded query/index and scope-bound cursor tests; current publication,
   ownership, revision and both block facts checked with approved transactional or
   freshness guarantees. Revocation between checks and reads/writes fails closed.
3. Actual adapter + isolated Rules Emulator cross-account/revocation/replay tests,
   trusted ordering/time, transition/idempotency/rate limits and compatibility with
   existing product Chat. Timeout, cancellation and error DTO tests are not Rules
   authorization evidence or protection against billable server work on their own.
4. Approved retention/support access/incident controls and explicit resource and
   deployment authorization; preserve staging deny-all and HOLD/NO-GO meanwhile.

## Roadmap review and next task

Store public/private query/migration/publication gates remain. Chat trusted send,
retention/attachments/receipts remain inactive; Admin endpoint/IAM/mutation/audit
adapters remain absent. Whole-app localization and Capacitor/Android packaging,
signing/device QA are still gaps. No speculative rewrites or extra demo were added;
this batch invests in shared read infrastructure and reusable integration boundaries.

Next high-value safe task: implement a default-disabled, injected public Provider
repository query planner with strict field selection, bounded category/locality
filters and scope-bound pagination contracts, using existing public projections.
No real SDK/query, deployment or private-document browser filtering.

## Validation

Focused models and seven conversation browser flows passed. Prior synchronous
browser assertions were changed to wait for actual asynchronous completion; no
assertions or security cases were removed. Combined regression and exact-source CI
are recorded below. Local official emulator downloads remain environment-blocked;
Node model tests must not be described as actual Rules Emulator results.

All 32 local non-emulator commands passed in one combined sweep against this
source. `git diff --check` passed. Full commands and individual counts:

| Command | Passed |
| --- | ---: |
| `npm run test:emulator:safety` | 78 |
| `npm run test:profile-migration` | 11 |
| `npm run test:admin-backend` | 115 |
| `npm run test:firebase-config` | 6 |
| `npm run test:product-migration` | 11 |
| `npm run test:product-category` | 8 |
| `npm run test:product-image-classifier` | 9 |
| `npm run test:image-upload-contract` | 7 |
| `npm run test:image-lifecycle` | 8 |
| `npm run test:image-upload-abuse` | 12 |
| `npm run test:inbox-summary` | 5 |
| `npm run test:chat-read-receipt` | 5 |
| `npm run test:chat-message-authorization` | 27 |
| `npm run test:account-deletion` | 7 |
| `npm run test:privacy-policy` | 12 |
| `npm run test:data-requests` | 7 |
| `npm run test:chat-privacy` | 9 |
| `npm run test:chat-block-policy` | 12 |
| `npm run test:chat-private-user-state` | 9 |
| `npm run test:service-providers` | 174 |
| `npm run test:emulator:guard` | 10 |
| `npm run test:service-preview` | 12 |
| `npm run test:service-preview:browser` | 20 |
| `npm run test:static-build` | 3 |
| `npm run test:i18n` | 11 |
| `npm run test:toolchain` | 2 |
| `npm run test:stores` | 81 |
| `npm run test:stores:browser` | 28 |
| `npm run test:stores:preview` | 3 |
| `npm run test:service-inbox:browser` | 7 |
| `npm run test:service-buyer:browser` | 6 |
| `npm run test:service-conversation:browser` | 7 |
