# Real Product publishing readiness — 4 November 2026

Baseline `4a09173d3e948437f0401cc7eb11c5abe12b8ab5`, review branch only,
clean and matching fresh remote. No Firebase/Cloudinary operations, deployed Rules,
index/data/IAM/credential/billing changes. Owner approves this source push and its
automatic Preview deployment; that is NOT permission to activate storage/backends.

## Runtime inventory: what actually runs

| Journey | Existing legacy source | Remaining secure integration |
| --- | --- | --- |
| Login | Firebase Auth listener assigns currentUser; Preview build guard requires oldx-staging | Real verifier/revocation, owner eligibility, logout/session acceptance |
| Create | Wizard/native required fields; optional IP lookup; browser JPEG compression; direct products.add() | Trusted authenticated owner transaction, private schema, idempotency/audit and explicit approved-photo publication |
| Photos | FileReader/Image/canvas => 800px JPEG quality 0.7 => Base64 strings in images[]; enhanced thumbnails are local preview | Signed private object storage, quotas, byte validation, trusted inspection, approval and reference/release transactions |
| Browse | products orderBy(createdAt DESC), limit(productLimit), full doc.data() into browser; My Ads filters cached products by sellerUid | Curated public DTO and bounded server query; owner reads must not rely on public catalogue cache |
| Edit | Fetch/cached record, local photo removal/replacement, direct document.update(images + text/price/contact) | Server owner/revision checks; atomic reference replacement; preserve old photos until commit |
| Stock/delete | Direct isSold update; direct document.delete() | Trusted withdrawal/revision/audit; revoke public media first, then separately authorized managed cleanup; legacy URL deletion never inferred |

Thus opening legacy Products to public read would expose mixed private phone/IP/GPS
fields; relaxing Rules is not a secure fix. Existing legacy Cloudinary unsigned
Oldxbazar path is Store-only; Product create/edit use Base64. Existing images remain
untouched and must display through compatible privacy-reviewed handling, not migration.

## Small verified source improvement

Added a create-only UI preflight: serialized UTF-8 payload budget 900 KiB BEFORE
Firestore add(). Oversized photos/metadata produce existing localized invalid-data
feedback, restore the button and retain the form/photo selection. No automatic retry.
This is a conservative UX estimate with headroom, NOT Firestore's exact accounting,
server security enforcement, storage migration, or a guarantee all accepted documents
are valid. Small/normal submissions still follow the existing path and may be denied.
Edit/delete behavior is unchanged. Browser TextEncoder is standard in current web/
Capacitor runtimes; it fails safely if unavailable. No new dependency/platform binding.

Four 200 KiB JPEGs require 1,092,364 ASCII bytes as Base64 data URLs, before metadata;
Firestore's 1 MiB document limit is exceeded. 800px dimensions do not bound total bytes.
This interim guard does not solve publication permissions or eliminate Base64 storage.

## Shortest secure photo/publish path — inactive

Use owner-selected Cloudinary Free, keeping Firebase/Firestore for metadata only.
Retain private managed IDs/digests/parent revisions, never Base64 or arbitrary URLs
in new public DTOs. Reuse server-only signing, Firebase-authenticated preflight,
processed-byte multipart bridge, durable attempt/quota journal and atomic Product/
Store photo publication adapters. No browser API secret or reusable signed grant.
Response signature alone does not attest file bytes; mandatory independent asset
inspection, quarantine/approval and exact byte/count quotas remain required.

Missing runtime bindings: actual signed provider transport + authenticated byte
inspection, managed delete/reconciliation, private/public derivative delivery,
trusted parent transactions and verified token/rate/eligibility ports. Cloudinary Free
quotas and plan eligibility must be verified in the actual account; not assumed
unlimited or a zero-cost guarantee. No Firebase Blaze upgrade. No real automated
moderation claimed. Keep unsigned preset unchanged until separate migration approval.
Saving a private draft is not public publication; moderated approved photos and
separate publication permission are still mandatory.

## Schema, indexes and deployed evidence

- Source build requires OLDX_FIREBASE_ENV=staging and projectId=oldx-staging for
  VERCEL_ENV=preview; production project rejected. Exact non-secret app configuration
  must be checked by the operator in Preview scope, without posting key/token values.
- Current checkout has no generated firebase-env.js or .firebaserc. Fresh managed
  observations show no ready identity/secret bindings; Firebase Rules API excluded by
  enforced network policy. No authenticated remote project/Rules/index inspection was
  possible. Owner-reported empty staging/deny-all is not a retrieved Rules snapshot.
- Current legacy products payload is documented in the publication-failure ledger.
  Product/Store trusted SDK schemas are test-only; no live curated namespace mapping
  is approved. Provider v1 is a design, not deployed schema. Do not infer collections
  exist or seed them from templates.
- Existing minimum client policy remains deny-all for server-mediated integration.
  Optional private-only candidate at product-owner-drafts.candidate.rules requires
  trusted eligibility, exact stagingProductDrafts_v1 fields, immutable ownership,
  revisions/timestamps, bounded owner queries, no public publish and no direct delete.
  It rejects legacy Post Now payload and does NOT fix publishing by itself. Six
  actual Emulator cases passed on baseline Review run 41861344108; not staging tests.
- Legacy createdAt ordering/sellerUid equality and private-draft sellerUid query use
  single-field indexes. No index change resolves permission-denied. Final curated
  kind/category/Store/id composite indexes require approved namespaces/query variants;
  existing Provider index proposal is separate. Emulator does not prove live index readiness.

## Owner/operator checklist and safe rollout

1. Attach EXISTING staging-scoped read-only access through supported secure environment
   connection; allow exact needed API hosts through policy. Supply current Rules
   source/release/hash and existing rollback/restore evidence, not chat credentials.
2. Approve one exact server-mediated Product schema/query/runtime slice (recommended),
   trusted eligibility/permissions and rollback artifact. Do not deploy the private-only
   alternative to make legacy Post Now appear successful. Runtime/IAM/secret provisioning
   or changes need separate explicit approval; current permission does not cover them.
3. Approve actual signed Cloudinary staging upload/delivery/delete scope and conservative
   Free quotas, consent/retention/moderation policy, quarantine review and cleanup rules.
   Existing Cloudinary Free preference is already approved; activation is not.
4. After independent approval of exact staging changes, use one synthetic owner and
   another buyer/owner, one small synthetic photo, no customer data. Accept Login,
   owner draft -> private upload -> approved photo -> atomic publish -> guest public
   detail/list -> edit/replace -> withdrawal/delete cleanup, plus other-user/guest/
   suspended denials, unknown acknowledgement/retry, refresh/logout, gu/hi/en authored
   Unicode and 320/375px. Capture only safe codes/IDs and revisions.
5. Before any approved operational change, record existing deny-all release, runtime
   flags/binding and exact synthetic manifest. On leakage/auth/revision/quota failure,
   disable new transport gates, restore captured prior Rules/runtime through authorized
   operator, verify denials. Data/media cleanup is separately scoped, never bulk deletion.

No activation/deployment of Firebase or Cloudinary is part of this checkpoint.
HOLD/NO-GO until real acceptance passes; November 7 is a target, not a guarantee.

## Local evidence

Focused unit/source/mock integration/security/config checks: **29/29 pass**:
`node --test --test-isolation=none tests/firestore-emulator/product-publish-feedback.test.mjs tests/firestore-emulator/product-image-processing-source.test.mjs tests/integration/cloudinary-multipart.test.mjs tests/integration/atomic-photo-publication.test.mjs scripts/generate-firebase-env.test.js tests/firestore-emulator/deployment-boundary.test.mjs`

`npm run test:static-build`: **3/3 pass**. Browser locale suite **5/5 pass**:
`node --test --test-isolation=none tests/browser/marketplace-locale.test.mjs`.
Exact-source push CI is reported with this checkpoint. No real staging or Cloudinary test performed.
Actual Product draft Rules validation uses the existing Review CI isolated Emulator
step; local official binary remains unavailable. No extra unchanged full local sweep.
