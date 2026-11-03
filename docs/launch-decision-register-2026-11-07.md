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
| P0 Product browse/search/detail | Legacy bounded listing/rendering; partial-record search crash fixed | Existing security/category/projection/image checks plus actual extracted search-function regression | New curated SDK repository remains Emulator-locked; actual UI/identity/schema/index/Rules binding and live-compatible acceptance |
| P0 Seller listing/edit/remove | Existing forms and staged photo removals | Source tests/model contracts | New owner/revision/idempotency/audit SDK source; actual UI/identity/policy binding and denied-write/device acceptance remain |
| P0 Store creation/catalogue/share | Existing Store save and display; synthetic bounded catalogue/detail/share | Model/mobile/locale suites | New private/public split and trusted SDK relationships exist; actual binding, canonical route/OG, approved photo handling and staging acceptance remain |
| P0 Provider registration/publish/discover | Disabled v1 opaque-owner, draft/publication, HTTP/private restore and public read components | SDK mocks and existing demo/loopback Emulator path | Actual schema/runtime/identity/role/quota/retention binding; approved indexes/Rules and same-origin transport; no private browser reads |
| P0 Private buyer/provider enquiry | New disabled atomic creation + no-store HTTP command + UID-derived participant DTO; existing canonical statuses | Concurrent/replay/lost-ack/withdrawal tests and composed draft -> publish -> discover -> enquiry case | New SDK repository and private snapshots exist but remain Emulator-locked; operational namespace/retention, real identity/rate enforcement and owner/buyer UI wiring; no auto review grant |
| P0 Text Chat | Legacy 35-message UI; inactive intent/read/privacy contracts | Policy, conversation/browser and candidate Rules suites | Trusted participant/block/send/receipt/delete/rate enforcement; actual idempotency, retention, private delivery |
| P0 Mandatory photos (Product/Store/Service plus existing avatar/Chat) | Inactive durable SDK quota/attempt/registry/delete/reconciliation journal, private references and public/private delivery contracts | Quota/reference/delete races and unknown-outcome tests; no provider API calls | Provider/runtime/credentials, trusted decoder/scan/proof and moderation/public release, byte delivery/private Chat SDK gateway, operational quota/credit/rate guards; Service v1 media schema extension separately approved |
| P0 Minimum Admin | Existing protected server interfaces/validators | 115 existing Admin tests; mocks | Approved server role/IAM, bounded DTO reads and minimal mutation/audit repository. Legacy UID UI/direct writes cannot enforce authorization |
| P0 gu/hi/en + mobile | Preview locales/focus/320px/200% text; legacy authored text preserved | Existing browser/localization regressions | Search/auth essential controls now bind to gu/hi/en; remaining listing/Store/settings/account/Chat/Admin/error copy, native-language review and real devices remain |
| P0 Privacy/security/release | Deny-all baseline, split/projection and lifecycle contracts | Named model/Rules suites | Consent/contact/private data, retention/export/account deletion, abuse response, migration/rollback, real security acceptance and explicit release approval |
| P1 Media cleanup/moderation operations | Reconciliation/reference model and proposed policy | Isolated reference implementation | Owner-scoped orphan journal exists; service-worker scheduling/deleted-user cleanup, moderation appeals/abuse and removal/backup/CDN semantics remain. Upload safety itself is P0, not deferred |
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


Latest [durable launch checkpoint](review-progress-2026-11-02-durable-launch-batch.md)
adds SDK enquiry/marketplace/photo reference mappings and actual essential-control
locale binding. Source is default-disabled and Emulator-locked. Durable upload quotas/
provider outcomes/processing/delivery, complete UI integration and real staging remain
blocked; this does not satisfy all P0 requirements or guarantee November 7.


Latest [media delivery/journey checkpoint](review-progress-2026-11-02-media-delivery-journey-batch.md)
adds durable SDK media journals and contract projection/redemption, owner/buyer shared
portable ports, archive and latest Chat-window fix. Real provider/processor/release/
delivery and complete UI/locale/device/security acceptance remain unimplemented or
inactive. Android-compatible source separation is checked; no native package exists.
All full-product P0 requirements remain and November 7 is conditional.

Review/moderation sequencing does not waive agreed release requirements: no synthetic
completion, receipt or CI pass grants real review eligibility, image moderation or
launch approval. The actual policies, trusted enforcement and acceptance evidence
remain unresolved alongside the P0 integration/media/localization/device gates.

[Processing/release checkpoint](review-progress-2026-11-02-processing-release-batch.md)
adds real image codec validation/metadata removal and isolated atomic moderation /
Product/Store release. Missing scan remains unapproved; no real media is published.
Provider public-photo scope, real provider/proof/private delivery and full UI/locale /
review/security acceptance remain P0 work. Commercial runtime eligibility is unresolved:
Vercel Hobby's non-commercial restriction cannot be ignored to meet the date. No paid
upgrade or runtime action is authorized. Cloudinary Free remains a conditional candidate.

Owner target after website completion: Capacitor/Play submission November 14–19, 2026.
That target remains conditional on website readiness and separately approved native,
account/signing/testing/release gates; no native packaging is started or date guaranteed.

## 3 November P0 implementation delta

- Public-photo approval bypass and proof check/read mismatch are fixed in inactive
  source. Independent moderation/publication/active-authority checks are mandatory;
  no legacy flag enables operational public delivery. Adversarial proof tests
  preserve quota/state when verification is inconsistent or bound to another image.
- Product SDK publish/discover now composes with private buyer enquiry, seller
  inbox and response through a disabled verified HTTP port. It enforces participant,
  listing revision, block and suspension checks atomically with receipt/audit writes.
  Bounded private snapshots omit raw UIDs. This does not bind legacy Login/forms/
  Chat to an approved runtime and does not complete the mandatory-photo journey.
- Next source task: opt-in existing Product form/discovery/Chat binding to these
  ports, abort/clear on session/navigation changes, preserve retry keys, and run
  extracted real-markup 320px/gu-hi-en/large-text browser acceptance. Then add scoped
  inbox pagination and remaining Chat lifecycle features; no new demo page.
- Before staging: owner must approve concrete operational namespace/schema and
  compatibility plan, verified identity/eligibility and block bootstrap policies,
  retention/privacy, same-origin runtime/rate enforcement, index/Rules candidates,
  image provider/processor/moderation/quota arrangement and staging acceptance.
  Recommendations are not approvals; deployment, credentials and billing remain
  separately forbidden. Existing Firebase architecture with bounded reads and no
  new paid infrastructure remains the recommended baseline. No guaranteed free-tier
  capacity or November 7 launch claim. HOLD/NO-GO and future Android gates remain.

### Product UI dependency-path update, 3 November

Existing-UI Product draft/edit/publish/discover/detail/private enquiry/response is
now bound to disabled injected ports and isolated browser acceptance. No endpoint
or real Auth binding is enabled. Next source work: owner-private revision/bootstrap
recovery after reload, full history/deep-link and inbox pagination, then reuse the
same portable ports for Store/Provider. Real image delivery, complete search,
privacy/Admin/review and staging acceptance gates remain mandatory. See the
[Product UI checkpoint](review-progress-2026-11-03-product-ui-batch.md) for limits
and Service concurrency evidence; no historical flake root cause is invented.

### Recovery batch update — 3 November

Implemented disabled owner draft/receipt reload, actual Product/private Chat history
restoration and bounded inbox pagination; Store owner/public catalogue UI ports now
reuse the existing SDK. Browser history stores pending request metadata only;
operational session-scope/retention and trusted cursor-signing choices need approval.
Exact seller Product Unicode is preserved everywhere changed. Remaining ordered P0
and per-feature evidence are in the [recovery checkpoint](review-progress-2026-11-03-product-store-recovery-batch.md).
No runtime/schema/Rules/index/media/deployment approval is implied. HOLD/NO-GO.

## 3 November private enquiry and shared-host source checkpoint

Disabled existing-page public enquiry -> private inbox -> canonical enquiry
conversation/reply/history is now integrated in isolated fixtures, with participant
checks, idempotent same-scope retry, revision-pinned paging, cleanup, gu/hi/en and
320/375px evidence. Existing Product/Store/Provider host navigation delegates to
existing route parsers and supports refresh/back/deep-link restoration. This does
not complete general two-way Chat messaging, mandatory photos or real staging.
See [exact-source ledger](review-progress-2026-11-03-private-conversation-host-ledger.md).
Runtime/Auth/schema/indexes/Rules/IAM/secrets, privacy/media policy and actual
staging/deployment approvals remain required. No new operational approval inferred.
HOLD/NO-GO and every agreed full-website requirement remain unchanged.

## 3 November Service two-way text foundation

Disabled participant-scoped read/send and existing conversation UI now support both
buyer/provider text messages, atomic idempotent writes, bounded private paging and
revocation-aware reads using the existing enquiry transaction. Local selected final
groups: 262 passing executions; actual SDK CI is tracked in the
[messaging ledger](review-progress-2026-11-03-service-messaging-ledger.md).
This completes a repository-only messaging foundation, not runtime activation or
Chat receipts/deletion/retention. Mandatory photos remain P0. Operational runtime,
Auth/rate enforcement, schemas/Rules/indexes/IAM/secrets, text/media privacy policy
and staging/deployment acceptance still require owner approval. HOLD/NO-GO.

## 4 November mandatory-photo source milestone

Existing Product/Store/Provider forms have an explicit default-disabled shared
private selection/preview/progress/retry/remove/replace workflow. A verified-owner
upload bridge and opt-in transactional independent-photo publication gate exist;
legacy images/listings are preserved. Selected local groups pass 277 executions,
with targeted follow-up evidence in the [photo ledger](review-progress-2026-11-04-mandatory-photos-ledger.md).
Public media materialization/delivery (especially Provider), actual scanner/provider,
privacy/moderation/retention, Auth/runtime/Storage/Rules/IAM/secrets and real staging
acceptance remain P0 approval gates. No automated moderation or deployed gallery is
claimed. No existing image is migrated or automatically unpublished. HOLD/NO-GO.

## 4 November atomic Product/Store photo-publication source milestone

Existing default-disabled parent SDK transactions can atomically materialize
approved Product/Store media references and derivative metadata with publication,
replacement, withdrawal/archive, generations and audit. No independent review is
rewritten, and incomplete/failed writes roll back. Existing public media contracts
can consume the accepted revision without a separate rebind/release window.
Exact evidence: [atomic ledger](review-progress-2026-11-04-atomic-photos-ledger.md).
Provider public-image/byte delivery, actual storage/moderation/runtime, privacy/
retention, Auth/rates/Rules/IAM/secrets, Chat/Admin and real staging/device acceptance
remain P0. No account action or operational approval inferred. HOLD/NO-GO.
