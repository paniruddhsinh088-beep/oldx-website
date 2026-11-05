# Inactive Provider command client boundary — 2 November 2026

## Scope

`features/service-providers/provider-command-client.mjs` is a dependency-free, **default-disabled** client-side state boundary. It does not import a Firebase SDK, call fetch, create a route, read credentials, persist data, or activate any feature. It prepares bounded raw JSON for only `draft.save` and `publication.manage` and passes `{operation,body}` to an injected `send(command,{signal})` function. The transport and authenticated server verification/rate/role/transaction enforcement remain unimplemented and require separate approval.

Call `setSession(uniqueAuthRevisionKey)` after a verified session is established. This key is a local UI revision marker **not proof of authentication**; change it on logout, account switch, token/session replacement or role revocation. A session change aborts pending work, suppresses stale callbacks and discards the prior user's unknown-outcome command. `clear()` invalidates pending work and local retry state.

`submit(operation,payload)` rejects extra top-level keys, invalid request IDs/revisions, non-plain/accessor/prototype payloads, oversized JSON and excessively deep/large structures without executing getters. It serializes a detached snapshot before dispatch; caller mutation cannot change an in-flight request. Actual domain schema and authorization remain exclusively server enforced. Only fixed status/code information reaches `onChange`, not raw request bodies, bearer tokens, private profiles or backend error text.

A recognized HTTP 202 `OUTCOME_UNKNOWN`, a network failure, timeout, or unrecognized response retains the exact serialized body and request ID in memory. New submissions are blocked until `retryUnknown()` explicitly resends the identical bytes or `clear()`/session change discards the state. **Never auto-generate a new idempotency key on uncertain outcomes.** Clearing is a local UI decision, not proof that a backend write failed. HTTP 401/403/409/429/503 are terminal display states; users must revalidate identity/conflict/eligibility before a new command. There is no automatic retry loop, background task, durable queue or offline write.

## Review and acceptance gates

- Injected send must use an approved same-origin authenticated transport; never pass user-provided UID/role as authority.
- Bind to the inactive verified HTTP composer only after token revocation verification, trusted role and rate adapters, canonical schema, SDK permissions, privacy and ingress limits have been approved and tested.
- Provide a user-visible confirmation/reconciliation path for unknown outcomes, including session switch and reload (the retry state is intentionally **not** persisted).
- Validate actual Node 24 and browser/mobile lifecycle, authorization, multi-account, back/forward navigation, locale strings, no duplicate writes, and live-network error recovery before activation.
- No main, Firebase Rules/data, endpoint, Vercel deployment, paid resource, or release action is part of this change. HOLD/NO-GO remains.

## Evidence

Isolated local Node 22.16.0 `node --check` for both new files passed. `node --test features/service-providers/provider-command-client.test.mjs` equivalent isolated working-copy command passed **9/9** after fixing a cancellation listener that initially waited for the deadline. The working copy had no GitHub clone because DNS for github.com was unavailable. A ninth regression covers sparse arrays and pre-dispatch account switching. The PR also adds a targeted Node 24 step to the existing review-safety workflow; this is CI testing only, not deployment. Full repository, Node >=24.12, browser, Emulator and exact-source CI were **not yet verified at document creation**; the new test is included automatically in the existing `npm run test:service-providers` glob, and explicitly executed by the PR review-safety workflow.

This review branch starts from `security-hardening-review` at `e7a1cacaf3c135fb00196c5f2968680e1334f3b5` and is proposed back only to that branch. Concurrent Codex local-only work was not accessed or overwritten.
