# Inactive enquiry-linked messaging intent

`scripts/enquiry-message-intent.mjs` is a pure trusted-server composition proposal,
excluded from browser assets and disabled by default. It composes existing Chat
membership, sender and block policy helpers. It creates no chat, message, Firebase
query, product mapping, endpoint or provider resource. Tests explicitly enable
only an injected synthetic context; no real messaging policy is activated.

A future verified actor must match the canonical enquiry buyer or provider. The
server supplies current publication, revision, permission and both block facts.
Both block directions must be explicitly known false; missing/unknown block state
is not permission. The untrusted request permits only enquiry ID, expected revision,
bounded plain text and a request ID. It cannot select participants, sender, role,
product/chat ID, timestamp or collection. Output is an allowlisted private intent,
not an actual write or idempotency guarantee. No raw error or context is logged.

The existing send policy now also rejects an unspecified block flag rather than
assuming unblocked. Its positive test supplies verified false; sender/participant
and all existing delete/hide checks remain. This is policy-model evidence, not
live Rules or enforcement in legacy Chat.

Before real composition, approve the service-enquiry conversation namespace and
identity mapping rather than inventing a product ID for legacy product chats.
Require authenticated canonical reads, enquiry/service/participant ownership,
publication and bidirectional block freshness, scoped bounded message reads,
server-derived sender/time, atomic idempotency/rate limits, text/attachment policy,
participant privacy, cancellation/dispute/retention and support/audit decisions.
Never obtain these facts from browser flags. Actual isolated Rules/adapter tests
must cover forged actors, blocks/revocation between checks/write, duplicate request
IDs, private summaries, role changes and migration compatibility. D1–D12 and
runtime/provider/schema/deployment approvals remain HOLD/NO-GO.

The isolated conversation preview now shares only `features/chat/message-text.mjs`
with this intent. It does not bundle privileged scripts or enable messaging.
`scripts/service-integration-adapter.mjs` is a separate default-disabled response
projector for already-trusted profile/enquiry/conversation snapshots. Its canonical
fixture checks do not implement live token authentication, queries, pagination,
transaction freshness or Rules. See the conversation progress acceptance checklist.
