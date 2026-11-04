# oldx-staging integration preflight — 4 November 2026 (Asia/Kolkata)

Result: BLOCKED before operational changes. HOLD/NO-GO.
Branch security-hardening-review; fetched/local HEAD both
228d5831f7a1144c12cada7a8fce099e928a211e; clean initial tree, no concurrent commits.
Exact-head Review CI 41780718031 success; executable 9e77389 prior Review/Service/
Branch checks are recorded in the existing launch ledger. AGENTS and latest ledger
reviewed. This report records evidence, not a live-project security assessment.

## Approval scope received

Owner approves safe integration/testing using existing oldx-staging ONLY, synthetic
accounts/data, and only after isolation/access/security/backup/rollback are verified.
This supersedes the former blanket no-staging-read restriction for this scope.
It does not approve production, public/staging deployment, IAM/secrets/credential
changes, billing/paid services, media moderation activation or main/merge. Any
staging Rules/data change needs verified backup, rollback and security review first.
No gate may be bypassed merely because integration is now approved in principle.

## Observed preflight (no secret values or customer records read)

| Check | Evidence / result |
| --- | --- |
| Intended project | AGENTS and config templates identify oldx-staging. Production oldx-1c983 is explicitly excluded. No authenticated remote project identity could be verified |
| Runtime readiness | Managed cloud status: observations_current true, network policy enforced/restricted, outbound identities [], secrets [], runtime_variables []. No ready staging identity binding |
| Credential selectors | No OIC_MANIFEST_PATH; no configured GOOGLE_APPLICATION_CREDENTIALS/FIREBASE_TOKEN/CLOUDSDK_CONFIG selectors. Conventional Firebase CLI and ADC cache paths absent (existence checks only; contents not inspected). Local Firebase CLI binary exists but CLI installation does not establish authenticated project access |
| Network | Effective/selected policy does not allow firebase.googleapis.com, firebaserules.googleapis.com, firestore.googleapis.com, identitytoolkit.googleapis.com, storage.googleapis.com, oauth2.googleapis.com or cloudresourcemanager.googleapis.com. No bypass or policy modification attempted |
| Repository config | .firebaserc and generated firebase-env.js absent; firebase-env.example.js is a placeholder with separate staging/production examples. firebase.json defines loopback Emulator settings only, not a verified staging binding |
| Current Rules | Documented staging baseline is intentionally deny-all. Remote deployed Rules/version not inspected or confirmed; nothing changed |
| Data/isolation | No Firestore records or Auth account lists read; synthetic-only contents and production isolation cannot be confirmed remotely. No write or test-account creation |
| Auth/Storage | Enabled Auth providers, project metadata, Storage bucket/plan/Rules and effective permissions are unverified. Earlier Storage upgrade blocker is historical, not a current remote observation |
| Backup/rollback | No verified current staging backup manifest, restore rehearsal or matching deployed-Rules rollback snapshot available in this checkout/session. This does not prove none exists remotely; it cannot be verified with present access |

Phase 1 stop conditions are met. Phases 2/3 were NOT attempted. No Firebase project
API request, real staging test, data export/backup, permission change, rule deployment,
resource creation, upload, provisioning or real customer-data access was performed.
No default-disabled transport was enabled. Production was not contacted.

## Verification performed versus not performed

Local synthetic config guard tests 6/6 pass:
node --test --test-isolation=none scripts/generate-firebase-env.test.js
Log /tmp/oldx-staging-preflight-tests.log. These validate explicit staging selection,
wrong-project/environment rejection and missing-config rejection in temporary
fixtures. They do NOT confirm deployed staging isolation, Auth, Rules or Storage.
No full regression sweep was needed for this documentation-only preflight report.
Check the exact commit's push-triggered Review CI; no new Emulator claim is made.

## Minimum unblock steps (owner/environment operator; not executed here)

1. Attach an EXISTING authorized oldx-staging-only identity/session through supported
   environment configuration, without changing IAM/creating credentials or pasting
   secrets into chat. If no such access exists, provisioning needs separate approval.
2. Approve/configure the exact required Firebase/Google API network destinations
   through the supported policy workflow. Keep TLS/proxy controls and project-scoped
   identity restrictions; do not use mirrors, production credentials or alternate
   paths to bypass network policy. No policy change was made by this task.
3. Supply non-secret project/bucket identity and evidence of synthetic-only staging
   scope, current Rules/version and verified backup/restore/rollback procedure. Do
   not export real customer data here. Creating backup resources or incurring costs
   is not approved by the present instruction.
4. Rerun read-only preflight first. Only after prerequisites are proven, prepare
   exact synthetic collections/accounts and security-reviewed change/rollback scope.
   Do not loosen deny-all or remove default-disabled gates to make tests pass.
5. Actual authenticated workflow/media/moderation/runtime/staging deployment actions
   still require the specific remaining approvals and feasible zero-spend resources.

November 7 status: NO-GO for launch on current evidence. Existing repository/mock/
Emulator progress remains intact, but real staging acceptance has not started.
Keep all remaining Product/Store/Provider/photos/Chat/Admin/locale/mobile requirements.
No reset, paid usage, live/staging writes, Storage/Rules/index/IAM/secrets/billing,
Vercel/public deployment, migration, main update or merge. Stop operational work.
