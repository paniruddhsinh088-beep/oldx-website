# OLDX feature-completion matrix — 2 November 2026

Source review only; no live app, Firebase data, provider configuration or mobile
runtime was tested. “Present” means repository implementation, not live acceptance.
Release remains HOLD/NO-GO. No percentage completion is inferred.

| Feature | Present in source / verified synthetic behavior | Still missing or inactive | Owner/activation gates |
| --- | --- | --- | --- |
| Service Providers | Isolated multi-service draft, category/locality discovery, public profiles, same-page sharing and local buyer-enquiry rehearsal and provider and buyer sample inbox/status/response rehearsal with participant checks, cancellation/dispute and sample confirmation (not sent/booked; no review grants); projection, QR/share helpers and policy/Rules candidates have tests | Real save/edit, trusted discovery/contact, enquiries/completion/reviews, portfolios, real public/crawler routes | Approved runtime/schema, identity/consent, contact/media, Rules/indexes, publication and deployment |
| Store catalogue/detail | Legacy Store UI in index.html; isolated bounded catalogue, sorting/filtering, 3-language mobile UI, independent mock detail publication checks, async race/timeout/cache guards | Trusted public/private split, real bounded reads/cursors, migration, fresh publication authorization | D1–D12, Store/seller resolution, consistency/revocation policy, indexes/Rules/compatibility |
| Store sharing | Legacy hash-link share code exists; isolated Store now reuses Service transport for canonical sample copy/native sharing; responsive text-only sample card and safe local SVG export with cancellation/lifecycle guards | Real OG crawler metadata, approved real-photo poster and production canonical route remain absent | Real route/runtime/media decisions, photo consent/moderation and explicit deployment; a hash link alone does not create OG previews |
| Chat | Legacy message UI and bounded 35-message listener; plain-text rendering; privacy, receipt, block, message/lifecycle models and default-disabled enquiry-message intent and private-state candidate Rules tests | Trusted send/attachments/deletion/receipt integration, full compatibility and actual security acceptance | Server membership/block/ownership enforcement, media, retention/privacy decisions, backend/Rules activation |
| Admin | Dependency-injected authz/HTTP/read/client helpers, cancellable deadline-bounded read client, descriptor-safe mutation validation and fail-closed tests | Real endpoint/service identity, complete reads, mutation schemas + atomic audit adapter; legacy Admin remains unsafe to connect | Approved roles/runtime/IAM/secrets, collection timestamp/index evidence, mutation policies and rollout |
| Localization/accessibility | gu/hi/en preview catalogs, lazy loading/fallback, local allowlisted preference, narrow-screen/enlarged-text/focus tests | Whole-app/auth/settings/first-launch flow, private account sync, native-speaker review and real device QA | Approved private preference/backend path if synced; release QA |
| Privacy/uploads/account lifecycle | Inventories, migration/projection contracts and synthetic policy tests; staging deny-all preserved | Trusted upload/scanning, deletion/export workers, verified consent/retention/reconciliation | Provider/cost, storage/runtime, policy, identities/secrets, migration and actual Rules/integration evidence |
| Capacitor Android | Roadmap and web/mobile safety requirements only; no Capacitor/native project found | Bundled build, native navigation/deep links/permissions, real Android tests, signing/Play readiness | Web release gates first; separately approved resources, signing/account, Data safety/testing and release |

Evidence: [Service roadmap](../SERVICE_PRODUCT_VISION_AND_ROADMAP.md),
[Store roadmap](../STORE_PRODUCT_VISION_AND_ROADMAP.md),
[Chat contract](../CHAT_MESSAGE_OWNERSHIP_PRIVACY_AND_DELETION_CONTRACT.md),
[Admin review](../functions/admin-backend/ADMIN_BACKEND_SECURITY_REVIEW.md),
[locale boundary](../features/i18n/README.md),
[Android roadmap](../ANDROID_PLAY_STORE_ROADMAP.md),
[release audit](../SECURITY_AUDIT_AND_RELEASE_READINESS.md).

Completed selected user-facing task: synthetic Store copy/native sharing with
sample-only copy, canonical same-origin sample links, query stripping, lifecycle
invalidation, manual fallback and mobile/locale tests. Existing transport was reused;
legacy app behavior and real metadata/poster availability remain unchanged.


Latest review adds [synthetic Store card export](../features/stores/SHARE_CARD_PREVIEW.md)
and [local buyer-enquiry rehearsal](../features/service-providers/SAMPLE_ENQUIRY_PREVIEW.md).
Chat/Admin contracts and Android roadmap were rechecked: their source/runtime
approval gaps remain unchanged. No real chat flow, Admin endpoint, whole-app locale
wiring or Capacitor/native packaging was activated. New UI uses bounded in-memory
work, lazy existing locale catalogs and no new dependency/remote media. Real device,
font/viewer, native-language, backend authorization and release acceptance remain
separate evidence gates.


Latest provider work: [sample enquiry inbox and proposed enforcement matrix](../features/service-providers/ENQUIRY_INBOX_CONTRACT.md)
adds per-provider/service filters, private local detail/reply review, status actions,
revision checks and mobile locale recovery. It does not create real enquiries,
completion evidence, authenticated inbox access or reviews. Admin read-client
cancellation/deadline behavior is source-tested with mocks, not an active endpoint.
Chat's send/attachment/receipt/block/lifecycle integration remains gated; it was
reviewed without changing legacy Chat or adding a speculative rewrite.


Latest buyer work reuses the canonical enquiry model for scoped status tracking,
provider-response fixtures, cancellation/disputes and two-step synthetic completion.
No review permission or real service proof is granted. Chat's new intent is Node
policy preparation only, default-disabled and never imported by the browser. The
Admin validator fix rejects status accessors without executing them; no approved
mutation schemas/runtime were added. All real integration and release gates above
remain unchanged.
