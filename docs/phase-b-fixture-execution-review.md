# OLDX Phase B — exact-target fixture execution review (NOT executable)

**Status:** 2026-11-13. This is a review artifact only. Permission to prepare it does **not** authorize any Firebase user/document creation, deletion, live token issuance, Cloud Run activation, IAM change, provider configuration change or production action. Remain **HOLD / NO-GO**.

## Immutable scope

- Project **`oldx-staging`**, number **`38472235077`**; database **`(default)`**, Firestore Native, Mumbai **`asia-south1`**. Abort if the running operator's selected project or SDK project/database differs. Never infer target from default `gcloud config`.
- Provisioning principal: **Yasmin's existing authorized Google account**. Its *project-level* `firebaseauth.users.get/create/delete` and `datastore.entities.get/create/delete/update` probes returned GRANTED (owner screenshots). Those probes do **not** prove live Auth endpoints, exact database access or runtime-SA condition enforcement.
- Auth user UIDs, exact: `synthetic-seller-a` and `synthetic-buyer-b`.
- Firestore documents, exact:
  - `marketplaceActors_v1/synthetic-seller-a`
  - `marketplacePrivate_v1/product_synthetic-phase-b-read-01`
- No writes to `products`, `stores`, public records, `marketplaceRateLimits_v1`, or any other path during **fixture creation**. Quota counters must be addressed separately before live runtime testing.
- Existing Phase A Cloud Run revisions remain default-off: `oldx-owner-read-00001-8kr` gets 100% main traffic; `oldx-owner-read-00002-tid` has tag `healthcheck`, 0% main traffic.

## Required final design approvals before execution

The owner must separately approve the exact four creates, maximum proposed 24-hour retention, explicit permission to delete each **same** resource after checking its ownership, and the chosen way to acquire/revoke temporary credentials. Record the appointed operator and firm stop conditions. Require a future review of a *fully executable* cloud script before any runs. No blanket approval of later Cloud Run activation or IAM changes.

## Secure create / verify / cleanup algorithm (pseudocode only)

This describes intended API choices; **not copy-paste runnable code**.

```text
1. Verify authorized operator identity and exact project number, ID and database.
   Confirm staging Email/Password provider is Enabled (owner screenshot).
   Inspect proposed Auth UIDs individually: getUser(uid).
      auth/user-not-found => eligible to proceed
      existing user / permission denied / ambiguous failure => STOP
   Inspect both exact documents individually with get().
      exists=false => eligible
      exists=true / permission denied / ambiguous failure => STOP

2. Generate a unique NONSECRET run marker and two strong independent temporary
   passwords in protected ephemeral memory (not stdout, GitHub, shell history,
   logs, screenshots or saved cloud files). Choose two staging-only emails
   that pass Firebase provider validation; avoid real recipients, and verify
   email noncollision before creation. Never rely on demo JSON placeholders
   as operational credentials.

3. Under a NEW, narrow cloud-write approval, call createUser(...) for each
   reserved UID (no overwrite). Record exact UID, result status, creationTime,
   and nonsecret run marker in a bounded manifest; keep credentials out.
   If any create fails, STOP and invoke only pre-approved partial cleanup.
   For docs, use doc(path).create(data) (not set/update/merge), with the
   previously reviewed owner actor and private product schema plus the
   run marker. A marker on the root record is acceptable only after
   offline verification that the Owner Read projection does not leak it
   and its schema accepts extra storage-only fields.

4. Verify with getUser(exact UID) and get(exact document path) without any
   listUsers(), collection scans, broad queries or export. Confirm UID,
   ownerUid, kind, id, schema, revision, run marker, and created timestamps.
   Store a nonsecret inventory of exactly created resources.

5. Only after a SEPARATE approved Phase B runtime stage:
   acquire Firebase ID token via the existing staging Email/Password sign-in
   provider, checking returned localId against reserved UID. Do not print the
   returned refresh token, ID token or temporary password. Independently
   acquire permitted Google Cloud Run invoker identity token; send it in
   X-Serverless-Authorization. Firebase user ID token travels in
   Authorization: Bearer. Do not reuse either as the other.
   Keep enabled Cloud Run revision at 0% main traffic, enforce attempt/time/
   instance-second limits, stop on unexpected success/data exposure/write.

6. Cleanup only if specifically authorized beforehand or via a separate
   owner decision: first stop all test traffic and confirm disabled revision;
   for each exact document re-read fields, marker, identity and createTime.
   Use Firestore delete preconditions tied to the last updateTime to avoid
   a race between inspection and delete; if changed, STOP (no force delete).
   For each Auth UID getUser(uid), compare creationTime, email, expected UID
   and the locally recorded creation inventory; then deleteUser(uid) once.
   Avoid deleting any preexisting/colliding UID or document. Unknown rate
   counter IDs are left untouched, flagged as residue; never delete a
   whole collection. Reverify absence using exact IDs only.
```

### Specific technical risks to resolve *before* creating fixtures

1. The trust-boundary `product-read-server.mjs` passes credentials to `runtime.mjs`; it cannot accept an unverified Google invoker as a Firebase user. A real Firebase ID token is required later.
2. The repository's `marketplaceCore.owner` reads actor `marketplaceActors_v1/{uid}` and `marketplacePrivate_v1/product_{id}`, with revisioned profile validation. Proposed fixture data must pass `inspectProfile`. A test-only run marker must **not** enter the owner response DTO or invalidate this schema.
3. The Owner Read endpoint may write rate-limit counters. No quota-counter creation or cleanup is included in the four-fixture approval. Activation must remain blocked until that resource/retention scope is explicit.
4. Firestore delete-by-ID after a previous get is not inherently race-safe; use update-time preconditions only if verified supported by the selected SDK/client and executor. Do not implement ambiguous unconditional deletes.
5. Auth Users have no arbitrary test marker field by default. The local creation inventory plus UID, email, creationTime and test-only details must identify their provenance; do not create custom claims merely to tag them.
6. Project-level `testIamPermissions` did not verify `oldx-product-read-staging` effective per-database IAM condition, and the read-only auth-config REST returned HTTP 403 even though Firebase Console independently showed Email/Password Enabled. Never equate these with successful future calls.

## Status / next action

**Prepared and approved at planning level only. No actual cloud operation executed here.** Next independent source task: offline test the exact proposed actor/product document shapes against existing repository validation, without introducing production credentials or cloud operations. Next owner gate after that: a precise executable script and separate explicit approval for the four creates **and** exact-ID cleanup. Any enabled Cloud Run revision, IAM grants or live Firebase ID token acquisition remains independently gated.

## Final owner decision — exact four-resource fixture approval

**Evidence recorded 2026-11-13:** (a) Firebase Console exact-UID search showed no account for `synthetic-seller-a` and `synthetic-buyer-b`; (b) Firestore exact-document REST GET returned 404 for `marketplaceActors_v1/synthetic-seller-a` and `marketplacePrivate_v1/product_synthetic-phase-b-read-01`. These four results are **point-in-time**, not create authorization or proof that a later write cannot collide. The two Auth REST lookups returned 403, root cause unresolved; do not equate Console access with successful Admin SDK create/get.

**Proposed permission to request distinctly (not yet granted):** Authorized Yasmin operator may, only on `oldx-staging` / `(default)`, create *exactly*:
1. Firebase Auth test UID `synthetic-seller-a` (non-real test email with unique temporary password, never logged).
2. Firebase Auth test UID `synthetic-buyer-b` (distinct credentials; no real recipient).
3. Firestore `marketplaceActors_v1/synthetic-seller-a` (synthetic eligibility actor).
4. Firestore `marketplacePrivate_v1/product_synthetic-phase-b-read-01` (draft unpublished synthetic profile; no images).

**Separately identified but proposed for simultaneous owner approval:** After creation, perform read-only exact-ID verification and later cleanup of *these same four resources only*, provided provenance/marker and Firestore update-time safety checks pass. **Maximum lifetime proposed: 24h** from first successful creation, with an owner-operated cleanup step or an independently authorized scheduled mechanism; nothing is currently scheduled, and neither this repo nor chat guarantees automatic expiry. If deletion cannot be assured or pre-authorized, **do not create anything**. Do not retry partial create blindly; stop and inventory exact successes. No public collections, legacy stores/products, other Auth users or mass deletes. Quota-counter writes, login/token issuance, enabled Cloud Run, IAM grants, ingress, Rules, Billing and production explicitly **excluded** from this fixture-only approval.

**Mandatory preflight immediately before execution:** validate active Yasmin account and project number, verify the two exact Auth UIDs using a supported and authorized lookup (Console alone is not an atomic create guard), verify two Firestore document paths absent, verify no email collision, use create-only operations for every resource; on any 403, ambiguous result, mismatch or collision **STOP**. Protect any temporary credential in ephemeral memory and never transmit it in output, repository, screenshots, shell history or logs. Review exact operation sequence, auth token source and cleanup capability *before* running.

**Decision state:** WAITING FOR EXPLICIT EXECUTION AUTHORIZATION. A message such as “continue” or “OK” is not authority to create/delete cloud resources. Even after approval, require an executable script to be independently checked and show the user its exact run operation before mutation. The existing private Cloud Run revs stay default-off and production HOLD/NO-GO.


## Execution readiness review — Firebase user credentials and cleanup blocker

**2026-11-13 — read-only source/official documentation review, no cloud writes.** Yasmin approved the proposed four create-only fixture operations and cleanup *subject to reviewing exact executable commands and verifying cleanup first*. This is **not permission to execute unreviewed commands**. The user's screenshots show 2/2 absent Auth UIDs in Firebase Console and two absent Firestore document paths by direct REST GET; state can change. Existing project-level user-permission probes were `GRANTED` but exact Firebase Auth REST lookups with `gcloud auth print-access-token` returned HTTP 403. Reason has **not** been established.

**Critical Firebase SDK caveat:** Firebase Admin documentation [Add Admin SDK to your server](https://firebase.google.com/docs/admin/setup) states Firebase Auth does **not** accept the default gcloud OAuth client ID's end-user ADC. For Firebase Auth via `gcloud auth application-default login` as a human operator, documentation calls for the operator's **own Desktop OAuth 2.0 client ID**, separate from the default gcloud OAuth client. Creating such a client, saving client credentials or granting new IAM is outside the current authorization. Do **not** suggest `gcloud auth application-default login` alone as a proven fix, use the Cloud Run runtime SA to create users, or use a service-account private-key JSON as a workaround. The Console may separately support user creation, but does not validate arbitrary UID assignment and race-safe deletion; do not claim the four-create procedure is ready without that evidence.

**Cleanup readiness is still BLOCKED:** A four-resource manual cleanup may be possible with exact authorized SDK operations, but has not been validated on Yasmin's Auth API identity. Proposed 24h expiry is *not* automatic; it requires an authorized, scheduled and verified cleanup operator or an explicit supervised cleanup commitment, ideally before fixture creation. Firestore document cleanup must be exact-ID, provenance-checked and conditional on last-update-time; Auth cleanup must check exact UID and creation evidence. Partial failure leaves residues and must be surfaced rather than pretending atomicity across Auth and Firestore.

**Verified non-mutating preflight, to run only if needed (no Auth/Firestore reads):**

```bash
set -euo pipefail
test "$(gcloud config get-value project 2>/dev/null)" = "oldx-staging"
test "$(gcloud auth list --filter=status:ACTIVE --format='value(account)')" = "yasminparmar087@gmail.com"
echo "PROJECT_AND_OPERATOR_MATCH"
gcloud auth application-default login --help >/dev/null
echo "ADC_HELP_AVAILABLE_NOT_AUTH_VERIFIED"
```

This checks only selected operator context and SDK CLI documentation availability; it **does not prove** usable ADC or cleanup access. No need to repeat older 403 Auth requests. No executable `createUser`, `deleteUser`, `doc.create`, or `doc.delete` commands should be sent to the operator until an approved and verified Auth credential path plus cleanup are available. Keep Phase A default-off; production HOLD/NO-GO.


## REST-only keyless approach evaluated after successful quota-project lookup

**2026-11-13 verification basis:** Operator screenshot proved read-only `POST /v1/projects/oldx-staging/accounts:lookup` for `synthetic-seller-a` returned `NOT_FOUND` when supplied Yasmin's Google OAuth token plus `X-Goog-User-Project: oldx-staging`. Previous calls without the header gave `403 SERVICE_DISABLED`. This establishes a **keyless read-only REST access path for one UID**, not permission to create/delete, complete readiness, or a reason to create a Desktop OAuth client. Firebase Admin SDK local ADC limitations may not imply the same behavior for directly authenticated REST.

**Official REST endpoints relevant to a *future reviewed* implementation (no operation performed):**

- Firebase Auth [accounts.signUp](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signUp) documents admin-only `localId`, `targetProjectId`, `email`, `password` fields and accepts `cloud-platform` OAuth scope. It also contains a caveat about `localId` for certain admin requests; **reconcile that ambiguity against the exact request form before trusting fixed-UID creation**. Never substitute client-side email sign-up that generates arbitrary UIDs.
- Firebase Auth [projects.accounts.delete](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/delete) or the documented matching `POST /v1/projects/oldx-staging/accounts:delete` is the proposed exact-`localId` deletion endpoint, but deletion by UID **does not itself offer a Firestore-style updateTime precondition**. Provenance verification, short interval since last lookup, no retries on ambiguous response, manual STOP on mismatch, and strict single-UID targeting are mandatory. Successful `firebaseauth.users.delete` IAM permission query is **not** a live API deletion test.
- Firestore REST document [createDocument](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/createDocument) with explicit parent path and `documentId` is intended create-only; no `PATCH`, `set`, or `upsert`. Use a complete minimal typed Firestore JSON body, approved schema and nonsecret run marker. Abort on ALREADY_EXISTS.
- Firestore REST [delete](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/delete) has `currentDocument.updateTime` precondition. Immediately before deletion, exact-ID GET returns the expected `updateTime`, marker and owner fields; only then conditionally delete. Any conflict or missing document is a **STOP**, not a force delete.
- Google Cloud [REST quota project guidance](https://docs.cloud.google.com/docs/authentication/rest) establishes `X-Goog-User-Project: oldx-staging` for user OAuth requests with adequate `serviceusage.services.use` permission. Do not assume the same HTTP code proves all mutations permitted.
- Never output a password, token, raw OAuth error body, email identifier, other user contents, Firebase refresh token or request headers. Keep tokens/passwords in protected ephemeral memory, avoid command-line arguments and `set -x`, and use only explicit project/database checks. Prefer creating no user until a working exact-ID deletion path is independently proven safe. Do not enable Cloud Run or touch runtime SA IAM.

**Important distinction between schedule and intention:** The 24h cleanup bound remains a **proposal**; no scheduled cleanup exists. Before any creation, require an explicit near-term supervised cleanup window or approved scheduler and a reviewed exact-ID cleanup command with a clear partial-failure stop procedure. Do not assume Auth/Firestore changes are atomic. Existing Firebase Auth read-only API success plus Console UID nonexistence are insufficient to guarantee deletion.

**Result:** REST-only path is a viable **review candidate** that could avoid new OAuth client/service-account keys, but executable create/cleanup remains **BLOCKED until the fixed UID Auth create API shape, safe deletion, credential lifecycle and 24h supervised cleanup are fully reviewed**. No new cloud writes were made.


## 2026-11-13: Exact API contract discrepancy and safe cleanup schedule decision

**Official-reference recheck:** [Identity Platform `projects.accounts`](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects/accounts) and [`accounts.signUp`](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signUp) BOTH expose a `localId` property described as a unique, admin-only chosen UID, while their `idToken` description includes the sentence “For an admin request, `localId` must not be set.” Because the description is internally inconsistent, **do not issue a live create request or assume fixed-UID support proven** until the exact semantics are reconciled through an authoritative reference, an isolated emulator, or a reviewed, reversible controlled test that does not risk the reserved four IDs. General email/password self-sign-up auto-generates a UID and **cannot** be substituted for the exact reserved IDs.

The exact future admin endpoint candidate is `POST /v1/projects/oldx-staging/accounts`, with a Google OAuth Bearer token, `X-Goog-User-Project: oldx-staging`, and approved payload fields `email`, `password`, `localId` and `emailVerified:false` **only after fixed-UID semantics and response redaction are validated**. Do not send any such live request during preparation. The API reference also says an API key identifies the target project; the required combination of API key, OAuth authorization and targetProjectId **has not been live-tested for creation**.

[Firestore createDocument](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/createDocument) has an explicit `documentId` parameter. Candidate actor and product document creates must be exact-target and **create-only**, never PATCH/upsert; no actual data creation is authorized until cleanup readiness is verified. [Firestore delete](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/delete) allows `currentDocument.updateTime`, which must match the freshly read update timestamp; if data was changed, STOP. Auth deletion by exact `localId` has no equivalent atomic update timestamp guard: verify UID and creation evidence immediately before deletion and STOP on any mismatch or ambiguous outcome.

**24-hour requirement:** Nothing currently schedules cleanup. The operator must explicitly select a supervised creation and deletion window, verify a working exact-target deletion identity/route **before creating anything**, and have an owner-approved means of following up within the retention limit. No obligation to keep the ephemeral shell/browser session open for 24h. A reminder alone is not automatic deletion. If guaranteed cleanup within 24h cannot be arranged, **NO-GO for any fixture creation**.

**Approved scope remains:** four staging-only synthetic resources and same-ID cleanup, **conditional on pre-execution review of exact commands and verified cleanup**. This document is advisory/source-only; it does not provision any resource, create a credential, execute API requests or change Cloud settings.
