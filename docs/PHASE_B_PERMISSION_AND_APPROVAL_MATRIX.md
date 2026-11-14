# OLDX Phase B — Permission and Approval Matrix

**As of:** 2026-11-14  
**Branch:** `security-hardening-review`  
**Status:** Review/preparation only. No live IAM, Firebase, Cloud Run, Billing, Rules, fixture or Production operation is authorized by this matrix. **Production HOLD / NO-GO.**

## 1. Identities and exact scope

| Identity / resource | Intended purpose | Scope | Evidence status |
|---|---|---|---|
| Operator: `yasminparmar087@gmail.com` | Supervised exact-ID read-only preflight, Auth fixture lifecycle and Firestore cleanup | `oldx-staging`; two exact synthetic Auth UIDs and two exact Firestore paths only | Actual active Cloud Shell identity and effective permissions must be freshly verified |
| Runtime service account: `oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com` | Phase B runtime Firestore GET/CREATE/revision-only UPDATE | `oldx-staging/(default)`; fixed fixture paths only in runner | Existing role definition is source evidence; effective permissions remain UNVERIFIED |
| Firestore database | Target database | Native `(default)`, project `oldx-staging`, region recorded as `asia-south1` | Prior dated observation; reconfirm only in approved read-only preflight |
| Auth UIDs | Synthetic seller and buyer | `synthetic-seller-a`, `synthetic-buyer-b` | Proposed IDs; current existence/absence UNVERIFIED |
| Firestore documents | Synthetic actor and private product | `marketplaceActors_v1/synthetic-seller-a`; `marketplacePrivate_v1/product_synthetic-phase-b-read-01` | Proposed paths; current existence/absence UNVERIFIED |

## 2. Permission matrix — fixture verification

| Actor | Minimum intended permission | Why | Current status / boundary |
|---|---|---|---|
| Operator | `firebaseauth.users.get` | Exact UID preflight and immediate identity reread | Effective grant UNVERIFIED |
| Operator | `firebaseauth.users.create` | Create the two approved synthetic Auth users, if/when separately authorized | Effective grant UNVERIFIED; no create now |
| Operator | `firebaseauth.users.delete` | Individually supervised cleanup of the two exact synthetic UIDs | Effective grant UNVERIFIED; Auth deletion has no atomic UID-generation precondition |
| Operator | `datastore.entities.get` | Exact document preflight, provenance reread and cleanup verification | Effective grant UNVERIFIED |
| Operator | `datastore.entities.delete` | Conditional cleanup of the exact two synthetic Firestore documents | Effective grant UNVERIFIED; require exact payload/owner/marker/createTime/receipt and atomic `currentDocument.updateTime` precondition |
| Runtime service account | `datastore.entities.get` | Exact point GET of the two fixture documents | Effective grant UNVERIFIED |
| Runtime service account | `datastore.entities.create` | Create-only exact fixture documents | Effective grant UNVERIFIED |
| Runtime service account | `datastore.entities.update` | One revision-only PATCH on the fixed private product, guarded by original `updateTime` | Effective grant UNVERIFIED |
| Runtime service account | `datastore.entities.delete` | **Not required; must remain denied** | Runner has no DELETE transport route; effective IAM denial UNVERIFIED |
| Operator | `iam.serviceAccounts.getAccessToken` on the exact runtime service account | Mint the short-lived datastore-scoped runtime OAuth access token | Current evidence identifies a mismatch: `roles/iam.serviceAccountOpenIdTokenCreator` supplies `getOpenIdToken`, not `getAccessToken`. Do not assume it can mint the OAuth access token. |

The role `oldxProductReadFirestore` was previously observed with `datastore.databases.get`, `datastore.entities.get`, `datastore.entities.create`, and `datastore.entities.update`. It does not include entity DELETE. A role listing or IAM condition string is not proof of effective enforcement. The previously observed condition expression was `resource.name == "projects/oldx-staging/databases/(default)"`; inherited/group grants and actual condition enforcement remain unverified.

### Critical credential blocker

The fixture runner's direct runtime probe uses IAM Credentials `generateAccessToken`, which requires `iam.serviceAccounts.getAccessToken`. The recorded `roles/iam.serviceAccountOpenIdTokenCreator` grant is for OIDC ID-token minting and is not interchangeable. Do not substitute `generateIdToken` for a Firestore REST OAuth access token. Do not grant broad `roles/iam.serviceAccountTokenCreator`. If direct runtime proof remains necessary, prepare a separate approval request for a custom role containing only `iam.serviceAccounts.getAccessToken`, bound on the exact runtime service account to the named operator for the shortest supervised window. This is a proposed permission change, **not approved or applied**. Alternatively leave direct runtime proof UNVERIFIED.

## 3. Separate Owner Read / Cloud Run permissions

The Owner Read service is a separate workstream from the Phase B fixture runner. Its candidate runtime permission set in `docs/cloud-run-product-owner-read-staging-gate.md` includes:
- `firebaseauth.users.get` for session revocation/disabled-account lookup;
- `datastore.databases.get` for transactions;
- `datastore.entities.get/create/update` for private point reads and quota-counter upserts.

The quota counter writes mean the endpoint is not purely read-only at the datastore layer. Candidate grants must be validated against the pinned SDK and actual code paths. Runtime must exclude entity list/delete, Auth mutation, Rules, Storage, IAM administration and Production access. Firestore IAM does not scope by collection/document; database isolation must be proven before accepting any broader grant.

Separate identities are required for provisioning operator, image publisher, revision deployer, runtime service account and invoker/tester. Any deployer `iam.serviceAccounts.actAs`, Cloud Run invoker binding, Cloud Run API enablement, service deployment, ingress change, image publication or activation requires its own explicit approval. The recorded Owner Read service remains HOLD; no Cloud Run activation is authorized here.

## 4. Approval ledger

| Action | Current decision |
|---|---|
| Repository-only review, offline tests, documentation | Allowed within existing review-branch policy |
| Auth cleanup design | Yasmin selected Option 2: Supervised Cleanup |
| Actual creation of two Auth users and two Firestore fixtures | **Separate exact execution approval still required** |
| Actual Auth deletion | Supervised option selected, but exact session/revision and live execution approval still required |
| Actual Firestore conditional deletion | Exact session/revision and live execution approval still required |
| Read-only exact-ID staging preflight | Must be performed only in a separately approved operator session; verify project and account first |
| IAM permission/binding/condition changes, including `getAccessToken` grant | **Not approved** |
| Firebase Rules changes | **Not approved** |
| Billing linkage, budget or plan changes | **Not approved** |
| Cloud Run API enablement, service deployment, invoker/ingress changes or Owner Read activation | **Not approved** |
| Production deployment or traffic promotion | **HOLD / NO-GO** |

## 5. Required evidence before a future fixture execution request

1. Exact immutable code SHA and source review confirming `--execute` gate behavior.
2. Fresh, supervised confirmation of project `oldx-staging`, database `(default)`, and operator `yasminparmar087@gmail.com`.
3. Fresh exact-ID read-only preflight of both Auth UIDs and both Firestore paths; any EXISTS/BLOCKED result stops.
4. Exclusive journal readiness, private local storage, approved same-day cleanup window and named recovery operator.
5. Evidence that operator can perform exact-ID lookups and cleanup; a read-only permission check alone does not prove delete success.
6. Resolution of the OAuth token permission mismatch, either through a separately approved narrow `getAccessToken` grant or by leaving runtime proof UNVERIFIED.
7. Exact owner approval of the immutable execution revision, target IDs, allowed operations, stop conditions and cleanup procedure.

No single approval in this matrix authorizes the entire sequence. No credential, token, API key or private document payload may be placed in GitHub, handoff text, screenshots or chat.

## 6. Remaining gates

- Effective runtime Entity GET/CREATE/UPDATE: **UNVERIFIED**.
- Effective runtime Entity DELETE denial: **UNVERIFIED**.
- Operator Auth lookup/create/delete and Firestore get/delete: **UNVERIFIED**.
- Runtime database isolation and inherited/group grants: **UNVERIFIED**.
- Actual target absence and journal readiness: **UNVERIFIED**.
- Owner Read Cloud Run activation and private invoker acceptance: **HOLD**.

**No live operations were performed while preparing this matrix. Production HOLD / NO-GO.**

## 7. No-change Policy Troubleshooter path for the OAuth token blocker

Before considering any IAM grant, the operator can separately evaluate whether `yasminparmar087@gmail.com` currently has `iam.serviceAccounts.getAccessToken` on the exact runtime service-account resource using the documented gcloud Policy Troubleshooter command. This is an IAM policy evaluation, not token minting and not a Cloud/Firebase data-plane request:

```bash
gcloud policy-troubleshoot iam //iam.googleapis.com/projects/oldx-staging/serviceAccounts/oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com --principal-email=yasminparmar087@gmail.com --permission=iam.serviceAccounts.getAccessToken
```

Use only after confirming the active gcloud account and project. Do not add broader flags or substitute a project-level resource. Save only the sanitized access state and relevant explanation; never publish credentials or raw policy payloads. If the resource identifier is rejected, the result is inconclusive and remains UNVERIFIED. If access is GRANTED, this establishes only the permission evaluation for this exact service-account resource; it does not prove the IAM Credentials API is enabled, quota/project permissions are satisfied, the actual token exchange succeeds, or Firestore runtime permissions/database isolation work. If access is NOT_GRANTED, do not change IAM; request separate approval or leave the direct runtime verifier blocked.

This targeted evaluation may avoid the previous Firestore database tuple/condition-context HTTP 400 because it checks a distinct IAM service-account resource and permission. It does **not** resolve the Firestore database Policy Troubleshooter issue. The Firestore database-scoped tuple remains UNVERIFIED until Google-supported resource/permission evaluation is available or a separately approved operation provides evidence.

**No IAM change or token request is authorized by this step.** This is a read-only policy evaluation only. Official command syntax: https://docs.cloud.google.com/sdk/gcloud/reference/policy-troubleshoot/iam

## 8. Owner-observed scoped OAuth token role — 2026-11-14

**Newer owner-observed Cloud Shell screenshots (09:10–09:14 IST, 2026-11-14) supersede the earlier planning-time assertion of a missing `getAccessToken` grant.** The authenticated CLI session showed `yasminparmar087@gmail.com` and configured project `oldx-staging`. `gcloud iam service-accounts get-iam-policy oldx-product-read-staging@oldx-staging.iam.gserviceaccount.com --project=oldx-staging --format=yaml` showed a direct binding for `user:yasminparmar087@gmail.com` to `projects/oldx-staging/roles/oldxServiceAccountAccessTokenCreator` on that specific service account, as well as a separate `roles/iam.serviceAccountOpenIdTokenCreator` binding. `gcloud iam roles describe oldxServiceAccountAccessTokenCreator --project=oldx-staging --format=yaml` showed GA role with its single included permission `iam.serviceAccounts.getAccessToken`.

**Decision:** the narrow permission role and exact service-account binding are confirmed as configuration evidence. Do not propose another grant or broaden to `roles/iam.serviceAccountTokenCreator` merely to resolve the earlier assumed mismatch. This corrects the historic blocker description in sections 2–3 and 7 of this file; those sections are retained as dated historical analysis, **not the current finding**. The CLI Policy Troubleshooter has not returned a result in the supplied screenshots. Effective permission evaluation, successful IAM Credentials `generateAccessToken` exchange, quota/API requirements, and runtime Firestore permission/isolation remain **UNVERIFIED**. Do not infer runtime access from a role listing or static binding.

**Next step:** do not repeat already passed role and binding reads. If separately approved as read-only, run one narrowly scoped `gcloud policy-troubleshoot iam` evaluation for `iam.serviceAccounts.getAccessToken` on the exact service-account resource and record sanitized GRANTED/NOT_GRANTED/INCONCLUSIVE. No token minting, fixture operation or cloud mutation is authorized by this note. Production HOLD / NO-GO.
