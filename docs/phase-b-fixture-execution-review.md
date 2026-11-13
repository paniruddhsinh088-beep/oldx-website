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


## Approved supervised same-day session plan

**Owner decision (2026-11-13):** Yasmin explicitly approved a **single supervised test session with same-day cleanup**, rather than leaving synthetic accounts and documents present for days. The existing four-resource scope and creation/cleanup consent are subject to **pre-run review of exact commands and proven cleanup capability**. This decision does **not** approve enabled Cloud Run, runtime quotas/writes, public access, IAM, Rules, Billing or Production.

**GO/NO-GO checklist — all mandatory before creating anything:**

- [ ] Confirm a specific supervised window and a named human responsible for same-day cleanup. Log creation time and cutoff in IST; never assume an automation is running. If the operator cannot be present for cleanup, **NO-GO**.
- [ ] Resolve exact chosen-UID Firebase Auth admin REST create semantics and verify the keyless OAuth principal works for read-only lookup **and has an evidenced safe deletion path**. Existing scoped `testIamPermissions` and one successful lookup are insufficient proof of deletion.
- [ ] Prepare separately inspectable and redacted executable scripts for exact-UID Auth user create/verify/delete, exact-path Firestore create-only/verify/conditional-delete, with a nonsecret run marker and local protected creation inventory. **Show commands before any execute.** Fail closed on unknown API responses and conflicting UIDs.
- [ ] Verify stable synthetic email/address handling (no real recipients), protected in-memory ephemeral passwords and no tokens/secrets in shell history, GitHub, logs or chat. No service-account key.
- [ ] At start of the actual authorized session, freshly verify the two fixed UIDs and two document paths absent. Treat prior Console/REST results as historical, not durable authorization to overwrite.
- [ ] Have explicit permission **for any extra runtime features**, rate-limit counter writes, least-privilege invoker, trial limits and rollback. If absent, run **fixture-only create/verify/cleanup**, NOT a live Owner Read test; do not label this backend acceptance.
- [ ] Keep an exact-ID cleanup method and manual rollback for partial creation or ambiguous failures; delete only records verified to be created in this session, with Firestore `updateTime` preconditions. Verify all four gone before declaring completion.
- [ ] STOP and disclose residual resources if API access or cleanup fails; no broad account listing, collection-wide deletion or force-overwrite. Retention goal = cleanup during the same supervised session, **never later than 24h**.

**Execution order once *all* gates are met:** preflight → exact collision check → create only approved four fixtures → verify exact four → run only separately approved tests → disable/stop test access → conditional exact-ID cleanup → verify absence → record redacted outcomes in this handoff. No run is currently scheduled; no fixture has been created by this approval alone.

**Next safe work:** prepare the exact reviewed script and prove correct Auth UID semantics and cleanup behavior without using live OLDX data. Code review/tests in `security-hardening-review` are allowed within existing preparation scope. No Cloud write/delete until commands have been shown and all gates resolved.


## 2026-11-13 REST fixed UID clarification and pre-execution command sequence

**Correction to earlier ambiguity:** The current official [Identity Platform projects.accounts create reference](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects/accounts) states explicitly that the request's `localId` is the unique ID of the user to create and requires properly authorized Google OAuth 2.0 credentials. The contradictory “localId must not be set” sentence appears in the *`idToken` field description* for the **account-linking** path, not as a general prohibition on admin-chosen UIDs. The proposed admin create request should therefore **omit `idToken` entirely** and set the reserved `localId` explicitly. The API requires an API key to identify the project **in addition to** the appropriate Google OAuth identity. The correct method is `POST /v1/projects/{targetProjectId}/accounts`; the endpoint is not the public `accounts:signUp` self-signup flow. This clarifies source-contract intent only; successful live admin create has not been proven.

**Exact per-operation HTTP contract for an independently reviewed implementation (NOT instructions to execute now):**

| Sequence | Endpoint / method | Request boundary | Sensitive response handling |
| --- | --- | --- | --- |
| 1 | `POST https://identitytoolkit.googleapis.com/v1/projects/oldx-staging/accounts:lookup` | Google OAuth + `X-Goog-User-Project: oldx-staging`; `{"localId":["synthetic-seller-a"]}` and repeat separately for `synthetic-buyer-b` | Log only exact UID EXISTS / NOT_FOUND / BLOCKED; no profiles |
| 2 | `GET https://firestore.googleapis.com/v1/projects/oldx-staging/databases/(default)/documents/{exactPath}` | Same quota project; only two approved paths | Log status only; 404 expected for absence; stop on 403/other |
| 3 | `POST https://identitytoolkit.googleapis.com/v1/projects/oldx-staging/accounts?key={STAGING_WEB_API_KEY}` | Admin-authorized Google OAuth + quota-project header; approved payload: `localId`, `email`, `password`, `emailVerified:false`, no `idToken` | Validate returned `localId` equals reserved UID; **never** print tokens, email, password or unredacted JSON |
| 4 | `POST https://firestore.googleapis.com/v1/projects/oldx-staging/databases/(default)/documents/{collectionId}?documentId={exactId}` | Reviewed typed Firestore JSON body, nonsecret run marker, unique exact ID | **create-only**; record opaque exact path, `createTime`, `updateTime`; STOP on conflict |
| 5 | `POST https://identitytoolkit.googleapis.com/v1/projects/oldx-staging/accounts:lookup` and exact document GET | Verify only four created resources and provenance; no broad lists | Validate UID, run marker, product owner, timestamps |
| 6 | `DELETE https://firestore.googleapis.com/v1/projects/oldx-staging/databases/(default)/documents/{exactPath}?currentDocument.updateTime={urlencoded-verified-updateTime}` | Exact two document paths after immediate fresh GET and marker checks | Stop on 409/412/unknown; never unconditional delete or collection delete |
| 7 | `POST https://identitytoolkit.googleapis.com/v1/projects/oldx-staging/accounts:delete` | Google OAuth + quota header; body **only** `{"localId":"{approvedUID}"}` after verifying creation inventory | Delete exact UID once, no batch delete; recheck absence by exact lookup |
| 8 | Exact UID lookup + exact doc GET | All four absent => cleanup complete; otherwise report residue | Never claim completed if any remain |

The exact Firestore REST `createDocument` uses `documentId` on the create request; the parent path for root collection creation is `projects/oldx-staging/databases/(default)/documents`. Firestore deletion precondition protects against a changed document but **Auth deletion has no equivalent documented updateTime precondition**. Use non-secret provenance and stop on UID mismatch. Build an explicit signed-off, secure script with no raw credential output, no shell history secrets, protected ephemeral passwords, and no automatic retries on ambiguous create/delete.

**Execution remains blocked:** no verified successful Auth *create and delete* endpoint calls, no reviewed secure login/token method and no confirmed supervised cleanup operator/window. User's consent to create exactly four fixtures and same-day cleanup is **conditional on showing exact executable commands and confirming cleanup ability first**. Do not run live writes/deletes based on this contract table. Keep owner-read disabled and all Cloud Run IAM/traffic unchanged.


## 2026-11-14 — Exact operational safeguards and API response review

**SOURCE-REVIEW ONLY; DO NOT RUN LIVE CREATE/DELETE.** REST docs reviewed: [Identity Platform admin create](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects/accounts), [exact UID delete](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/delete), and [Firestore createDocument/delete](https://firebase.google.com/docs/firestore/reference/rest/). The docs clarify that admin creation can specify `localId` with OAuth and a project API key, and delete requires `firebaseauth.users.delete`; neither proves this operator can delete in practice. We cannot honestly guarantee cleanup before creating an Auth test user without first conducting a controlled create/delete; this is a risk decision that must be explicitly disclosed to the owner.

### Execution boundaries and proposed API requests

1. **Immutable account/project gate**: active gcloud user `yasminparmar087@gmail.com`, project `oldx-staging`, database `(default)`; deny any other context, redirect and host. Use token from gcloud in process memory only; never print or persist it. Every request sets `X-Goog-User-Project: oldx-staging`. Do not enable services or alter roles.
2. **Fixed targets**: Auth `synthetic-seller-a`, `synthetic-buyer-b`; Firestore `marketplaceActors_v1/synthetic-seller-a`, `marketplacePrivate_v1/product_synthetic-phase-b-read-01`. A fresh exact-UID lookup and exact Firestore document GET must show absence. Any HTTP error other than documented 404 on Firestore GET is a **STOP**.
3. **Auth create request template (not runnable):** `POST https://identitytoolkit.googleapis.com/v1/projects/oldx-staging/accounts?key=<STAGING_API_KEY>`, with OAuth Bearer + quota-project header and body `{"localId":"<EXACT_UID>","email":"<ISOLATED_SYNTHETIC_EMAIL>","password":"<EPHEMERAL_SECRET>","emailVerified":false}`. Omit `idToken`, avoid client self-sign-up, validate returned exact UID; don't print response (may contain session tokens). Credentials should be entered only via hidden prompt or equivalent and never passed via shell args, logged or committed.
4. **Firestore create-only template:** `POST https://firestore.googleapis.com/v1/projects/oldx-staging/databases/(default)/documents/<EXACT_COLLECTION>?documentId=<EXACT_DOC_ID>` with typed JSON schema from `scripts/phase-b-firestore-typed-fixture-preview.mjs` and a separately reviewed nonsecret provenance marker. Abort on ALREADY_EXISTS, do not upsert or PATCH. Capture `name`, `createTime` and `updateTime` locally without exposing record contents. Zero writes to rate-limit counters absent separately approved runtime activation.
5. **Verify:** exact Auth lookup must match reserved UID and creation timestamp/metadata for each new user; exact document GET must match `name`, collection, expected owner and marker. An unexpected response, stale/unknown UID, or changed data must **STOP** and trigger incident review rather than broad deletion.
6. **Conditional Firestore delete template:** re-read exact document, confirm `createTime`, owner and run marker, then `DELETE .../{exactPath}?currentDocument.updateTime=<ENCODED_FRESH_UPDATE_TIME>` only after individual review; stop on 409/412/unknown, then verify 404 for each target. A conflicting updateTime protects a changed document.
7. **Auth delete template:** re-read exact UID; confirm session inventory, matching `localId` and `createdAt`/creation timestamp, no unexpected metadata, then `POST https://identitytoolkit.googleapis.com/v1/projects/oldx-staging/accounts:delete` with `{"localId":"<EXACT_UID>"}`, OAuth + quota header. **Auth deletion has no atomic generation precondition**: a time-of-check/time-of-use race cannot be eliminated by these checks. Never auto-retry an ambiguous result; verify by another exact-ID lookup and stop/alert on discrepancy.
8. **Session and recovery:** capture start time/cutoff IST, keep minimal secure local per-ID inventory and durable owner-readable record of **only nonsecret** statuses and four exact paths; do not put account credentials or Google access tokens in log/commits/screenshots. On any crash/timeout after a possible create, *read exact ID before taking further action*, do not blindly repeat creation. Partial progress must be reported with exact remaining IDs. Protect inventory against loss/unauthorised edits. At end confirm **four absent** and report actual evidence rather than calling the run successful based on HTTP 200 alone.

### Readiness and honest limitation

**No cloud writes have been made; this is not an executable procedure yet.** Prior scoped IAM `testIamPermissions` for Yasmin reported `firebaseauth.users.delete` GRANTED, but success of live Auth Delete and any safe rollback **cannot be independently proven with zero fixtures**. The safest next owner decision before the first write is whether to authorize a **single sacrificial, uniquely named synthetic Auth user created and deleted under direct supervision as a separate scoped operation**, accepting that a cleanup failure could temporarily leave that synthetic user. That fifth user is **not** covered by the currently approved four-resource scope, so it requires a new precise approval; alternatively do not conduct that proof and keep Phase B creation blocked. Do NOT silently create this user. Same-day cleanup requires owner presence and verified follow-up; no automatic scheduled deletion exists.



## 2026-11-14 — Separate owner decision packet: single disposable Auth CRUD probe

**Status: proposal only — no authority to create/delete an extra identity.** The user's generic “continue” authorizes further review work, not this fifth real Firebase Auth account. This proposal is strictly separate from the previously approved four-resource fixture plan, and no Cloud calls are made by documenting it.

### Exact proposed boundary

- Project: **`oldx-staging` only**, using Yasmin's verified `yasminparmar087@gmail.com` operator identity and the already working `X-Goog-User-Project: oldx-staging` header; no project/IAM/API/OAuth client/Rules/Billing/Cloud Run/production modification.
- Proposed disposable Auth UID **`synthetic-auth-crud-probe-20261114`**; proposed isolated email **`oldx-auth-crud-probe-20261114@example.invalid`**. Confirm both UID/email do not exist using exact authorized lookups before any create. If an unexpected collision occurs, STOP and seek fresh approval; do not change names automatically.
- **One** Auth create and, following successful exact-UID lookup/provenance verification, **one** Auth delete. No additional Firestore documents, uploads, messages, rate-limit writes, real emails, token sign-ins, Cloud Run traffic or live owner-read tests. No record enumeration.
- Keep password in process memory via hidden prompt; do not save passwords, API key, OAuth token, Firebase user response body, identity token or refresh token in shell command history, repository, chat or diagnostics. Do not print raw API errors. No SA private keys.
- For a supervised same-day session only: confirm explicit operator presence, local date/time and cutoff, current exact UID absent, Auth API key availability, create URL/auth header contract, **review exact executable command before running**, persist nonsecret minimal cleanup inventory and success/failure statuses, verify the returned UID and creation timestamp match, then attempt a single exact-UID delete. Re-lookup exact UID after deletion; **only absent** counts as cleaned.
- If Auth create fails/returns ambiguous status, perform exact-UID lookup before any further action; no blind retries. If delete fails or has an ambiguous outcome, repeat the exact-ID lookup only, STOP and disclose the unresolved synthetic account. No force deletion of a UID that differs from session provenance.
- **Irreducible limitation:** Auth delete has no Firestore `currentDocument.updateTime`/generation precondition. There is a narrow time-of-check/time-of-use race, and the first live create/delete probe cannot have its own deletion guaranteed in advance. Yasmin must explicitly accept this residual risk; a synthetic user could remain temporarily and require a separate recovery action. An operator-supervised same-day attempt does **not** equal automatic cleanup; **do not promise a guaranteed 24-hour removal**.
- The approved four-resource Phase B run stays completely separate. A successful disposable probe would support Auth CRUD readiness, not approve actual four-resource creation or any Cloud Run activation.

### Approval to request verbatim, BEFORE mutation

“`oldx-staging`માં માત્ર **`synthetic-auth-crud-probe-20261114`** UIDવાળો એક વધારાનો નકલી Firebase Auth User બનાવી, તેની ઓળખ ચકાસીને **એ જ નિયંત્રિત Sessionમાં Delete કરવાનો પ્રયાસ** કરવા મને અલગ મંજૂરી છે. Cleanup નિષ્ફળ જાય તો User અસ્થાયી રીતે બાકી રહી શકે છે તે જોખમ સમજું છું. પહેલા સંપૂર્ણ Executable Commands બતાવો. IAM, Rules, Billing, Cloud Run, Production અથવા અન્ય Users/Documentsમાં ફેરફાર મંજૂર નથી.”

Only if Yasmin explicitly accepts this scope and risk, separately prepare/review exact commands and confirm supervised operator presence; **approval does not by itself trigger execution**. Without it, **NO-GO for fifth user and existing four-resource run**.
