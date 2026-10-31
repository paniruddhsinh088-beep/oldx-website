# OLDX Staging Setup Guide

## Safety boundary
- Work only on `security-hardening-review`.
- Do not merge to `main`, deploy, or change the production Firebase project.
- The staging Firestore database currently has deny-all rules. Keep them until the staging app's required reads and writes have been inventoried and tested.
- Use synthetic test accounts and data only. Never copy production user records or secrets into staging.

## Staging Firebase Web App
Project ID: `oldx-staging`
Auth domain: `oldx-staging.firebaseapp.com`
Storage bucket: `oldx-staging.firebasestorage.app`
Messaging sender ID: `38472235077`
App ID: `1:38472235077:web:56a8dd10a0b0450dfccb2c`

The Web API key is intentionally not stored in this guide. Retrieve the public web configuration from Firebase Console > Project settings > General > Your apps. Do not commit service-account JSON, private keys, OAuth client secrets, or other server credentials.

## Authentication enabled
- Email/Password
- Google

A staging test user was created using Email/Password. Do not grant this user an Admin role.

## Required next implementation sequence
1. Separate Firebase configuration from production values in both `index.html` and `admin.html`, with explicit staging-only selection for this branch.
2. Verify both pages resolve to project ID `oldx-staging`; confirm no production project ID remains in the staging branch configuration.
3. Add only the local/staging hostnames actually used to Firebase Authentication > Settings > Authorized domains.
4. Inventory all Firestore reads and writes before designing staging rules. Do not weaken deny-all rules just to make the app appear to work.
5. Use synthetic records to test sign-in, profile, listings, saved ads, stores, chat, presence, and admin authorization.
6. Keep Admin access disabled in staging until server-side authorization and role checks are implemented. Do not copy production admin UIDs or grant privileges to the test user.
7. Record test outcomes and unresolved issues. No browser/emulator/runtime tests are implied by this guide.

## Current known application behavior
The review branch uses Firebase Auth and Cloud Firestore in the main page. Existing login flows include Google popup and Email/Password sign-in and account creation. The staging project is separate from production; do not change the production Firebase project.
