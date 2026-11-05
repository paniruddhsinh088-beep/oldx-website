# Provider real-data source integration — inactive, staging only

The existing website can now explicitly compose `configureWebsiteProviderFirebase`
with an EXISTING oldx-staging Firebase Auth instance, reviewed server `sendCommand`,
and bounded public `reads` ports. Nothing invokes this composition automatically.
It does not initialize Firebase, install endpoints, create identities or enable flags.
Server token verification, role resolution, atomic rates and current ownership remain
mandatory; client uid/session values only cancel stale UI work.

The native `createStagingFirebaseProviderRepository` reuses the existing v1 atomic
create/edit/bootstrap/receipt/audit core, on the existing branded Admin SDK binding.
It is default-disabled, exact-project/Preview locked and has fixed v1 namespaces.
It denies publication unless supplied the binding-scoped native Provider media release
hook. That hook atomically validates independent review and commits image releases,
public generation, receipt and audit. Every operational option remains default-disabled.

## Current blockers, in order

1. Existing authorized oldx-staging Admin identity and restored official API access.
   Capture live project/Rules/data inventory, backup and rollback evidence first.
2. Reviewed server host/routes, verified Auth, role/actor eligibility initialization,
   rate policy and HTTP/public-read transport. Native Provider public query/detail
   binding is now implemented using the existing planner and fixed public SELECT;
   the operational host is not installed or activated. Existing proposed indexes
   in service-provider-v1.indexes.json still need real staging validation/approval.
3. Native Provider profile/work-photo journal, references, revision binding, independent
   review, atomic release/withdrawal and signed transport are now implemented in source.
   Owner upload/reference UI binding is implemented; verify actual provider behavior.
   Existing Product Base64 or Store Oldxbazar unsigned upload is NOT a safe substitute.
   Firebase Storage still requires an unapproved Blaze upgrade; do not enable it.
4. Server-only Cloudinary access, hard quotas, retention/deletion/moderation decisions
   and separately approved staging endpoint/flag/media activation. No secrets in chat.
5. Synthetic-account real staging acceptance: login/create/edit/multi-service/photos/
   search/detail/enquiry/logout/account switch/withdrawal, gu/hi/en, 320/375 and devices.

## Rules proposals (NOT deployed)

`provider-merged-firestore.rules` and `provider-merged-storage.rules` preserve the known
server-mediated deny-all baseline for Products/Stores/Provider/Users/Chats/Admin/media.
They do not add public or authenticated client writes, even to projected public views.
Admin SDK operations use trusted server authorization and bypass client Rules.
These are not a verified merge of current live policies: snapshot/reconcile live Rules
before any separately approved staging deployment. Do NOT deploy to Production or
replace a different live policy blindly. Root Firebase configuration is unchanged.
Firestore proposal is exercised by existing guest/owner/other/admin-claim Emulator
read/write tests. Storage proposal has source validation only, not new runtime evidence.
Legacy images and all existing deployed policies/data remain untouched.

Real Provider uploads/publication/search/contact are not activated. HOLD/NO-GO.

## Release checklist after native public-read batch

| Status | Requirement |
| --- | --- |
| Source-ready, inactive | Existing website UI, Firebase Auth/session ports, native private draft create/edit/read, bounded native public discovery/detail and cursor/revocation contracts |
| Source-ready, local only | Required profile + six work-photo selection; JPEG preparation now <=1024px/2MiB to match the trusted profile policy |
| Required configuration/acceptance | Verified oldx-staging server identity, Gujarat catalog, actor/role initialization, rate policy, trusted cursor codec, four proposed public-query index variants, actual HTTP host/transport and rollback evidence |
| Source-ready, inactive media | Native Provider journal, quota/receipt/delete leases, profile + six work references, independent moderation, atomic release/withdrawal, signed transport and disabled HTTP host. Existing public UI accepts approved delivery ports; owner upload-client wiring and pinned production sharp packaging are implemented. Real provider behavior remains unverified. |
| Privacy/moderation gate | Independent byte inspection, quarantine, moderation approval/revocation, quotas, retention/deletion and safe private/public media delivery; no automated moderation claimed |
| Rules review gate | Proposals preserve known deny-all baseline only. Actual deployed Products/Stores/Chat permissions must be snapshotted and reconciled before any owner-approved merge; no overwrite/deployment done. |
| Live blocker | No approved/installed runtime or real signed Provider upload path; no live data accessed. Synthetic-account staging and physical mobile acceptance have not passed. HOLD/NO-GO. |
