# November 7 launch target: P0/P1 acceptance register

Updated 2 November 2026. November 7 is a target, not a guaranteed launch date.
**HOLD/NO-GO** remains; repository work is not staging or production acceptance.
No agreed Product, Store, Service, Chat, Admin, photo or gu/hi/en requirement is
removed. A text-only Service staging slice is an intermediate milestone, not the
complete marketplace launch. Media/reviews/contact/Android plans remain in scope
at their agreed roadmap stages; none is silently declared complete or dropped.

## Shortest dependency path

Existing Auth -> trusted verified identity/eligibility/quota -> curated public/private
Product, Store and Provider schemas -> atomic owner writes and publication -> bounded
public discovery/detail -> private participant enquiry/Chat -> managed photos and
privacy/account/Admin acceptance -> mobile/locale/end-to-end staging evidence ->
separate production approval. Reuse existing stack, UI, canonical state/identity and
bounded-read/verified-operation code; do not replace working legacy features.

Product and Store legacy source already has listing/save/browse journeys. Their
public documents still mix private fields, and writes/contact/uploads rely on browser
or unapproved backend policy. Connecting existing code to permissive Rules is not a
shortcut. Provider owner draft/publication/read composition is further along in
isolated integration, but it has no approved transport/runtime. Enquiry creation now
has an inactive atomic command, existing HTTP composition and private DTO mapping;
actual persistence/Rules/read freshness and UI activation are still required.

## Concrete checklist

“Source-ready” below means implemented repository component, not the whole feature.
“Isolated-test-ready” means deterministic mocks/models or named Emulator evidence;
none proves real IAM, a live identity, resource plan eligibility or deployment.

| Priority / journey | Source-ready | Isolated-test-ready | Staging-required / production blocker |
| --- | --- | --- | --- |
| P0 Login/session | Existing Firebase Login; injected revocation-aware token/role ports | Mock verifier/session cancellation | Approved Auth project/providers, real server verifier/revocation, logout/refresh/cross-account device acceptance |
| P0 Product browse/search/detail | Legacy bounded listing/rendering; partial-record search crash fixed | Existing security/category/projection/image checks plus actual extracted search-function regression | Curated public DTO read, private listing write/ownership/publication adapter, indexes, Rules and live-compatible acceptance |
| P0 Seller listing/edit/remove | Existing forms and staged photo removals | Source tests/model contracts | Server-derived owner, allowlisted mutable fields, concurrent revisions/idempotency/audit, denied-write/error recovery |
| P0 Store creation/catalogue/share | Existing Store save and display; synthetic bounded catalogue/detail/share | Model/mobile/locale suites | Private/public Store split, trusted seller/listing relationships, bounded actual repository, canonical route/OG and photo handling |
| P0 Provider registration/publish/discover | Disabled v1 opaque-owner, draft/publication, HTTP/private restore and public read components | SDK mocks and existing demo/loopback Emulator path | Actual schema/runtime/identity/role/quota/retention binding; approved indexes/Rules and same-origin transport; no private browser reads |
| P0 Private buyer/provider enquiry | New disabled atomic creation + no-store HTTP command + UID-derived participant DTO; existing canonical statuses | Concurrent/replay/lost-ack/withdrawal tests and composed draft -> publish -> discover -> enquiry case | Durable SDK enquiry repository, fresh canonical/block/actor graph, approved namespace/retention, real owner/buyer UI wiring; no auto review grant |
| P0 Text Chat | Legacy 35-message UI; inactive intent/read/privacy contracts | Policy, conversation/browser and candidate Rules suites | Trusted participant/block/send/receipt/delete/rate enforcement; actual idempotency, retention, private delivery |
| P0 Mandatory photos (Product/Store/Service plus existing avatar/Chat) | Inactive upload/delete lifecycle, atomic single-process journal, compatibility/photo descriptors | Quota/reference/delete races and unknown-outcome tests; no provider API calls | Provider/runtime/credentials, trusted decoder/scan, durable journal + references + moderation, public/private delivery, quota hard stops; Service v1 media schema extension separately approved |
| P0 Minimum Admin | Existing protected server interfaces/validators | 115 existing Admin tests; mocks | Approved server role/IAM, bounded DTO reads and minimal mutation/audit repository. Legacy UID UI/direct writes cannot enforce authorization |
| P0 gu/hi/en + mobile | Preview locales/focus/320px/200% text; legacy authored text preserved | Existing browser/localization regressions | Whole-app Login/listing/settings/account/Chat translations, native-language review and real devices; previews do not cover entire legacy app |
| P0 Privacy/security/release | Deny-all baseline, split/projection and lifecycle contracts | Named model/Rules suites | Consent/contact/private data, retention/export/account deletion, abuse response, migration/rollback, real security acceptance and explicit release approval |
| P1 Media cleanup/moderation operations | Reconciliation/reference model and proposed policy | Isolated reference implementation | Durable orphan cleanup, moderation appeals/abuse, removal/backup/CDN semantics. Upload safety itself is P0, not deferred |
| P1 Roadmap extensions | Store posters, Service sharing/multiservice and later contact/reviews plans preserved | Existing synthetic sharing/status coverage | Real routes/media consent, trustworthy completion/review eligibility; no claim of live reviews/contact |
| P1 Android | Existing Capacitor roadmap | Web mobile tests only | Web gates first, then approved native packaging/device/deep-link/privacy/signing/release acceptance |

## Minimum owner decisions (recommendations are not approvals)

1. **Runtime and zero-cost eligibility:** select existing-account server runtime/region,
   Firebase Auth/Firestore identity and commercial/free-tier eligibility. Default:
   existing stack, one small same-origin API, bounded text operations, no new service.
   Separately authorize IAM/secrets/resources if required; no credentials in browsers.
2. **Operational schemas and permissions:** bind proposed v1 paths/indexes and Product/
   Store public/private views; decide account eligibility, publisher promotion/consent,
   quotas, suspension and trusted role management. Default: one opaque Provider per
   verified owner, explicit publication, allowlisted DTOs and fail-closed quotas.
3. **Privacy/retention:** approve enquiry/Chat/audit/receipt/media retention, blocking,
   contact disclosure, withdrawal freshness, account deletion/export and moderation.
   Default: minimum private text, no public contacts/GPS/IP, no content in audit logs,
   retries retain same key; expired/missing receipt never means rollback.
4. **Photos:** select/validate existing Cloudinary Free candidate or alternative only
   after terms/quota/runtime feasibility; approve managed registry, trusted raster
   processing, moderation, visibility and private delivery. Default: bounded proxy,
   private quarantine, explicit approved derivatives, no remote-fetch or legacy-ID
   guessing. No public URLs for Chat; no free unlimited storage/moderation assumption.
5. **Staging and release actions:** separately approve named synthetic-data environment,
   Rules/index/transport/identity provisioning, staging deployment/rollback and later
   production rollout/migration. Current permission authorizes none of these actions.

## Required staging acceptance before any launch claim

Use synthetic identities only after explicit staging authorization: guest/private
read denial; owner create/edit/retry/cross-account conflicts; explicit publish and
withdrawal during discovery/detail/enquiry; stale cursor/generation rejection; buyer/
provider block and denied message transitions; admin role isolation/audit; real token
revocation/rate-limit outage; provider upload size/type/pixel/EXIF/scan/quota/ownership
and reference/delete races; legacy image compatibility without migration; offline/
timeout/lost-ack recovery; privacy-safe logs; gu/hi/en, keyboard, 320px, doubled text
and real device navigation; selected-account zero-cost limits and rollback. Emulator
success does not replace these operational checks.

Suggested checkpoints, conditional on timely approvals: Nov 3 settle runtime/schema/
privacy/media decisions; Nov 4 approved staging first journey; Nov 5 essential Product/
Store/Service/Chat/Admin/photos end-to-end; Nov 6 localization/device/security/rollback
closure; Nov 7 owner go/no-go. If a P0 is unverified, retain HOLD and publish the exact
blocker instead of weakening security, dropping requirements or promising the date.

Next repository batch: durable emulator-locked enquiry persistence and private read
snapshot mapping with atomic participant/publication/block revalidation, plus managed
photo reference staging against trusted parent revisions. No actual endpoint or media
provider activation should be inferred from that work.
