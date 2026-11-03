# Durable private conversation/shared-host ledger — 3 November 2026

Branch: security-hardening-review only. Preserved checkpoint:
165ea82d22d1054771ba49b5175e3691b1070825.
Executable implementation: 6547cd0cfa31c280cbe567b700426d6207106db6.
Fresh fetch matched prior HEAD before commit; push succeeded without force or
concurrent-history changes. This following ledger is documentation only.

Completed source: existing public enquiry -> participant-only private inbox ->
existing conversation markup, canonical provider reply and bounded revision-pinned
history, back/refresh/logout/unknown-outcome recovery; existing shared main host
Product/Store/Provider entry/deep links with one history-listener owner. No competing
Auth/router/query/enquiry state model, no new demo page and no dependencies.
Unknown replies cannot be retried from a different enquiry/provider/audience scope;
original replay key/body stays only in memory, and mutations remain blocked until
original-scope reconciliation or logout. Private notes/drafts are never persisted
in URLs/storage/history state. A refresh rereads history rather than resending.

Local evidence: selected six-script sweep 259/259 executions; scope-hardening
private browser/unit follow-up 12/12; final integration/role/scope guards 7/7.
These overlap, not unique test coverage. Exact commands and limitations are in
[batch checkpoint](review-progress-2026-11-03-private-conversation-host.md).
Browser fixtures use synthetic data and injected transaction SDK mocks. 320/375px,
gu/hi/en, actual doubled fonts, authored Unicode, keyboard focus, participant
privacy, reply replay, 20+2 history paging, refresh/back and route recovery pass.

Exact-source GitHub CI for 6547cd0cfa31c280cbe567b700426d6207106db6:
- Branch Security 41689638969: success.
- Service SDK/Rules 41689639059: success (isolated Emulator, not live Firebase).
- Review Safety 41689638866: success.

Remaining P0: full buyer/provider general text Chat send/receipt/deletion (this
binding displays the existing enquiry journal, not a new general Chat store),
mandatory-photo operational integration, trusted Admin, real Auth/runtime,
remaining whole-app localization/accessibility/device QA and staging acceptance.
No previously agreed feature or launch gate is dropped.

Exact next safe repository batch: inspect existing enquiry-message intent and
product-conversation transaction/HTTP contracts; implement/reuse an inactive
participant/block/publication/revision-safe Service text-message repository and
read/send ports, prove replay/cross-account/withdrawal behavior in isolated tests,
then bind the existing conversation UI without replacing the canonical enquiry
journal or enabling real endpoints. Do not redo completed private inbox/navigation.

Owner approvals needed before real staging: operational schema/indexes/Rules,
Auth/runtime/IAM/secrets, privacy/retention and media-provider policy, explicit
staging/deployment and release approval. None assumed. No main, merge, live data,
provider actions, Rules/index deployment, IAM/secrets, billing, paid services,
migration, native packaging or deployment used. HOLD/NO-GO; November 7 is a target.
