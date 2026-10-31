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
After the HTML/config integration changes are reviewed and Preview variables are configured, the intended Vercel Build Command is:

```sh
node scripts/generate-firebase-env.js
```

Do not change the Output Directory or framework preset until the current Vercel project configuration has been confirmed. This repository has root-level HTML files and no `package.json` or `public/` directory; do not select `npm run build` or `npm run vercel-build` because those scripts do not exist.

## Fail-closed checks
The build helper:
- accepts only `staging` or `production`;
- requires every Firebase config field;
- enforces staging -> `oldx-staging` and production -> `oldx-1c983`;
- exits with an error on missing or mismatched values;
- generates `firebase-env.js`, which is excluded from Git.

## Current status
This document and the build helper do not themselves alter Vercel settings or deploy anything. Both HTML pages now load the generated config and guard before Firebase initialization on `security-hardening-review`. The build helper has only been tested locally with synthetic values; no Vercel deployment or browser runtime tests have been run.
