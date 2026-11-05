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
It NEVER permits publication transactions yet: Provider atomic media integration is
not supplied. No option can override that restriction in this constructor.

## Current blockers, in order

1. Existing authorized oldx-staging Admin identity and restored official API access.
   Capture live project/Rules/data inventory, backup and rollback evidence first.
2. Reviewed server host/routes, verified Auth, role/actor eligibility initialization,
   rate policy and bounded public Provider native query binding. Existing modular
   Provider public-read contracts have Emulator coverage; native host is not wired.
3. Private Provider profile/work-photo reference schema and parent-revision binding;
   signed Cloudinary Free upload, durable journal, independent byte inspection,
   quarantine/moderation approval, private delivery/public release and withdrawal.
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
