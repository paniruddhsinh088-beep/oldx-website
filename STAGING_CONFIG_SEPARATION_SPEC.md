# OLDX Staging Configuration Separation — Implementation Specification

**Branch:** `security-hardening-review`  
**Status:** Planning only. No application code or Firebase project changed by this document.  
**Production impact:** None.

## Goal

Separate staging and production Firebase configuration so that security work cannot accidentally run against the live project.

## Verified baseline

- `index.html` and `admin.html` currently initialize Firebase against production project `oldx-1c983`.
- The owner-created staging project is `oldx-staging`; Email/Password and Google sign-in are enabled.
- Staging Firestore Rules are deny-all and must remain so until access requirements are inventoried and tested.
- Use synthetic staging accounts/data only. Never copy production personal data or credentials into staging.

## Implementation requirements

1. Inspect repository structure and hosting/build process before choosing the configuration mechanism. Do not assume a bundler exists.
2. Create one shared Firebase configuration source consumed by both `index.html` and `admin.html`; remove duplicated inline configurations only after confirming compatibility with the current Firebase compat SDK.
3. Require explicit environment selection. Unknown or missing selection must stop initialization rather than silently defaulting to production.
4. Staging selection must assert project ID exactly `oldx-staging`. Production selection must retain the current production project configuration unchanged.
5. Show a clear staging-only visual banner. Log the selected project ID only in development diagnostics; never log secrets.
6. Preserve current Auth, Firestore, and Storage initialization APIs and all existing marketplace behaviour.
7. Keep Admin authorization independent of environment selection. No staging test user is an Admin by default.
8. Configure staging Auth authorized domains only after the actual staging hostname is known. Do not change production domains.
9. Do not relax Firestore Rules to make the app work. First inventory all reads/writes and design least-privilege staging Rules.

## Regression checklist

Test in staging using synthetic data:
- Google and Email/Password sign-in and registration.
- Profile, presence, Saved Ads, blocked-user behaviour.
- Product create/edit, image preservation, and seller-owned Sold/Available toggle.
- Stores and store images.
- Chat, attachments, read receipts, typing, hide-for-me and delete-for-everyone.
- Admin denial for ordinary users and access only for explicitly owner-approved Admin identities.
- Admin user directory, audit/evidence views, and account deletion workflow.

Record actual results. Do not state tests passed unless run.

## Stop conditions

Stop for owner review before any change to `main`, production Firebase Rules/data/Auth users, production Cloudinary settings, live deployment, Admin identities/roles, or existing app behaviour.

## Completion criteria

Both entry points demonstrably resolve the intended project; staging cannot fall back to production; regression results are recorded; and the production configuration and deployment remain unchanged.
