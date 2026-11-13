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
