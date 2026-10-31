# OLDX Staging Firebase — Static Gap Report

**Branch:** `security-hardening-review`  
**Status:** Read-only repository review; no Firebase project was accessed.  
**Target for any future inspection:** `oldx-staging` only.  
**Production exclusion:** `oldx-1c983`, Production V13, `main`, and `oldxbazar.in`.

## Executive result

The repository and local CI provide useful safety checks, but they do not establish that the deployed Staging Firestore or Storage Rules are safe for the Service feature. The actual deployed configuration remains **Unknown**. Do not connect live Service profiles, enquiries, uploads, or reviews to Firebase yet.

## Confirmed repository / CI evidence

1. The Staging read-only audit checklist exists and explicitly excludes Production, writes, deployments, migrations, IAM/billing changes, secrets, and user-data access.
2. The latest review-branch workflow run [41246753888](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41246753888) completed successfully. Its single job passed all steps, including local environment safety tests, dependency-free safety tests, local Admin backend starter tests, Firestore Emulator authorization tests, and Storage Emulator authorization tests.
3. The Emulator baseline is intentionally deny-all. Passing those tests proves the isolated deny-all test harness behaves as expected; it does **not** prove that OLDX marketplace, seller, chat, admin, or Service workflows are authorized correctly.
4. The repository readiness record states that there is no approved Admin backend implementation and no deployable OLDX Firestore Ruleset in the review branch. The local emulator fixture is not a substitute for deployed Rules.
5. Existing static audits identify unresolved authorization/data-boundary work: private user fields are mixed into publicly readable user documents in the currently supplied Rules; store/product writes need field allowlists; chat/message authorization needs participant and operation-specific checks; privileged stats/admin operations need trusted server enforcement.
6. A prior CI readiness record reported 21 dependency audit findings (16 moderate, 5 high) in the test-tool dependency tree. They have not yet been remediated or assessed for project-specific exploitability. This is a dependency hygiene item, not evidence by itself of a deployed application vulnerability.

## Gap classification

| Area | Classification | Evidence needed |
|---|---|---|
| Actual Staging Firestore Rules | **Unknown** | Exact currently published Rules text and observation date |
| Actual Staging Storage Rules | **Unknown** | Exact currently published Rules text and observation date |
| Staging Auth providers / App Check | **Unknown** | Console configuration status only; no user exports |
| Staging Functions / trusted backend | **Unknown** | Runtime, region, deployed function inventory and service identity summary |
| Staging indexes / database location | **Unknown** | Console metadata and index states |
| Emulator deny-all baseline | **Confirmed for test harness only** | No further evidence needed for that narrow claim |
| Service feature authorization | **Needs implementation and tests** | Approved server-side data contract, Rules/backend design, synthetic tests |
| Test dependency findings | **Needs assessment** | Lockfile audit, direct/transitive dependency review, safe upgrade plan |

## Safe next step

Obtain read-only evidence for the exact `oldx-staging` project using the checklist:
- Published Firestore Rules text.
- Published Storage Rules text.
- Project ID, database/bucket location, Auth provider names/status, App Check enforcement status.
- High-level Functions/runtime/region and index status.

An authorized owner may provide these non-secret exports instead of granting Console access. Do not provide service-account JSON, private keys, access tokens, passwords, user exports, chat contents, or Production configuration.

## Explicit stop conditions

- Abort if the visible project ID is not exactly `oldx-staging`.
- Do not request Owner/Editor/deployment permissions for a read-only audit.
- Do not change Rules, IAM, billing, App Check, Auth providers, indexes, Functions, Hosting, or data.
- Do not implement live Service reads/writes or deploy anything until the Staging evidence is reviewed and a separate implementation scope is explicitly approved.

**Conclusion:** CI is green, but Staging Firebase security is not yet verified. The next meaningful gate is the read-only Staging configuration evidence, not another code deployment.
