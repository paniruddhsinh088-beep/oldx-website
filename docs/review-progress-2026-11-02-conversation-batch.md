# Synthetic Service conversation and integration boundary — 2 November 2026

## Review and scope

Read AGENTS.md, feature matrix, buyer/Chat checkpoint, security/release HOLD and
owner decision register. Fresh remote and clean local HEAD matched `32f9782`.
Preserved all history, including automation `58356e2`; no competing enquiry model.
No live backend, messages, Firebase, rules, deployment, resources or paid services.

## Implemented

- Isolated conversation page linked from buyer/provider enquiry details. Both views
  project the same authored two-message history and preserve original multilingual
  sample text. Routes bind role/provider/enquiry; canonical reader binds service,
  participant, publication and revision. Unknown/foreign/revoked/blocked scopes
  clear private history and draft. Closed enquiries show history without drafting.
- Plain-text draft validation is shared with the existing inactive messaging intent.
  Normalization is also bounded after NFC (some Unicode characters expand).
  Preview does not append history, send, assign an ID, persist or log text. Cancel,
  scope/role change, block, withdrawal and page exit clear drafts. Locale changes
  translate interface/role labels, never authored text. No real identity claims.
- gu/hi/en, keyboard focus and recovery, 320px/200%-text browser checks; no new
  dependencies, remote media, attachments, receipts or review eligibility.
- Node-only default-disabled response adapter composes current profile projector,
  canonical enquiry reader and conversation projection. Strict request kinds and
  IDs/revision, publication, participant and explicit two-way block facts apply.
  Public profile DTOs and private enquiry/conversation DTOs stay separate. It has
  no transport/auth implementation; synthetic context is not production proof.

## Shortest safe integration path and acceptance

Start with text-only public provider profiles, then authenticated private enquiry
reads/transitions, then participant-bound text conversations. Reuse existing
projections and canonical state model, not legacy private document browser reads.
Store, uploads, reviews, Admin mutations and native release remain separate gates.

Owner decisions required before trusted integration: D1 runtime, D2 region, D4
budget/traffic, D7 IAM identity, D8 secret management, D9 exact collections/fields/
operations, D10 moderation/support access, D11 rollback owner and D12 staged release
acceptance. D3/D5/D6 media/quota/retention decisions remain unresolved; a text-only
slice does not approve attachments or waive message/enquiry retention decisions.
Approve the Service conversation namespace separately from legacy product chats,
provider/contact consent, withdrawal/history access, dispute/cancellation messaging
and support disclosure policy. No choices or approvals are invented here.

Acceptance before activation:

1. Trusted token -> server actor -> canonical provider/service/enquiry membership;
   browser-selected role, block flags, revision or publication never grants access.
2. Trusted bounded profile/public collection query; no contact/admin/participant
   fields. Public/private split, migration and real indexes have reviewed evidence.
3. Atomic canonical transition/revision/idempotency validation, current publication
   and bidirectional block checks; races/revocation fail closed. Trusted server
   timestamp/order and bounded, scope-bound message pagination/cursors.
4. Real adapter/Rules Emulator tests for cross-account reads, stale actions,
   revocation between check/write, request replay, private field leaks and existing
   product Chat compatibility. Current pure adapter tests are not this evidence.
5. Approved retention/support/moderation/rate limits and rollback; cost-reviewed
   staging-only resources and explicit deployment approval. Staging deny-all and
   release HOLD/NO-GO stay unchanged until separately authorized.

## Validation and continuation

Focused conversation model/browser and response-adapter tests passed. Combined
regression, pushed source commits and exact-source CI are recorded below.

Next meaningful safe task: replace the fixed conversation-history fixtures with an
injected bounded asynchronous mock read lifecycle, reusing existing cancellation/
deadline patterns, before any trusted message query is approved. Do not wire real
Firebase or treat the inactive response projector as backend enforcement.

## Local regression evidence

All 32 non-emulator npm test commands passed in one combined sweep. After final
Unicode-normalization hardening, the affected Service model (169) and Chat/adapter
(22) commands passed again; unchanged expensive suites were not repeated.
Browser flows all passed: Service 20, Store 28, provider inbox 7, buyer inbox 6,
conversation 4. Local model checks are not actual Firebase Rules tests. Official
local emulator binaries remain blocked by environment policy; CI is separate.

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
| `npm run test:chat-message-authorization` | 22 |
| `npm run test:account-deletion` | 7 |
| `npm run test:privacy-policy` | 12 |
| `npm run test:data-requests` | 7 |
| `npm run test:chat-privacy` | 9 |
| `npm run test:chat-block-policy` | 12 |
| `npm run test:chat-private-user-state` | 9 |
| `npm run test:service-providers` | 169 |
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
| `npm run test:service-conversation:browser` | 4 |

`git diff --check` passed. Starting-head documentation CI 41433833880 passed.
Fresh remote remained `32f9782` before commit; no concurrent changes required
reconciliation. Canonical enquiry automation remains untouched.
