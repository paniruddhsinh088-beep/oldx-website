# Verified command composition and consistent Provider reads — 2 November 2026

Reviewed AGENTS.md, clean fresh remote `1082539`, matrix, owner decisions, SDK/
publication contract, Admin HTTP patterns and checkpoint. Preserved canonical
models and all prior history. Repository-only/isolated testing approval only; no
live Firebase/Rules/deploy/IAM/secrets/billing/main/merge/paid service/Full Reset.

## Implemented

Default-disabled transport-neutral Provider command composition: strict raw JSON,
method/content/body limits, injected revocation-aware Firebase token verification,
trusted role resolver and fail-closed rate interface. Same verified-operation and
atomic draft/publication adapters, minimal no-store outcomes, safe deadline/abort/
unknown-commit responses. No route, new page, listener, SDK initialization or real
token verifier/rate infrastructure. Existing Admin patterns reused without rewrites.

Inactive public-read SDK bridge resolves the per-row/global-generation gap: fresh
bounded curated-public query, canonical ownership/publication barrier transaction,
final generation check, strict DTO/private-field rejection, existing query/cursor
and independent detail contracts. Shared emulator-only SDK guard and bounded-read
lifecycle; no production-connection capability. Older unchanged rows are accepted
only after consistent canonical revalidation; stale/withdrawn/cached rows fail closed.
No new query architecture or browser filtering of private documents.

[Full HTTP/read contract](provider-http-public-read-contract.md) documents costs,
interfaces, trust/role/rate/consistency requirements and limits. Added actual SDK
Emulator test for two profiles at different stored generations, command composition,
pagination/detail and withdrawal invalidating cursors. Existing Rules unchanged;
privileged test context and mock verifier/rate are not real IAM/token acceptance.

## Shortest path / approvals

Preserve existing Login/Products/Stores/Chat. Actual Service staging binding still
requires approved schema/index paths, canonical identity/eligibility/role promotion,
publication permission and generation discipline, runtime/IAM/secrets, real token/
role/rate adapters and privacy/retention/ingress/revocation budget. Only then connect
a minimal transport and existing UI to these ports, validate cross-account/security/
mobile acceptance, and obtain separate staging Rules/data/deployment permission.
HOLD/NO-GO and staging deny-all unchanged.

Next safe task: implement an inactive existing-Service UI transport interface with
abort/session-revision handling and stable idempotency-key retry behavior for unknown
outcomes, using injected command/read ports only, not a new demo or active endpoint.

## Validation

Focused command/SDK/read suite passed 31 cases. Full local sweep and exact-source
CI follow. Local official emulator downloads remain environment-blocked; actual
Emulator execution is CI evidence only. No existing security tests removed/weakened.

All 34 local non-emulator commands passed in one suitable combined sweep, including
31 command/transaction/SDK/read cases. `git diff --check` passed. No Rules file,
SDK dependency, endpoint or browser integration was activated. Exact commands:

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
| `npm run test:service-providers` | 183 |
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
| `npm run test:service-discovery:browser` | 6 |
| `npm run test:provider-draft:transaction` | 31 |
