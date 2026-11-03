# OLDX feature-completion matrix — 2 November 2026

Source review only; no live app, Firebase data, provider configuration or mobile
runtime was tested. “Present” means repository implementation, not live acceptance.
Release remains HOLD/NO-GO. No percentage completion is inferred.

| Feature | Present in source / verified synthetic behavior | Still missing or inactive | Owner/activation gates |
| --- | --- | --- | --- |
| Service Providers | Isolated multi-service draft, bounded asynchronous category/locality public discovery with default-disabled repository, scoped signed-cursor contract, independent canonical-publication detail repository, private authenticated draft preparation and disabled atomic draft transaction port, emulator-locked modular SDK mapping and inactive atomic publication materialization, verified HTTP command composition and consistent SDK public-read bridge, disabled existing-UI session/retry binding, v1 schema/identity composition and private owner bootstrap/reconciliation, public profiles, same-page sharing and local buyer-enquiry rehearsal and provider and buyer sample inbox/status/response rehearsal with participant checks, cancellation/dispute and sample confirmation (not sent/booked; no review grants); projection, QR/share helpers and policy/Rules candidates have tests | Real save/edit, trusted discovery/contact, enquiries/completion/reviews, portfolios, real public/crawler routes | Approved runtime/schema, identity/consent, contact/media, Rules/indexes, publication and deployment |
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

[Current HTTP/public-read checkpoint](review-progress-2026-11-02-http-public-read-batch.md)
adds disabled reusable composition, fail-closed role/rate/token interfaces and
consistent snapshot bridging. All SDK paths remain demo/loopback-only; no active
route, real verifier/rate store, approved schema/IAM or live functionality. Existing
Login/Product/Store/Chat and all release gates remain unchanged.

[Current UI integration checkpoint](review-progress-2026-11-02-ui-integration-batch.md)
adds existing-form/read-renderer bindings, session cancellation and same-key unknown
retry behavior. Real endpoints remain absent; SDK/token/role/quota adapters are only
isolated fixtures, not a launched Service journey. No new demo page or legacy rewrite.

[Current v1/bootstrap checkpoint](review-progress-2026-11-02-provider-v1-bootstrap-batch.md)
records owner-approved Gujarat-first text-only design and unactivated versioned
paths/indexes, one-owner opaque allocation and read-only private recovery. Design
approval does not activate schema/runtime/IAM/Rules/migration/deployment or settle
privacy/retention policy. Existing legacy and future media/review scope preserved.

Latest [owner HTTP/UI + photo checkpoint](review-progress-2026-11-02-owner-photo-batch.md)
connects the disabled v1 owner-private read to authenticated/rate-limited HTTP and
existing form ports. Explicit restoration and current-counter receipt reconciliation
remain separate from public UI; unknown receipts retain original request keys.
No actual transport or live account integration is enabled. [Photo source audit and
candidate contract](photo-storage-audit-and-inactive-adapter-2026-11-02.md) distinguishes
Store unsigned Cloudinary uploads from Product/avatar/Chat Firestore data URLs and
unimplemented Service photos. A test-only injected quarantine/delete lifecycle is
source, not real Cloudinary integration, decoder, journal or media activation. Legacy
images remain unchanged. Text-only launch and all owner gates remain the priority.

## November 7 target checkpoint

[Prioritized launch register](launch-decision-register-2026-11-07.md) now distinguishes
source-ready, isolated-test-ready, staging-required and production-blocked work for
every essential journey. The target is conditional; all P0 requirements and
HOLD/NO-GO remain. Mandatory photos and whole-app localization are not removed by
using an intermediate text-only Service staging milestone.

New [integration contract](media-journal-and-enquiry-integration-contract.md): disabled
private enquiry creation reuses existing validation/status/verified-operation and HTTP
ports, atomically requires private record/receipt/audit, and maps verified participant
reads into the existing DTO. Mock acceptance composes opaque owner draft, publication,
two-Provider discovery generation, private enquiry and withdrawal. Real enquiry SDK
persistence, trusted graph/actor/block reads and actual UI/runtime remain missing.

Media now has a test-only bounded atomic in-memory journal for upload/reference/
replacement/delete leases, quota reservation, same-key replay and uncertain provider
reconciliation. Compatibility descriptors preserve Base64/Cloudinary/legacy references
without claiming ownership or migrating anything. Service photo descriptors remain
an unactivated future schema extension. Durable journal, actual decoder/moderation/
provider credentials/delivery, parent transactions and retention are still missing.
Legacy Search now tolerates missing/non-string Product fields; no authored text or
existing storage/Login/Store/Chat/Admin behavior was otherwise changed.

[Durable SDK launch checkpoint](review-progress-2026-11-02-durable-launch-batch.md):
Provider enquiries now have isolated actual SDK create/cancel/audit/receipt and fresh
private participant snapshots, plus existing HTTP cancellation composition. Products/
Stores have default-disabled SDK owner/public/private/publication/revision/pagination
source and photo references have durable parent-scoped private transactions. Real
SDK Emulator evidence is separate from mocks; operational runtime/UI/Rules remain
inactive. Essential Search/Login controls in index.html now use gu/hi/en, with exact
password-byte handling and generic credential-error fix. Whole-app localization,
actual uploads/deletion/delivery, full trusted UI integration and P0 staging/device/
security acceptance remain missing. No agreed requirement removed; HOLD/NO-GO.

Latest [media delivery/journey checkpoint](review-progress-2026-11-02-media-delivery-journey-batch.md)
adds Emulator-locked durable media quota/attempt/registry/delete/reconciliation source,
approved-derivative public projection and private token/redemption contracts. Provider
owner and buyer now share session-safe injected ports; SDK acceptance covers private
create/read/cancel without activation. Marketplace archival retains private images;
legacy Chat now shows the latest 35 in chronological order. No provider/processor/
public release/byte gateway, service-worker cleanup, full UI/locale/native integration
or operational readiness is claimed. All agreed requirements, HOLD/NO-GO and staging
deny-all remain. New client logic is platform-neutral; native packaging is not started.

[Processing/release checkpoint](review-progress-2026-11-02-processing-release-batch.md)
adds real bounded codec sanitization and inactive independent SDK image moderation /
atomic Product/Store media publication/withdrawal. Published references survive private
edits and block deletion until revoked. Provider public photos, trusted scan/proof /
real provider copies/private delivery, full UI/locale/review/device/runtime acceptance
remain missing or inactive. Chat ordering is now tested by executing the actual render
callback; dynamic Chat labels use gu/hi/en. No live images, migration, backend or native
build is activated. All requirements and HOLD/NO-GO remain.

## 3 November: Product private conversation integration and media P0 fixes

The existing isolated Marketplace SDK now composes with an inactive Product
conversation SDK and HTTP port: verified seller creates/publishes, buyer discovers
curated Product data, buyer opens a private thread, seller reads a bounded inbox
and responds, buyer reads revision-bound history. Atomic receipt/message/audit
writes reconcile a lost acknowledgement without duplicate delivery. Current
listing publication/owner eligibility, participant eligibility, bidirectional
blocks and Store ownership are revalidated. Private notes/UIDs are absent from
public discovery; private HTTP responses are no-store and strictly projected.
This is injected SDK integration, NOT a live endpoint or Login/UI acceptance.
Existing legacy forms and Chat remain intact; their opt-in trusted transport and
session/UI lifecycle binding remain the next integration gap. Inbox is a bounded
first window, not a complete paginated inbox. No completion/review grant exists.

Operational public-photo reads now require the independent release schema and
fresh publication/review/moderator/publisher authority. Legacy self-asserted asset
approval cannot authorize delivery. Verified provider proofs are normalized once
into flat frozen descriptor-value snapshots, binding operation/image/nonce/path/
revision/source or asset identity before journal transitions. PR #10 was inspected,
not merged. Legacy Base64/Cloudinary data is retained, not newly exposed.

Evidence and exact-source CI: [P0 Product/media checkpoint](review-progress-2026-11-03-p0-product-media-batch.md). Corrected `adb70f1`: Review-safety 41636421806 and Service Emulator 41636421754 attempt 2 passed; 29 actual Service/SDK cases. The first-attempt Service enquiry concurrency failure remains documented.
All production/staging, Rules, media-provider and release gates remain unchanged.

## Product existing-UI integration checkpoint, 3 November

Default-off Product controller/DOM binding now joins existing form, discovery,
public detail and private inbox/Chat to injected Marketplace SDK and verified HTTP
ports. Isolated existing-markup browser journeys cover save/edit/publish, selected
photo preview, buyer enquiry and seller response at 320/375/768/1280px, gu/hi/en,
large text and uncertain-write/session recovery. Legacy decimal price validation
was corrected. This is not real Login, an active endpoint, public photo delivery,
global indexed search, owner bootstrap after reload or live acceptance. Store,
Service, Admin, reviews and all mandatory-photo requirements remain in scope.
See [Product UI evidence](review-progress-2026-11-03-product-ui-batch.md).

Verified Product UI source `a502283`: exact-source Review-safety **41641209311**
and Service Emulator **41641209303** passed on first attempts, actual SDK/Rules
**30/30** including repeated forced-overlap enquiry scenarios. Main source `4501d4a`
also passed all three workflows. Final acknowledgement-scope regression tests reject
foreign Product/thread replies and retain retry keys. Historical concurrency failure
cause is not invented; see the checkpoint for evidence and remaining boundaries.

## Product/Store recovery batch — 3 November

Default-disabled owner-private receipt/revision recovery, actual Product/edit/Chat
hash refresh/back/forward, participant metadata, bounded history and scoped inbox
pagination are implemented. Existing Store form/public wrapper now has injected
owner/edit/publish/withdraw/catalogue/share ports. Exact Product Unicode survives
Store projection and UI language changes. No real endpoint/Auth/photo/deployment is
active. Full Store directory/multi-category compatibility, Provider orchestration,
Chat/Admin/media and real acceptance remain P0. See
[recovery batch evidence](review-progress-2026-11-03-product-store-recovery-batch.md)
for per-area status and exact local/CI distinctions; no percentage is inferred.

Recovery/Store source `347da399d629c4a15805c50ecd3e86219bd3c10d` passed all three
exact-source workflows first attempt: Review **41647604145**, Branch Security
**41647604146**, Service Emulator **41647604198** (32 actual SDK/Rules cases).
Local 34-script sweep: 878 test executions; additional final targeted checks are
listed in the checkpoint. No real staging/live acceptance or completion percentage.

Store directory milestone: default-off existing-grid discovery/filter/pagination and
bounded multi-category SDK support now preserve old single-category records. Shared
session fanout includes the existing Provider bootstrap scope; Provider full inbox/
reply integration remains incomplete. See [milestone evidence](review-progress-2026-11-03-store-directory-batch.md).
No live or staging functionality, media activation or release completion is claimed.

Verified Store directory source `0679ea63d1c3e0b97dba7aa2cd418ef8da694777`:
Review-safety **41652006446** and Service Emulator **41652006386** passed first
attempt (32 actual SDK/Rules cases). Initial OR-query grouping failure and corrected
real-SDK regression are recorded in the directory checkpoint. Provider session
fanout is preparation; full Provider inbox/reply/host wiring remains P0, not live.

Emergency Provider save (3 November): disabled canonical provider reply/status,
atomic private history, scoped inbox/history HTTP/UI and existing-markup recovery,
plus shared Product/Store host source implemented. Selected local 636 executions
and final focused 10/10 passed; actual new exact-source Emulator CI pending review.
See [emergency checkpoint](review-progress-2026-11-03-provider-emergency-checkpoint.md).
No live/staging or release completion claim; Provider public-host orchestration and
remaining media/Chat/Admin/privacy acceptance remain P0.

3 November Provider public-page follow-up: existing directory/category/locality,
bounded next-page read, independently fresh multi-service detail, safe preview
share links and private enquiry command/callback now share the existing disabled
ports and route controller. Local focused 46/46 plus final host/browser 14/14 pass.
Back/forward/refresh, offline/withdrawal, gu/hi/en and 320/375px doubled-text evidence
are recorded in [public-page checkpoint](review-progress-2026-11-03-provider-public-page.md).
Base 816ec80 exact-source CI is verified 3/3 successful, superseding the pending
note above. This is source integration, not active Firebase or launch acceptance.
Private conversation DOM/handoff, complete cross-page host, mandatory photos,
Chat/Admin/privacy/runtime and real staging acceptance remain P0. HOLD/NO-GO.

3 November private conversation/shared-host batch: existing public enquiry callback
can hand off to the participant-safe inbox and existing conversation markup. The
conversation displays canonical enquiry note/reply/status history with bounded
revision-pinned windows and provider-only reply commands; it is not a claim that
full buyer/provider Chat messaging is implemented. Shared main-page routing now
uses the existing parsers with one listener owner and preserves standalone mode.
See [batch checkpoint](review-progress-2026-11-03-private-conversation-host.md) for
focused mock/browser and subsequent exact-source CI evidence. All transports stay
default-disabled; mandatory photos, Chat/Admin/privacy/runtime/native-device and
real staging acceptance still block release. HOLD/NO-GO.
