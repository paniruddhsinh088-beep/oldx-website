# Vercel Environment Variables for OLDX

This guide is for the Vercel project `oldx-webs` connected to
`paniruddhsinh088-beep/oldx-website`.

## Important
Do not change the Production Branch, domains, or Vercel project settings as part of this step. Do not deploy to the Production domain. The generated `firebase-env.js` is environment-specific browser configuration; it is not a service-account credential. Never add service-account JSON, private keys, or OAuth client secrets.

## Required variables

Create these six variables separately in Vercel Preview and Production scopes:

- `OLDX_FIREBASE_API_KEY`
- `OLDX_FIREBASE_AUTH_DOMAIN`
- `OLDX_FIREBASE_PROJECT_ID`
- `OLDX_FIREBASE_STORAGE_BUCKET`
- `OLDX_FIREBASE_MESSAGING_SENDER_ID`
- `OLDX_FIREBASE_APP_ID`

Also set `OLDX_FIREBASE_ENV`.

### Preview scope (staging only)
Set `OLDX_FIREBASE_ENV=staging` and use only the Firebase web app config for project `oldx-staging`.

### Production scope (not to be changed without separate approval)
The expected environment marker is `OLDX_FIREBASE_ENV=production` and expected project ID is `oldx-1c983`. Do not edit or replace current Production variables as part of staging setup.

## Build command
After the six HTML/config integration changes are reviewed and committed, set the Vercel Build Command to:

```sh
node scripts/generate-firebase-env.js
```

The build output directory and framework preset must remain consistent with the existing static-site deployment. Do not change them until the current Vercel project configuration has been confirmed.

## Fail-closed checks
The build helper:
- accepts only `staging` or `production`;
- requires every Firebase config field;
- enforces staging -> `oldx-staging` and production -> `oldx-1c983`;
- exits with an error on missing or mismatched values;
- generates `firebase-env.js`, which is excluded from Git.

## Current status
This document and the build helper do not themselves alter Vercel settings or deploy anything. The HTML pages still need a separate reviewed change to load the generated config and the guard before Firebase initialization. No runtime tests have been run.
