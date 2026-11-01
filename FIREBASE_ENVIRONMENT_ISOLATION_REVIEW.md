# OLDX Firebase Environment Isolation — Static Review

**Branch:** `security-hardening-review`  
**Scope:** Repository-only review of Firebase browser configuration generation, runtime guard, and CI deployment boundary.  
**No Firebase/Vercel project settings were accessed or changed.**

## Findings

### Controls confirmed in source

1. `scripts/generate-firebase-env.js` accepts only `staging` or `production`, maps them to the exact expected Firebase project IDs (`oldx-staging` and `oldx-1c983`), and refuses a project-ID mismatch before writing the generated file.
2. When Vercel supplies `VERCEL_ENV`, Preview must use Staging and Production must use Production. Unknown Vercel environment values fail the build.
3. The generator emits only the six public Firebase Web App configuration fields. It does not include Admin SDK/service-account credentials.
4. `firebase-config-guard.js` repeats the environment/project-ID pairing at browser initialization and refuses missing, unknown, or mismatched configuration. It freezes a copy and does not silently fall back to Production.
5. `firebase-env.js` is excluded from Git. The example file warns not to put service-account keys in browser config.
6. The review CI workflow has `contents: read` permissions and runs local tests; the reviewed package scripts and workflow contain no Firebase/Vercel/GCloud deploy command.
7. Firestore and Storage Emulator configurations are separate from the root Firebase config. The Firestore fixture is deliberately deny-all; Storage uses a clearly labelled candidate product-media policy.

### Remaining unknowns / risks

1. Actual Vercel project environment variables, target scopes, build settings, and deployment artifact contents have not been inspected. Source-level checks cannot prove that the live Preview deployment is connected to `oldx-staging` or that Production is connected to `oldx-1c983`.
2. Local builds may omit `VERCEL_ENV`; this is intentional for local work, but it means the explicit Preview/Production scope check is not applied in that context. The exact project-ID check still applies.
3. The browser runtime guard validates the declared config object, not Firebase authorization. Public Firebase Web App config is not a secret and must never be treated as access control.
4. The Storage candidate Rules intentionally allow anonymous reads of objects marked approved. This is a proposed public-product-image behavior only; it must be reviewed against moderation, privacy, and metadata policy before any deployment. Its Emulator tests use privileged test context to seed an approved object; that is not a deployed moderation service.
5. The Storage candidate policy does not cover chat attachments or Service portfolio uploads. Do not reuse it for those paths without a separate data classification and policy review.

## Safe verification checklist for an authorized owner

Read-only checks in Vercel/Firebase:
- Confirm the Preview environment has `OLDX_FIREBASE_ENV=staging` and `OLDX_FIREBASE_PROJECT_ID=oldx-staging`.
- Confirm the Production environment has `OLDX_FIREBASE_ENV=production` and `OLDX_FIREBASE_PROJECT_ID=oldx-1c983`.
- Confirm the six public web-config values belong to the same project as the selected project ID.
- Confirm the generated `firebase-env.js` is present in the correct deployment artifact and is not committed to Git.
- Verify the deployed site’s Firebase project ID using safe, non-user-data diagnostics.
- Record Preview deployment URL, Production deployment URL, and observation time without sharing credentials or secrets.

## Conclusion

The repository contains meaningful fail-closed environment selection controls and a read-only CI boundary. The actual Vercel variable scopes and deployed artifact wiring remain unverified. This review does not authorize Vercel settings changes, Firebase changes, Rules publication, deployment, or Production access.
