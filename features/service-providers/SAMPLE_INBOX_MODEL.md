# Synthetic Service provider enquiry inbox model

Status: pure synthetic Node/browser model, now reused by the isolated inbox UI; no backend activation.

The model in features/service-providers/preview-inbox.mjs supports provider-scoped
sample enquiry lists, bounded all/new/active/closed filters, stable ordering and
a proposed local status-transition rehearsal. It intentionally has no network,
storage, user account lookup, messaging, review grant, contact or real publication.

Safety boundary:
- The caller must supply only authored synthetic fixtures; the published flag
  and actor labels are untrusted local simulation inputs, not authentication.
- Provider-scoped rows are projected through an explicit field allowlist.
  Customer IDs, phone, addresses, private messages, moderation/audit data and
  review eligibility are never forwarded.
- Unknown, withdrawn or malformed provider state fails closed. Invalid scoped
  rows, duplicate IDs, invalid filters and invalid transitions fail closed.
- At most 50 supplied fixture rows and 20 returned rows are processed per call.
- Statuses follow the proposed Service UX contract. A provider may accept or
  decline a new request, progress accepted work and request completion; only a
  simulated buyer may confirm/dispute completion. Neither simulation is proof
  of real completion or authorization.
- No live Service profile, enquiry or Rules integration is present. A real
  endpoint must verify authenticated identity, ownership, publication,
  current state, consent, rate limits, atomic updates and append-only history.

Evidence: local Node 22 syntax checks and node --test
features/service-providers/preview-inbox.test.mjs passed 6/6 on
2 November 2026. Repository-wide CI and actual Firebase Emulator evidence
for this new model are separate and must be verified after commit.

Historical next task (now completed by the integration below): wire an explicitly sample-only accessible inbox/status UI to
the existing Service preview with Gujarati/Hindi/English, 320px/200%-text and
keyboard tests. Do not activate real send, persistence or reviews.


Integration follow-up: the separate `preview-inbox-controller.mjs` now provides
the sample UI with local private-detail/reply/revision handling in an adapter.
The model code and original tests are unchanged. See `ENQUIRY_INBOX_CONTRACT.md`
for mapping, actor/transition limitations, current Node 24/browser evidence and
remaining trusted-backend approvals. The former next UI task above is completed
in the combined integration checkpoint, not a claim of real messaging or Rules.
