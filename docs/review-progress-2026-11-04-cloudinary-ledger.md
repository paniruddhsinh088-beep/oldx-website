# Cloudinary server-only signing checkpoint — 4 November 2026

## Preserved baseline and approval record

Started from clean remote/local `514e7b892925559b7bd85da5e03f0f6d45819ed2`
on `security-hardening-review`. No live provider, Rules, secrets, billing or
runtime operations. HOLD/NO-GO remains. November 7 remains a readiness target.

Owner reports: staging `oldx-staging` has Email/Password and Google Auth enabled
and deny-all Firestore client Rules; Storage would require Blaze (not approved).
Owner approves Cloudinary Free cloud `tfizvbzc` as preferred photo storage and safe
staging testing. `Oldxbazar` is reportedly unsigned and `default` signed.
These account settings were NOT remotely verified. This approval does not authorize
credential provisioning, deployment, public activation, billing or moderation policy.
The current environment has no configured credentials/outbound identities; previous
staging isolation/backup/access preflight remains unresolved. No operational changes.

## Implemented, inactive

- `scripts/cloudinary-upload-http.mjs`: transport-independent default-off Firebase
  token-verified authorization handler; revocation check, mandatory fail-closed rate
  port, bounded JSON, exact schema, server-derived owner and parent revision checks.
  Product/Store/Provider metadata caps 3/3/2 MiB and 6/1/1 selected images.
  Returns only a `server-proxy` intent, not an upload token/signature or private data.
  This is read-only preflight, NOT a reservation or upload authorization capability.
  Actual total photo counts/quotas must come from the existing transactional journal.
- `scripts/cloudinary-signed-upload.mjs`: Node/server-only signing port, cloud pinned,
  authenticated quarantine, fixed public-ID namespace, overwrite false, no unsigned
  preset/addons/caller URL. Injected credential getter and authoritative lease/owner/
  quota authorizer; redacted failures. No environment secrets read and no fetch.
- Cloudinary SHA256 parameter signature plus separate server HMAC binds actor,
  processed byte digest/size and expiry. Verify again immediately before future
  provider dispatch, rechecking current lease ownership/quota. Do not serialize grants
  to browsers or logs. Processed WebP header checking is defense in depth; existing
  trusted decode/reencode/scan pipeline is still mandatory and is NOT replaced.
- The 60-second envelope expiry is OUR server check. Cloudinary does not sign file
  bytes; its timestamp acceptance window is independent. A raw browser signature
  would not enforce MIME/size/single-use, so this handler never returns one.
- No existing UI, translations, legacy images or photo publication gates changed.
  Server-only Node crypto is not imported into browser/Capacitor code.

## Evidence

Local pure mock/policy tests (not Emulator or real Cloudinary):

```
node --test --test-isolation=none tests/integration/cloudinary-upload.test.mjs tests/integration/isolated-media-lifecycle.test.mjs tests/integration/mandatory-photos.test.mjs tests/integration/atomic-photo-publication.test.mjs
```

20/20 passed: six new signer/HTTP security cases plus existing reservation/replay,
unknown outcome, delete authorization, withdrawal/atomic rollback and private draft
regressions. New suite included in `test:provider-draft:transaction` for CI.

```
node --test --test-isolation=none tests/browser/mandatory-photos.test.mjs
```

9/9 passed: existing Product/Store/Provider selection, preview, retry with original
request ID, remove/replace, logout cleanup, authored Gujarati/Hindi/combining Unicode,
gu/hi/en, 320/375px and doubled text. Synthetic image/mock upload, no remote requests.
Actual Cloudinary tests: ZERO. Actual Firebase tests in this local batch: ZERO.
Exact source and applicable CI are recorded after pushing below.

## Legacy migration and remaining P0

`index.html` Store photo flow currently sets `upload_preset=Oldxbazar`, folder
`oldx-stores`, and posts directly to `tfizvbzc/image/upload`. Left unchanged; no new
unsigned path introduced. Existing Product/avatar Base64 and Cloudinary URLs remain
compatible. Never derive deletion identifiers from legacy URLs or expose private Chat
images through public fallback. Before retiring unsigned uploads: inspect actual preset
restrictions/dependencies, prove signed proxy acceptance and legacy display, then obtain
separate owner approval to disable the old preset operationally. Do not delete images.

Next smallest coding task: implement an injected mock multipart provider bridge for
existing lifecycle `uploadProcessed`/`verifyUploadResult` (and later destroy), verifying
server envelope immediately before dispatch; validate returned asset identity/dimensions/
bytes/type and immutable quarantine state. Use durable attempt/idempotency journal for
lost acknowledgements; never interpret this read-only preflight as a durable reservation.

Staging blockers: approved isolated server runtime + credentials access (no credentials
created here); real Firebase verifier/role/rate bindings; verified staging isolation,
backup/rollback; actual Cloudinary signed upload/response attestation and private delivery
acceptance; authoritative quota caps against Free account limits (not assumed unlimited);
moderation/quarantine/privacy/retention/Admin decisions. No automated moderation claimed.
Then prove ownership/size/count/duplicate/withdrawal and gu/hi/en/mobile flows in staging.
No launch readiness claim until these and remaining Auth/Chat/Admin acceptance gates pass.

## Verified source and final handoff

Implementation: `c3ae69d5daec6cf52f4523b4586db6f2c06f0cd6`; pushed ONLY to
`security-hardening-review`, remote SHA matched. Fresh pre-push fetch confirmed the
baseline unchanged; no concurrent changes overwritten.

Exact-source GitHub CI on that SHA: Branch Security **41801839427 success**;
Service Providers Emulator **41801839380 success**; Review Safety
**41801839487 success**. These include isolated Firebase/Rules validation, not real
staging acceptance or Cloudinary tests. The new six-case signer/HTTP suite runs in
Review Safety's `test:provider-draft:transaction` step. This final ledger-only commit
does not change executable source; its SHA can be obtained with
`git log -1 --format=%H -- docs/review-progress-2026-11-04-cloudinary-ledger.md`.

Stop at this checkpoint. Next: mocked multipart/response-verification bridge into
existing lifecycle, followed by separately authorized credential/runtime readiness
and actual isolated staging acceptance. Do not enable UI transports, signed browser
grants, unsigned-preset migration, real deletion or any deployment automatically.
