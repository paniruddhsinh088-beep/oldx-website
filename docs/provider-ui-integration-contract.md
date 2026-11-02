# Disabled existing-Service UI integration

`features/service-providers/ui-integration.mjs` is an injected, default-disabled UI
coordinator. `ui-integration-dom.mjs` binds the existing Service form/controls and
localization; `configureProviderIntegration()` on the existing page defaults off.
There is no endpoint URL, fetch implementation, token storage, Firebase initialization
or production configuration switch. Explicit ports are used only in isolated tests
and future separately approved host composition. No new page or query model.

## Session and command safety

Host supplies UI cancellation scope `{uid,sessionId,revision,generation}`; none is
server authentication or authority. Actual command port must acquire the current
Firebase token for the same host session and use the verified HTTP composition.
Change sessionId on credential/user-session change, even for the same UID. Repeated
notifications for the unchanged scope preserve unresolved idempotency. Server
identity/roles/ownership/permissions remain enforced by existing command adapters.

Private draft normalization and save are distinct from explicit publication and
withdrawal. Saving never adds a draft to public results. Model observer snapshots
contain no pending profile/body/token/UID; public results require exact public DTOs
and the existing public projector. Model retains one immutable command body/key in
memory. Unknown outcome, timeout, offline and retryable enforcement/network errors
retain the same body/key; replacement save/publication is blocked until resolved.
A retry ignores form edits and sends the original body. Malformed success also
remains unknown; never allocate a fresh key after possible commit. Concurrent retry
calls are coalesced while loading. Known denied/conflict/validation outcomes clear
pending state; revisions/generations advance monotonically on successful receipts.
Historical publication receipt alone is not visibility: refresh public reads.

User/session/page cleanup cancels reads/commands and clears private form/envelopes.
Search/route scope changes cancel work, clear public state and preserve an uncertain
same-session envelope for explicit retry. Offline never auto-sends; online requires
explicit retry. No persistence across reload/logout: possible committed changes
must be reconciled via approved owner status/receipt reads on a later session.
No claim that cancellation rolls back a server commit.

Existing UI public cards/profile renderer accepts only validated read-port DTOs;
public reads and private command outcomes are separate channels. Search/route
changes abort stale work, and detail uses the existing read port independently.
The host must supply approved bounded discovery filter/pagination mapping and
bootstrap owner revision/generation; no server-wide free-text search is invented.
Existing preview filtering remains local to a prebounded public page. No real Login,
Product, Store or Chat wiring/behavior is replaced.

## Feedback/accessibility

Same page has disabled-by-default save/private publication/withdraw/retry controls,
localized gu/hi/en state feedback, accessible status/busy state and touch targets.
Loading, unknown, denied, conflict, offline, empty, withdrawn and unavailable states
clear stale public data. Seller-authored content is not translated. Existing form
validation/sharing/enquiry behavior remains separate and regression-tested.

## Verification adapters and limits

`scripts/provider-enforcement-adapters.mjs` is default-disabled, demo-project-only
and excluded from browser packaging. It reuses the existing Admin verifier's real
SDK call pattern `adminAuth.verifyIdToken(token, true)` without importing its
Admin-only permission rule. It verifies project/issuer/subject/expiry/issued-at and
rejects unapproved tenants, then returns UID only. Role lookup and atomic quota
consumption remain required trusted injections; token Admin claims do not grant
Provider publication. No SDK/app/secret/identity is initialized or provisioned.

Tests inject SDK Auth verification: delegation, revoked/foreign/expired errors,
role/quota denial/unavailability and HTTP request handling. These are not real
cryptographic Firebase token or IAM acceptance tests. Full injected UI -> HTTP ->
SDK transaction/public-read tests use fake storage and synthetic claims. Existing
actual Emulator suite verifies null/unspecified experience persistence as well;
`null` now round-trips consistently with the existing normalized public profile.

## First staging journey, still unapproved

Minimum named decisions: (1) actual text-only public/private schema/ID mapping and
indexes; (2) existing runtime/region/account free-quota eligibility, service identity
and secret/token verifier handling; (3) eligible member/provider role promotion and
separate publication consent/permission; (4) durable quota thresholds/ingress limits,
audit/idempotency retention and revocation/read budget; (5) synthetic-only staging
acceptance data/Rules/transport and rollback/sign-off. Recommended zero-spend default
is existing Firebase Auth/Firestore + existing Vercel architecture, one same-origin
text-only journey, bounded reads, manual reviewed publication, no uploads/SMS/reviews
or new infrastructure. If existing free quotas do not support it, stop; do not enable
billing. Recommendations and repository tests are not these approvals.
