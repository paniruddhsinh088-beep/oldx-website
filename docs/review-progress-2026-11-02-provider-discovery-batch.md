# Bounded public Provider discovery — 2 November 2026

## Review/preservation

Read AGENTS.md, feature matrix, security/release HOLD and latest conversation-read
checkpoint. Fresh remote and clean branch matched `52756a5`. All previous Store,
Service, Chat, Admin, locale, accessibility and automation work preserved. No live
queries/data/Rules/deployment/provider resource, dependency, cost or Full Reset.

## Reusable discovery repository

Default-disabled, injected public repository composes the existing public profile
projector with a fixed public-view query plan. Trusted taxonomy/locality catalog,
exact request fields, page size 1–24 (+1 bounded sentinel), fixed ID ascending order
and explicit public field selection. It rejects unknown filters, cursor tampering/
foreign scope, extra/private response fields (including non-enumerable fields),
wrong service/locality relationships, malformed/duplicate/unordered/oversized rows,
unpublished or stale generation rows, and revocation during reads/cursor issuance.
No raw private documents or browser-side private filtering is permitted.

Cursor state binds schema/view, category, locality, page size, ID ordering, last ID
and publication generation. Fresh identical read replay intentionally remains
idempotent for safe retries. Changed filters/generation, expiry and foreign tokens
fail closed; restarting from page one is recovery. Every public mutation, withdrawal
and service/locality change must advance the trusted generation. This is an injected
repository requirement, not something the client can establish or enforce.

Server-only HMAC-SHA256 cursor codec is an additional reusable integration component:
key injection/copy, constant-time signature comparison, bounded token size and TTL,
clock/expiry/tamper rejection. No key was created/provisioned; unit tests use fixed
synthetic bytes. Codec is excluded from browser assets. Real key storage/rotation,
public-view materialization and snapshot freshness remain unimplemented/gated.

## User-facing readiness

Isolated synthetic discovery reuses the exact repository/planner and bounded-read
lifecycle. Local sample repository contains public authored fixtures only, with
opaque bounded in-memory sample cursor storage (not a production signing strategy).
Multi-service/locality filters, bounded pages, existing sample profile links,
loading/error/timeout/empty recovery, cancellation/revocation/page-exit clearing,
gu/hi/en interface, 320px/enlarged text and keyboard focus work without real data.
Seller-created names, service labels and locality text remain untranslated.

## Owner decisions and real acceptance

No approval is inferred. D1/D2 runtime/region, D4 budget/traffic, D7/D8 IAM/secrets,
D9 exact public/private schema/view/operations, D10 moderation, D11 rollback and
D12 rollout/acceptance remain. Public profile consent, trusted service/locality
catalog, deterministic ID/index/collation, generation consistency/atomic publication
materialization, cursor TTL/key rotation and withdrawal freshness must be approved.
Private enquiries/messages additionally require identity/namespace, retention and
support/dispute policy. Media, reviews and Android remain separately gated.

Before activation: actual SDK adapter must query only approved public fields/view
with enforced limits and required indexes; prove no private reads, cross-scope cursor
reuse, stale publication, concurrent withdrawal, sentinel leaks, role escalation or
legacy compatibility regressions with isolated actual Rules + adapter tests. Server
owns generation/cursor claims; HMAC alone is not publication authorization. Queries
must use the shared deadline/cancellation boundary; no live transport is supplied.
Staging deny-all and release HOLD/NO-GO unchanged.

## Broader roadmap and next task

Store publication/migration/trusted query gaps, Chat send/retention/attachments,
Admin endpoint/IAM/audit mutation adapters, whole-app locales and Capacitor/native
release/device gates remain. No speculative rewrites or parallel query models.
Next high-value safe task: implement an injected, inactive public Provider detail
repository that independently revalidates publication/generation and requested
identity before projection, then connect synthetic discovery-to-detail revocation
regressions. Existing sample profile links do not prove live publication freshness.

## Validation

Focused models, signed-cursor checks, four mobile/browser discovery flows and static
packaging passed. A new test initially filtered an unpublished fixture in the mock
query; corrected it to return the invalid row so boundary rejection was exercised.
Final review also corrected the mock publication counter to advance monotonically
after withdrawal and republishing; old cursors cannot become valid again. The
affected Service model command was rerun after this focused fix. No security
assertion was removed. Combined sweep and exact-source CI follow.
Local emulator binaries remain network-policy blocked; pure Node tests under an
emulator-named directory are not actual Rules Emulator runs.

All 33 non-emulator npm test commands passed in one combined sweep. After the
monotonic mock-generation fix, `npm run test:service-providers` passed 179 cases
(the sweep initially reported 178). No unchanged expensive suite was repeated.
`git diff --check` passed. Commands/counts from the combined sweep:

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
| `npm run test:chat-message-authorization` | 29 |
| `npm run test:account-deletion` | 7 |
| `npm run test:privacy-policy` | 12 |
| `npm run test:data-requests` | 7 |
| `npm run test:chat-privacy` | 9 |
| `npm run test:chat-block-policy` | 12 |
| `npm run test:chat-private-user-state` | 9 |
| `npm run test:service-providers` | 178 |
| `npm run test:emulator:guard` | 10 |
| `npm run test:service-preview` | 13 |
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
| `npm run test:service-discovery:browser` | 4 |

## Verified source and CI

Executable source: `138c4e216a5975f57a6bb084375ec1ea3f85b51d`.
All exact-source GitHub workflows completed successfully:
- [Branch security 41448604740](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41448604740)
- [Service Providers Emulator 41448604652](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41448604652)
- [Review safety 41448604651](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41448604651)

Existing isolated Emulator suites are actual CI Rules evidence, distinct from
local Node and mock repository tests. They do not validate an unimplemented real
public view, cursor secret store or publication writer, or authorize deployment.
Local checks include 179 final Service model cases, four discovery browser flows,
existing Service/Store/inbox/conversation browser regressions and cursor/Chat tests.

Fresh remote was unchanged at `52756a5` before source commit and normal push.
No concurrency reconciliation or force push was needed; prior history and canonical
automation model remain preserved. Branch deployment flag stayed false. Read-only
Vercel metadata returned no deployment for this exact SHA. Working tree was clean.
No main/merge/deploy/live Firebase/Rules/resources/costs/Full Reset action occurred.

This final evidence-only follow-up leaves verified executable source unchanged.
Feature matrix, owner gates and next safe detail-repository task above are current.
