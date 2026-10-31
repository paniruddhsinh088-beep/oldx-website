# Vercel Staging and Firebase Environment Separation

## Scope and safety
This plan applies to the `security-hardening-review` branch only. It does not authorize a Production deployment, changes to Production Firebase, or changes to the Vercel Production environment. Do not merge to `main` or deploy to the Production domain without separate owner approval.

## Current repository facts
- The site is a static HTML application with `index.html` and `admin.html`.
- There is no package.json or established build pipeline in the repository tree inspected for this review.
- Both HTML pages currently initialize Firebase directly with the Production project ID `oldx-1c983`.
- `firebase-config-guard.js` expects `window.OLDX_FIREBASE_CONFIG` to be defined before it loads.
- `firebase-env.example.js` is a placeholder template, not a deployable configuration.
- Staging Firebase project: `oldx-staging`. Staging Firestore rules currently deny all access.

## Important Vercel behavior
Vercel Environment Variables are available to build/runtime functions, but are not automatically exposed as JavaScript variables to a static browser page. Never put a Firebase config placeholder such as `process.env...` directly in browser HTML and assume Vercel will replace it.

The browser Firebase configuration is public client configuration, not a service-account credential. Nevertheless, environment separation must fail closed: a missing or mismatched environment must stop Firebase initialization rather than silently fall back to Production.

## Recommended implementation for this repository
1. Add a small deterministic build step that generates `firebase-env.js` from explicitly named Vercel environment variables. Keep the generated file out of Git and add it to `.gitignore`.
2. Use separate Vercel Preview and Production variable sets. Preview must contain only the staging Firebase values and `OLDX_FIREBASE_ENV=staging`; Production must retain only the existing Production values and `OLDX_FIREBASE_ENV=production`.
3. The build step must validate all required fields and enforce the project-ID mapping:
   - staging -> `oldx-staging`
   - production -> `oldx-1c983`
   It must exit non-zero on missing, malformed, or mismatched values.
4. Load the generated `firebase-env.js` before `firebase-config-guard.js`, and load both before either page initializes Firebase. Both `index.html` and `admin.html` must use the same guarded config object.
5. Do not expose any service-account JSON, private key, OAuth client secret, or other server credential in browser code or build output.
6. Configure the Vercel project so the review branch gets a Preview deployment, not a Production deployment. Confirm the exact Vercel project, connected repository, Production Branch, domains, and Preview deployment URL before changing settings.
7. Use synthetic test data only in staging. Do not copy Production users, chats, products, stores, or evidence into staging.
8. Keep staging Firestore deny-all rules until a complete read/write inventory and emulator/security-rules test plan is ready. Do not loosen rules just to make the preview appear functional.
9. Verify the Preview deployment URL, generated environment marker, and Firebase project ID in browser developer tools. Do not test against the Production domain.
10. Only after staging behavior and security checks are complete should a separate reviewed change be proposed for Production. No automatic merge or Production deployment is authorized by this document.

## Required owner confirmation before Vercel settings are changed
- Confirm the Vercel project is the one connected to `paniruddhsinh088-beep/oldx-website`.
- Confirm Preview deployments are enabled for `security-hardening-review`.
- Confirm the Production Branch remains `main`.
- Confirm the intended Preview URL/domain.
- Confirm that the owner can inspect and set Preview Environment Variables in Vercel.

## Acceptance checks
- A Preview build with missing variables fails rather than falling back to Production.
- A Preview build cannot initialize project `oldx-1c983`.
- A Production build cannot initialize project `oldx-staging`.
- Neither HTML page contains a hard-coded Firebase config.
- No service-account or private-key material is present in generated browser assets.
- Existing page behavior is regression-tested in staging before any Production release.

## Not yet performed
No Vercel settings were accessed or changed. No Vercel deployment was created. No HTML initialization code was changed. No Firebase rules or data were changed. No runtime/browser/Emulator tests have been run.
