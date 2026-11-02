# Synthetic provider inbox and inactive enforcement proposal

`service-inbox-preview.html` is a separate local rehearsal linked from Services.
It selects authored sample providers and at most 24 in-memory sample records.
Selection is explicitly not login. Seed notes are generic authored fixtures,
not real buyer information. No buyer form is secretly submitted to this page.

Status/service filters return only ID/service/status/revision summaries. Notes,
buyer IDs and replies do not appear in lists, URLs, sharing, export or storage.
Detail access is scoped to the selected sample provider and its listed service.
Local replies are bounded plain text; editing/reviewing is not sending. Provider
switch, withdrawal, route recovery and page lifecycle clear detail/draft state.
Changing locale preserves authored notes and same-scope draft replies. Page-cache
checks dispatch synthetic lifecycle events; real device/cache QA remains required.

## Executable proposed authorization and transition matrix

`preview-inbox-model.test.mjs` exercises caller and state/action cases. These are
inactive proposal expectations, not production role enforcement. A caller role/ID
in this demo is synthetic context, never a trusted identity or a permission grant.

| Proposed caller | Scoped detail | Proposed actions |
| --- | --- | --- |
| Guest / unknown buyer / other provider | Denied | None |
| Linked provider | Own provider + service only | New → viewed/accepted/declined/cancelled; viewed → accepted/declined/cancelled; accepted → in-progress/cancelled; in-progress → completion-requested/cancelled; pending completion → cancelled |
| Linked buyer | Own enquiry only | Cancel new/viewed/accepted; confirm own completion-requested → completed |
| Admin/support | Denied pending approved support policy | No automatic override |

Provider reply preview is available only in nonterminal states. Completed,
declined and cancelled are terminal in this demo. Expected revision must match;
stale/replayed mutations, identity/provider mismatches, malformed records,
unsupported service/status, oversized/unsafe text and withdrawn contexts fail
closed without returning private data. Completed seed records include synthetic
buyer-confirmed flags; the provider UI cannot confirm completion. Those flags
and any local completed state **never** grant reviews, verified work or bookings.
Sample cancellation/withdrawal rules are not a decision about real cancellation
windows, payment consequences, dispute handling, retention or historical access.

## Required trusted backend before any activation

Follow the Service roadmap/feature contract and D1–D12 approvals. Resolve actor
from a verified token and canonical provider/enquiry ownership, not request role,
UID or client flags. Store enquiry/service/provider/buyer association immutably;
check publication/consent, participant access and block/rate/size policy. List
queries must be bounded and scoped by trusted participant/provider/status/service,
with approved indexes/cursors; never download a private collection then filter it
in a public browser. Rules authorize documents, not field redaction.

Approve an actual state machine, cancellation/dispute/withdrawal/retention policy,
support access/reasons/audit, timestamp semantics and idempotency before writes.
Apply revision/state checks and state-history/audit atomically. Buyer completion
confirmation must be independently authenticated; one eligible review, no self or
duplicate review, and moderation must be server-enforced. Real notes/replies are
participant-private and must not enter public profile/search/analytics/logs.

Actual Rules/adapter tests must cover guest, buyer A/B, provider A/B and approved
support identities; direct get/list, forged IDs/roles, stale concurrent mutations,
withdrawal, cancellation, confirmation, private-field leakage, revocation and
migration compatibility. Staging deny-all and all live/backend/deployment gates
remain. This page adds no schema, real enquiry, contact, persistence or API.
