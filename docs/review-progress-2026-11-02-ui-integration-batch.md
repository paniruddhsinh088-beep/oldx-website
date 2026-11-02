# Existing Service UI integration readiness — 2 November 2026

Reviewed AGENTS.md, fresh remote/log and clean `e7a1cac`, feature matrix, HTTP/public
read/SDK contracts, owner checklist and prior checkpoint. Preserved all previous
and canonical automation work. Only repository development and isolated tests at
zero additional spend authorized; no live Firebase/Rules/deployment/IAM/secrets/
billing/main/merge/resources/Full Reset.

## Completed source

Default-disabled existing Service UI binding and headless session coordinator connect
injected verified read/HTTP command ports. No new page or endpoint. Private draft,
publication and public discovery/detail remain distinct. Immutable pending keys/body
survive unknown outcomes and offline retries within the same session; replacement
commands blocked, callbacks generation-guarded, session/page/search abort and clear
stale/private state. No storage/token/pending-body exposure to public UI. Existing
public renderer and form/locale validation reused, gu/hi/en feedback and 320px/large
text controls. Real ports remain absent; enabled paths are isolated fixtures only.

Found existing Admin-only token verifier, reused its revoked-token SDK call pattern
in a separate disabled Provider enforcement adapter rather than trusting Admin claims.
Project/issuer/subject/time/tenant checks, trusted role/quota injections and isolated
HTTP pipeline tests. No real tokens verified, SDK Auth initialized or key provisioned.

Fixed a verified round-trip gap: normalized unspecified experience was null, but
private validation rejected that JSON value. Null now means the existing optional
unspecified value; actual SDK Emulator fixture verifies storage without inventing
experience. Other validation/ownership/publication rules unchanged.

[Integration contract and staging decisions](provider-ui-integration-contract.md).
Focused 189 Service model tests, existing 23 Service browser flows and 35
transaction/enforcement/integration cases passed. One new end-to-end fixture initially
used member role for a publish journey; corrected the trusted fixture to explicit
provider role (existing member-denial assertions preserved) and aligned its demo
project. No test/security gate weakened. Full sweep and exact-source CI below.

## Shortest next staging step

Owner must select actual schema/identity/runtime/IAM/privacy/rate/retention policy
and separately approve synthetic staging setup/Rules/transport/rollback acceptance.
Then replace injected fixtures with actual verifier/role/quota adapters, bind the
existing UI transport to approved same-origin ports and run real staged acceptance.
No live activation is authorized. Legacy Login/Product/Store/Chat preserved; staging
deny-all/HOLD/NO-GO unchanged. Next safe repository task: inactive owner bootstrap/
receipt-reconciliation port to recover draft revision/generation after reload or
lost acknowledgement without storing private drafts or exposing audit data.

All 34 local non-emulator commands passed in one comprehensive sweep. After the
final existing-form validation hookup, only the three affected integration browser
flows were repeated and passed (targeted name filter); unchanged expensive flows
were not repeated. `git diff --check` passed. Commands and counts:

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
| `npm run test:chat-message-authorization` | 32 |
| `npm run test:account-deletion` | 7 |
| `npm run test:privacy-policy` | 12 |
| `npm run test:data-requests` | 7 |
| `npm run test:chat-privacy` | 9 |
| `npm run test:chat-block-policy` | 12 |
| `npm run test:chat-private-user-state` | 9 |
| `npm run test:service-providers` | 189 |
| `npm run test:emulator:guard` | 10 |
| `npm run test:service-preview` | 13 |
| `npm run test:service-preview:browser` | 23 |
| `npm run test:static-build` | 3 |
| `npm run test:i18n` | 11 |
| `npm run test:toolchain` | 2 |
| `npm run test:stores` | 81 |
| `npm run test:stores:browser` | 28 |
| `npm run test:stores:preview` | 3 |
| `npm run test:service-inbox:browser` | 7 |
| `npm run test:service-buyer:browser` | 6 |
| `npm run test:service-conversation:browser` | 7 |
| `npm run test:service-discovery:browser` | 6 |
| `npm run test:provider-draft:transaction` | 35 |
