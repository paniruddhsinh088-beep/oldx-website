# OLDX Phase B — Synthetic Product Owner Read acceptance (approval packet)

**Status: preparation approved; live users/documents, IAM changes, feature activation and traffic are NOT approved.** Source plan only, 2026-11-13. Project `oldx-staging`; Firestore Native `(default)` in `asia-south1`. **Production HOLD / NO-GO.**

## Reuse and isolation

- Reuse existing fake-account identifiers from `tests/firestore-emulator/fixtures.json`: `synthetic-seller-a` (owner) and `synthetic-buyer-b` (foreign reader). They are *names in a local test fixture*, **not existing Firebase Auth users**. The `example.invalid` email addresses are not deliverable accounts. Do not use real existing users.
- Reuse native marketplace namespace constants from `scripts/staging-marketplace-context.mjs`, not legacy `products`, `stores`, or public client collections. The proposal `tests/integration/fixtures/phase-b-owner-read-plan.json` is a **design-only manifest**, not a valid Firestore write payload. `marketplacePrivate_v1/product_synthetic-phase-b-read-01` is a proposed isolated fixture path only; its schema and actor eligibility requirements must be independently validated against the existing trusted repository before any approved live write.
- The sole HTTP route in scope is `POST /api/staging/marketplace/owner`. `save`, `archive`, media, publication, chats, stores and provider endpoints are out of scope. No public Browser Rules edits and no legacy data migrations.

## Preconditions before any real synthetic test

1. Explicit Yasmin owner approval of the **actual** temporary Firebase Auth users, their creation method without passwords/secrets in GitHub/chat, exact document schemas/paths, quota-counter side effects, 24-hour-or-shorter deletion/retention decision and a reversible cleanup procedure. Verify synthetic IDs do not collide with existing records; do not enumerate or inspect existing user data without approval.
2. Independent evidence of effective database-scoped IAM for `oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com`, inherited/group grants, no accidental access to other databases. The project custom role includes `datastore.entities.create` and `datastore.entities.update`; it is *not a pure read role*, because trusted atomic rate-limit counters may write. Treat an IAM condition string as configuration evidence, not runtime enforcement proof.
3. A separately named, least-privilege Cloud Run invoker or an explicitly approved temporary tester identity. Yasmin's project-owner token can demonstrate authentication, not least privilege. Current Cloud Run ingress is `all` with IAM checks (internet-reachable endpoint, not internal-only). Any tighter ingress or new IAM binding requires separate approval and verified caller path.
4. Approve exact activation settings and image digest for a new **0%-main-traffic** revision, 200 attempts / 60 minutes / 1,000 billed instance-seconds stop limits, acceptable logging/Firestore write cost, and explicit rollback. Do not promote the currently disabled 100%-traffic revision. No keys, no credentials or real tokens in files, logs or chat.

## Acceptance matrix (not yet executed)

| Scenario | Expected outcome | Data change permitted |
| --- | --- | --- |
| `/health` on authenticated tagged revision | 200 | None |
| Owner endpoint on disabled tagged revision | 503 | None |
| Valid owner Firebase token + named authorized Google invoker + synthetic private owner record on separately approved enabled revision | 200 with bounded owner-only DTO and `private, no-store` | Only trusted quota-counter writes if explicitly approved |
| Unauthenticated invoker | Google IAM denial, before app | None |
| Missing/invalid/revoked or foreign-project Firebase token | Denied before private record exposure | No private record writes |
| Different synthetic buyer UID reading owner's private product | Denied | No private record writes |
| Wrong project/database/ADC identity or missing rate policy | Fail closed / no runtime activation | None |
| Global or actor quota exhausted | 429 (or documented fail-closed status) | Only separately approved counter operations |
| Public/legacy namespaces and unrelated operation routes | No access | None |
| Rollback | Disabled revision still gives owner 503 | No new private reads |

## Current verified Phase A baseline

- Disabled revision `oldx-owner-read-00001-8kr` has 100% main traffic. Updated disabled revision `oldx-owner-read-00002-tid`, tag `healthcheck`, has 0% main traffic.
- Immutable updated image: `asia-south1-docker.pkg.dev/oldx-staging/oldx-staging-images/oldx-owner-read@sha256:def649753dddf65cdfbff45f5556be493f7bf69e8f1e2def033c01596f84882e`.
- Owner screenshots: authenticated tagged `/health` 200; tagged Owner API 503; anonymous tagged `/health` and Owner API 403. No Firebase Owner Read activated.

## Stop and cleanup

Stop on any unexpected 200, foreign UID acceptance, wrong project/database, unknown data, unapproved write, missing denial, observed spend/usage beyond the trial envelope, or failure to reach disabled revision. Record requests only by status and synthetic case IDs; keep tokens, record contents, PII and raw auth errors out of reports. Verify restoration to default-off before any cleanup. Synthetic user/document creation and deletion **must each be separately approved**; never use broad delete/list cleanup.

**This document and its associated local-only fixture/test are not permission to deploy or access Firebase.**


## Exact isolated fixture proposal from trusted source

The existing `marketplaceCore.owner` implementation in `scripts/firebase-marketplace-repository.mjs` reads `marketplaceActors_v1/{verifiedUid}` and `marketplacePrivate_v1/product_{id}`. Its checks require an actor with `uid=verifiedUid`, `canWrite=true`, `suspended=false` and a private record whose `ownerUid` matches that identity, `kind=product`, matching `id`, `revision>=1`, `archived!==true`, valid `profile`, Boolean `published`, and integer `publicationRevision<=revision`. The HTTP owner request must supply `kind=product`, `id` (without the `product_` storage prefix), and `requestId=null` to avoid requiring historical receipt/audit records.

**Review-only illustrative record shapes; not executable fixture seeding instructions:**

```json
{
  "actorPath": "marketplaceActors_v1/synthetic-seller-a",
  "actorFields": {
    "uid": "synthetic-seller-a",
    "canWrite": true,
    "suspended": false
  },
  "recordPath": "marketplacePrivate_v1/product_synthetic-phase-b-read-01",
  "recordFields": {
    "id": "synthetic-phase-b-read-01",
    "kind": "product",
    "ownerUid": "synthetic-seller-a",
    "revision": 1,
    "archived": false,
    "published": false,
    "publicationRevision": 0,
    "publicProfile": null,
    "profile": {
      "title": "Synthetic Product",
      "description": "Fictional staging-only listing",
      "category": "cars",
      "locationLabel": "Synthetic location",
      "basePrice": 100,
      "isSold": false,
      "storeId": null,
      "photos": []
    }
  },
  "ownerRequestBody": {
    "kind": "product",
    "id": "synthetic-phase-b-read-01",
    "requestId": null
  }
}
```

This object is a **schema review reference only**. Validate any additional fields and the SDK's `validateMarketplaceProfile`/image-reference behavior with offline tests before owner approval to create anything. Do not assume document/actor fixtures already exist; avoid collisions and do not overwrite any existing entry. `firebaseauth.users.get` is separate from Firestore access. Firebase Auth users for testing must be created through a separately approved mechanism; a fake `example.invalid` identity in a JSON fixture does not make a usable Firebase ID token.

**Minimum live-write manifest to approve separately:** two synthetic Auth identities (owner and foreign buyer); one private actor document; one private product document; any quota-counter document(s) automatically created/updated by `marketplaceRateLimits_v1` for authenticated requests. No write to `products`, public views, legacy stores, other real users or production. Document IDs, creation timestamps, and deletion cutoff must be recorded at creation; cleanup is per-ID with verification of ownership and no broad collection deletes. The test initiator must approve both creation and cleanup independently. A rejected foreign request must not read or expose the private record; counter side effects must be budgeted and logged only as counts.

**Offline gate before actual Phase B:** execute `node --test tests/integration/phase-b-owner-read-fixtures.test.mjs` using the required Node 24 runtime and confirm current commit's CI. Do not relabel static fixture assertions as deployed IAM enforcement. Only after explicit cloud-data and activation approval should direct private-scope testing start. Preserve Phase A default-off revisions and unchanged main traffic.


## Exact cloud-data approval request — not yet granted

The requested **next owner decision** is deliberately narrower than Phase B activation:

- **Purpose:** authorize a *separate future, explicitly reviewed* staging-only fixture-creation step. No real data and no new project/database.
- **Resources proposed:** two new Firebase Auth test users with reserved synthetic UIDs `synthetic-seller-a` and `synthetic-buyer-b`, after proving the UIDs are unused; actor `marketplaceActors_v1/synthetic-seller-a`; private product `marketplacePrivate_v1/product_synthetic-phase-b-read-01` in `oldx-staging/(default)` after checking paths do not already exist. This is **not permission to create them yet**.
- **Record content:** exactly the schema-review fields above, no contact details, images, coordinates, IP addresses or external URLs. No broad collection queries, no legacy namespace changes, no public projections, no uploads.
- **Auth-user provisioning blocker:** choose a secure, independently approved method to issue two **real test Firebase ID tokens** without storing passwords, tokens, service-account keys or account credentials in GitHub/Chat. Existing fixture JSON identities do not produce usable Firebase Auth accounts. No unauthorised `firebaseauth.users.create` IAM grant.
- **Writes and retention:** actor/product creates require explicit cloud-write approval; atomic rate-limit quota-counter create/update occurs only in a separately approved, activated test. Record exact paths and result counts; maximum retention proposed is 24 hours from first creation. Because destructive operations require separate approval, obtain specific per-ID deletion/cleanup permission and confirm before creation that these exact identities and paths can be cleaned up safely.
- **Not in this approval:** Cloud Run deployment, IAM binding, impersonation, ingress alteration, Firebase Rules changes, Billing changes, live owner-read activation or service traffic promotion. **Production HOLD / NO-GO**.
- **Stop:** if actor IDs or doc paths already exist, cannot prove isolated identity, lack permissions for cleanup, or any price/usage unknown, stop before a write.

Once this precise proposal is approved by Yasmin, the operator must still prepare and review a bounded, copy-pastable create/verify/cleanup procedure before any cloud mutation; her general “continue” does not grant mutation authority.


## Owner-approved procedure preparation — 2026-11-13

**Approval interpretation:** Yasmin approved **preparation of the safe fixture provisioning/cleanup procedure** only. She has **not yet approved execution** of cloud writes, actual Firebase Auth user provisioning, deletion, IAM modification, Firestore Rules changes or runtime activation. No credential or token is needed to prepare this packet.

### Exact proposed scope (no cloud writes executed)

| Type | Exact proposed staging identifier | Safe creation / collision policy |
| --- | --- | --- |
| Firebase Auth owner | `synthetic-seller-a` | Preflight exact UID lookup only; must be `NOT_FOUND` before create; do not overwrite/enable/delete an existing user |
| Firebase Auth foreign buyer | `synthetic-buyer-b` | Same exact-UID, non-destructive guard |
| Firestore eligible actor | `marketplaceActors_v1/synthetic-seller-a` | Exact-document read check absent, then create-only; never set/merge/overwrite |
| Firestore private product | `marketplacePrivate_v1/product_synthetic-phase-b-read-01` | Exact-document read check absent, then create-only |
| Firestore rate counters | `marketplaceRateLimits_v1` | Not seeded by fixture preparation. Writes only by separately approved enabled runtime. Capture exact touched counter IDs for later per-ID cleanup; no bulk delete |

All identifiers are staging-only, synthetic and proposed. They may not be used if a collision is found, even if an existing record has the expected shape. No existing data contents should be captured in logs or reports.

### Proposed secure operator procedure — review draft, DO NOT RUN

**Gate 0 — owner and access:** confirm a separate written authorization for the exact four creates and separately authorized deletion of those same IDs, plus a decision on whether cleanup of any generated rate counters is permitted. Identify a named operator with already permitted Auth user creation and Firestore document creation/deletion access, without adding broad IAM grants. If unavailable, remain BLOCKED. Pre-approve how the two synthetic users will obtain genuine Firebase ID tokens for later tests without committing or sending passwords, refresh tokens or tokens. Prefer isolated temporary credentials delivered through an approved secret mechanism; never use service-account JSON keys or hard-coded credentials. Auth test user creation without a safe token acquisition route does **not** complete this gate.

**Gate 1 — immutable target:** ensure the active Google project is exactly `oldx-staging`, Firestore database exactly `(default)`, correct Mumbai region and project number `38472235077`, and production project `oldx-1c983` is excluded. Confirm Firestore client Rules remain deny-all without attempting to alter them. Never accept current gcloud default implicitly; require explicit project and database in every SDK initialization.

**Gate 2 — narrow collision checks:** using separately authorized principal and exact lookups only, apply `adminAuth.getUser("synthetic-seller-a")`, `adminAuth.getUser("synthetic-buyer-b")` and `db.doc(exactPath).get()` for the two documents. For the Auth API, only an exact `auth/user-not-found` means vacant; any other error is STOP. Firestore `snapshot.exists===false` is required; permission denied/unknown is STOP. No queries over whole collections or population-wide listing. Protect IDs from a concurrent provisioning race by using create-only operations and treating `already-exists` as STOP.

**Gate 3 — minimal creates:** only after separate approval, construct actual users with explicitly controlled synthetic UIDs and a reviewed safe sign-in/token method (the earlier `example.invalid` addresses are placeholders, not sign-in readiness). Create only the Actor and Product document schemas already reviewed above, with `db.doc(...).create(data)`; never `set`, merge, recursive delete or overwrite. Actor and private product contents must be synthetic, no telephone, IP, coordinate, photo or URL. Write no public projection or legacy product/store records. If one create fails, STOP and perform only pre-authorized exact-ID partial cleanup after verifying marker/ownership.

**Gate 4 — verification without activation:** record four newly created resource IDs, UTC creation time, expected expiry within 24h, exact approved deletion scope, status of user/doc identities and maximum request/transaction count. Confirm owner and foreign identities differ; confirm no unexpected record creation. Do **not** run enabled Owner Read, mint impersonated service-account tokens, or activate Cloud Run at this gate. An owner-approved future runtime test is independent.

**Gate 5 — safe cleanup:** at expiry or on STOP, use a second scoped owner approval or the separately pre-authorized cleanup mandate to verify each exact ID is still a test-owned fixture (including `ownerUid`, kind, ID, and known creation/audit marker) immediately before deletion, then delete by exact ID only. If contents changed, verification fails, quotas have unknown IDs, or a delete is denied, halt and record residue for manual review; never force a broad cleanup. Verify exact-document/user lookups return absent. Deleting both users can invalidate test tokens; no real-user accounts may be touched.

**Costs and limits:** preparation is GitHub-only. Before any actual cloud step, re-confirm budget headroom and user-approved envelope. Budget alerts alone cannot cap spending. The separate runtime-test request remains bounded to 200 attempts / 60 minutes / 1,000 billed instance-seconds with zero-main-traffic revision and disabled baseline. A 24h lifetime is a proposed retention ceiling, **not** approval to run automation or delete on schedule.

**Blockers still open:** approved real Firebase test ID-token acquisition method, actual cloud creation and cleanup permissions, data retention/cleanup authorization, effective service account IAM condition, least-privilege invoker and exact runtime activation/image/ingress decision. Do not change IAM or enable Policy Troubleshooter in this procedure.

### Acceptance of procedure preparation

This document is the **prepared procedure**. No live command or create/delete script is included to prevent accidental running under incomplete approvals. Before executing anything, the owner must see an explicit create/verify/cleanup script with immutable target and create-only guards and grant a **new, precise execution authorization**.


## Offline dry-run implementation checkpoint

Created `scripts/phase-b-offline-fixture-preflight.mjs` and `tests/integration/phase-b-offline-fixture-preflight.test.mjs` on `security-hardening-review`. This is **not a cloud provisioner**: it imports only Node built-ins, reads existing reviewed JSON, validates the fixed staging target and synthetic IDs, prints the two proposed Auth IDs and two private document paths, and lists create-only, collision-check and exact-ID cleanup requirements. It accepts only `--dry-run`; `--create`, `--verify`, `--cleanup` or extra arguments are rejected with exit status 2. No Firebase Admin SDK, Google client library, credentials, network or mutation implementation is present.

Offline run after obtaining latest review-branch code (Node 24):

```bash
node scripts/phase-b-offline-fixture-preflight.mjs --dry-run
node --test tests/integration/phase-b-offline-fixture-preflight.test.mjs
```

**These new tests have not been reported as executed yet.** This is an implementation checkpoint, not evidence of synthetic Firebase data being created, token acquisition, IAM enforcement, rollback or enabled runtime acceptance. A future create/verify/cleanup tool must remain a separate artifact and require another specific owner approval after the exact data retention, cleanup permission, identity/token path and access risks are closed.


## Proposed token acquisition and exact-ID cleanup — decision checkpoint

**2026-11-13: source/documentation review only. No credentials acquired or identity/provider settings changed.** Official Firebase references: [Admin manage users](https://firebase.google.com/docs/auth/admin/manage-users), [Firebase Auth REST API](https://firebase.google.com/docs/reference/rest/auth/).

### Separate the two authentication layers

1. **Cloud Run invocation:** an authorized Google IAM principal must supply a Google-signed identity token whose audience matches the target `run.app` service URL. It is passed in the `X-Serverless-Authorization` header (already exercised by the operator owner in Phase A, **not least-privilege proof**).
2. **Firebase End User:** a *different* Firebase ID token is passed in `Authorization: Bearer <FIREBASE_ID_TOKEN>` and verified with revocation checks by the trusted runtime. The Firebase ID token is not a Cloud Run invoker token. Do not put either token in chat, GitHub, shell history, saved logs, screenshot or CI environment. Never combine two different tokens in the same header.

### Recommended **future** test identity flow — NOT APPROVED TO EXECUTE

- **Preflight:** independently confirm `oldx-staging` Firebase Email/Password sign-in provider is already enabled. If it is disabled, STOP; enabling a provider is a separate owner-gated settings change. Verify named operator can **already** create and delete Firebase Auth test accounts by exact UID without granting project-wide broader IAM. The dedicated runtime SA currently has only `firebaseauth.users.get`, not `users.create`, `users.delete` or a token signing grant; **do not expand it** for fixtures.
- **Create:** after separate authorization and exact UID-not-found guard, use Firebase Admin SDK `getAuth(app).createUser({uid, email, password, emailVerified:false, disabled:false})` for the two synthetic users with locally generated strong, unique, temporary passwords supplied through a reviewed secure ephemeral channel. `example.invalid` emails in local JSON are placeholders: verify whether permitted by provider policy for test login; do not assume account or login already exists. Never record passwords in the manifest or source.
- **Sign-in:** only after separately approved creation, use a dedicated isolated test client or the Firebase Authentication REST `accounts:signInWithPassword` method using the staging **Web API Key** from approved project configuration (not a service-account private key). Parse `localId` and require it matches the exact intended synthetic UID; use the returned **`idToken` in-memory only**. Avoid outputting the full JSON response, which also contains a refresh token; never run with shell tracing (`set -x`) or transmit tokens to the chat. Clear local temporary password/token holders after the bounded test. A public Firebase Web API Key is not itself authorization to access Firestore; deny-all client Rules remain.
- **Revoke/negative test:** Do not actually disable/revoke or delete a test user merely to simulate revocation until explicit mutation and cleanup approvals. Existing offline doubles already cover simulated revoked tokens. If an approved live revocation test is needed later, budget it as an additional Auth mutation and avoid testing a real account.
- **Two-factor caller identity:** the Cloud Run tester must have a named least-privilege IAM invocation path separately approved. Never silently rely on Yasmin's project-owner privileges as the production/test model.

### Exact-ID cleanup contract and risk

- **Creation manifest:** record only the two exact synthetic UIDs, two exact Firestore document paths, creation timestamp, proposed expiry within 24h, a random non-secret test-run marker, **redacted** result statuses and exact quota-counter paths actually touched. Reconcile manifest before enabling any runtime test.
- **Document deletion:** using an already authorized test operator and a separately approved cleanup scope, re-read the two exact documents. Check the test-run marker, private product `ownerUid`, `kind`, `id`, and the expected payload before deleting. Delete each *exact* document by ID only; if changed, missing or unknown, STOP and log residue (not contents). For a race-free production-grade cleanup design, review Firestore update-time preconditions before any actual deletion; a pre-delete read alone is not atomic protection against intervening writes.
- **Auth deletion:** using exact `getUser(uid)` read, verify the test-run marker or immutable creation evidence plus the known synthetic identity; then request separate permission to call `deleteUser(uid)` for those two UIDs only. Never list/export other users, call `deleteUsers` for multiple IDs, or use project-wide operations. If account ownership cannot be established, STOP.
- **Quota counters:** no IDs are yet known. Never delete the entire `marketplaceRateLimits_v1` collection. If the runtime later creates counters, capture their exact IDs and approve individual cleanup, or leave them until retention rules are separately decided. Do not claim cleanup complete while any quota counter/test account remains.
- **Stop and cost policy:** absence of Email/Password provider, identity-creation permissions, proper per-ID cleanup, accurate IAM enforcement proof, a safe token transport, or budget headroom is a BLOCKER, not a reason to weaken guards or switch to a service-account JSON key. Cloud data and auth operations can incur usage; budget alerts are advisory rather than hard limits. No automatic deletion is scheduled.

### Current explicit permissions boundary

Yasmin has approved **preparing this plan and offline-only tooling**. The owner has **not approved actual creation, login, token acquisition, Firestore record read/write, cleanup deletion, IAM change, enabled Cloud Run revision or production activation**. Next authorization must name exact create and delete resources, named actor, retention and cleanup, and how credentials will be handled. Provide a separate scoped execution checklist/script **for review** before asking to run it.

## Phase B acceptance harness and supervised closeout

The import-only harness uses the existing fixture profile, fixed product ID and private owner route. It expects the complete synthetic owner DTO, rejects extra fields, requires private/no-store on application replies and stops on the first unexpected result. A transport must honor the provided abort signal, reject redirects, send each request once and bound response reads before parsing. For Cloud Run edge denial, verify the 403 has no application data, then pass the status alone to the harness. The harness has no live transport, token loader or CLI. If the service-reported tag URLs differ from the pinned deterministic staging form, stop for source review. Never substitute another project or target.

The fixture runner's in-memory post-sign-in hook is wired only through the offline simulation entry point. A separately reviewed and approved future operator entry point must bind the harness and authorized transport to that hook while tokens are available. Neither the existing CLI nor its execution gate was enabled. A harness failure stops the session and leaves receipts for read-only inspection and supervised cleanup under the [existing recovery procedure](phase-b-fixture-execution-review.md#interrupted-four-fixture-session-runbook).

1. Confirm the [IAM and invocation checklist](cloud-run-product-owner-read-staging-gate.md#phase-b-read-only-iam-and-invocation-checklist), exact image, revision and rollback operator. Verify the disabled baseline with health 200 and owner 503. Only after separate approval use a temporary tagged revision with zero main traffic and preserve the disabled baseline.
2. Record the trial start and count all attempts across setup, harness and rollback. Stop new probes by 200 attempts, 60 minutes or 1,000 billed instance-seconds, whichever comes first. Observe billing and quota telemetry separately and reserve headroom for closeout. The harness limits its own calls but cannot enforce billed time. Stop immediately on unexpected data, identity, access, configuration, writes or consumption.
3. Run a wrong-project check only with an independently approved synthetic token. Run rate-limit and quota-failure checks only when an approved isolated setup can independently control quota state and dependency failure. Otherwise record them deferred for hosted acceptance. No forced hosted fault or traffic flood.
4. Stop sending requests on failure. The separately authorized rollback operator restores default-off behavior, removes temporary routing and invocation access as scoped, and verifies the disabled owner 503 or expected edge denial. Reconcile exact quota-counter IDs separately. Preserve the journal, perform only approved exact-ID fixture cleanup with the original Firestore updateTime and Auth creation evidence, and verify all four absent. Ambiguity requires read-only inspection and manual review. Report incomplete rollback or cleanup explicitly.
