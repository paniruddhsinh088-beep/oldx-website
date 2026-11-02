# OLDX feature-completion matrix — 2 November 2026

Source review only; no live app, Firebase data, provider configuration or mobile
runtime was tested. “Present” means repository implementation, not live acceptance.
Release remains HOLD/NO-GO. No percentage completion is inferred.

| Feature | Present in source / verified synthetic behavior | Still missing or inactive | Owner/activation gates |
| --- | --- | --- | --- |
| Service Providers | Isolated multi-service draft, category/locality discovery, public profiles, same-page sharing; projection, QR/share helpers and policy/Rules candidates have tests | Real save/edit, trusted discovery/contact, enquiries/completion/reviews, portfolios, real public/crawler routes | Approved runtime/schema, identity/consent, contact/media, Rules/indexes, publication and deployment |
| Store catalogue/detail | Legacy Store UI in index.html; isolated bounded catalogue, sorting/filtering, 3-language mobile UI, independent mock detail publication checks, async race/timeout/cache guards | Trusted public/private split, real bounded reads/cursors, migration, fresh publication authorization | D1–D12, Store/seller resolution, consistency/revocation policy, indexes/Rules/compatibility |
| Store sharing | Legacy hash-link native/copy/prompt share code exists; Service transport reusable | Isolated Store copy/share is selected for this batch; real OG crawler metadata, approved photo/poster and canonical route remain absent | Real route/runtime/media decisions, photo consent/moderation and explicit deployment; a hash link alone does not create OG previews |
| Chat | Legacy message UI and bounded 35-message listener; plain-text rendering; privacy, receipt, block, message/lifecycle models and private-state candidate Rules tests | Trusted send/attachments/deletion/receipt integration, full compatibility and actual security acceptance | Server membership/block/ownership enforcement, media, retention/privacy decisions, backend/Rules activation |
| Admin | Dependency-injected authz/HTTP/read/client helpers and fail-closed tests | Real endpoint/service identity, complete reads, mutation schemas + atomic audit adapter; legacy Admin remains unsafe to connect | Approved roles/runtime/IAM/secrets, collection timestamp/index evidence, mutation policies and rollout |
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

Selected next user-facing task: synthetic Store copy/native sharing with explicit
sample-only copy, canonical same-origin sample links, query stripping, lifecycle
invalidation, manual fallback and mobile/locale tests. Reuse the existing transport;
do not touch legacy app behavior or imply real metadata/posters are available.
