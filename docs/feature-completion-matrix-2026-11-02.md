# OLDX feature-completion matrix — 2 November 2026

Source review only; no live app, Firebase data, provider configuration or mobile
runtime was tested. “Present” means repository implementation, not live acceptance.
Release remains HOLD/NO-GO. No percentage completion is inferred.

| Feature | Present in source / verified synthetic behavior | Still missing or inactive | Owner/activation gates |
| --- | --- | --- | --- |
| Service Providers | Isolated multi-service draft, bounded asynchronous category/locality public discovery with default-disabled repository, scoped signed-cursor contract, independent canonical-publication detail repository, private authenticated draft preparation and disabled atomic draft transaction port, emulator-locked modular SDK mapping and inactive atomic publication materialization, public profiles, same-page sharing and local buyer-enquiry rehearsal and provider and buyer sample inbox/status/response rehearsal with participant checks, cancellation/dispute and sample confirmation (not sent/booked; no review grants); projection, QR/share helpers and policy/Rules candidates have tests | Real save/edit, trusted discovery/contact, enquiries/completion/reviews, portfolios, real public/crawler routes | Approved runtime/schema, identity/consent, contact/media, Rules/indexes, publication and deployment |
| Store catalogue/detail | Legacy Store UI in index.html; isolated bounded catalogue, sorting/filtering, 3-language mobile UI, independent mock detail publication checks, async race/timeout/cache guards | Trusted public/private split, real bounded reads/cursors, migration, fresh publication authorization | D1–D12, Store/seller resolution, consistency/revocation policy, indexes/Rules/compatibility |
| Store sharing | Legacy hash-link share code exists; isolated Store now reuses Service transport for canonical sample copy/native sharing; responsive text-only sample card and safe local SVG export with cancellation/lifecycle guards | Real OG crawler metadata, approved real-photo poster and production canonical route remain absent | Real route/runtime/media decisions, photo consent/moderation and explicit deployment; a hash link alone does not create OG previews |
| Chat | Legacy message UI and bounded 35-message listener; plain-text rendering; privacy, receipt, block, message/lifecycle models and isolated participant-scoped buyer/provider conversation/draft rehearsal, bounded cancellable asynchronous history reads, default-disabled enquiry-message intent, response adapter and authenticated-read executor, and private-state candidate Rules tests | Trusted send/attachments/deletion/receipt integration, full compatibility and actual security acceptance | Server membership/block/ownership enforcement, media, retention/privacy decisions, backend/Rules activation |
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

Latest conversation batch: shared buyer/provider fixture history, block/withdrawal
recovery and private local draft preview now work in an isolated gu/hi/en page.
Node-only response composition is disabled and transport-free; public profile and
private participant DTOs are separate. [Acceptance path and exact owner decisions](review-progress-2026-11-02-conversation-batch.md)
prioritize public profiles → private enquiries → text conversations. None is an
approved or functioning live backend; whole-app and Android gaps are unchanged.

Latest read-lifecycle work adds reusable deadline/cancellation handling and a
default-disabled Service read executor with injected verified identity and trusted
snapshot interfaces. Public/private DTOs stay separate; no real repository, SDK
or endpoint is supplied. [Current decisions, acceptance and continuation](review-progress-2026-11-02-conversation-reads-batch.md).

Latest public discovery batch adds the fixed-field bounded repository planner,
server-only authenticated cursor codec and isolated mobile query preview. No real
public view, index, SDK, key storage or publication-generation writer is activated.
[Current source/acceptance checkpoint](review-progress-2026-11-02-provider-discovery-batch.md).

[Essential-journey source audit](text-only-marketplace-source-audit.md) distinguishes
legacy Firebase-backed source implementations from live acceptance (unverified)
and synthetic-only Service flows. [Minimum text-only launch owner decisions](text-only-launch-owner-decisions.md)
recommend existing-stack low-cost defaults without assuming billing/deployment
permission. Provider detail and draft preparation are inactive integration source,
not saved profiles or production-ready marketplace acceptance.

Latest private-draft transaction work adds verified actor/current ownership checks,
revision/idempotency conflicts, atomic audit/receipt/private-state staging and safe
unknown-outcome handling, using fake repositories only. [Transaction contract](provider-draft-transaction-contract.md)
and [current checkpoint](review-progress-2026-11-02-provider-transaction-batch.md).
Actual SDK persistence/publication adapters, identities, Rules and deployment remain
unimplemented/unapproved. Legacy Login/Product/Store/Chat source remains preserved.

Latest [SDK/publication checkpoint](review-progress-2026-11-02-sdk-publication-batch.md)
adds actual SDK transaction mapping and isolated Emulator integration coverage,
without a live server identity, approved schema, public read bridge or endpoint.
Repository/testing-only Firebase/Vercel zero-spend authorization is recorded; all
live/IAM/Rules/deployment/retention/release gates remain. Legacy journeys unchanged.
