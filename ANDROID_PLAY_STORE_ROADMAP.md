# OLDX Android / Google Play Store Roadmap

**Branch:** `security-hardening-review`  
**Status:** Planning document only; no Android project, signing key, Play Console account, cloud configuration, or deployment created.  
**Cost goal:** Reuse the existing website and free/open-source tooling; add paid services only when required by measured usage or Play policy.

## Recommended approach

Use Capacitor to package the existing OLDX web application as an Android application, subject to a compatibility and security review. Capacitor itself is free and open source. Android Studio and the Android SDK are also available without a software licence fee. This does not mean the whole app has zero operating cost: Firebase, hosting, media storage, SMS/OTP, and trusted backend usage may incur charges depending on plan and traffic.

Prefer a locally bundled web build over a thin remote-URL-only WebView. The app should load its reviewed web assets from the native package and use approved HTTPS services for data/API access. Do not embed server secrets or privileged credentials in the app bundle; Firebase web configuration is not a server secret, but access must be enforced by verified backend authorization and Firestore/Storage Rules.

## Release sequence

1. **Web readiness:** Resolve Login, Products, Stores, uploads, privacy, account deletion, and Admin security blockers. Do not wrap a broken or insecure web experience.
2. **Mobile compatibility:** Review responsive layouts, keyboard/focus behaviour, navigation/back behaviour, file/photo picker flows, permissions, offline/error states, and accessibility on real Android devices.
3. **Capacitor proof of concept:** Add Capacitor only on this review branch after web readiness gates are met. Pin package versions, keep Android project reproducible, and document clean build commands.
4. **Environment separation:** Build test APK/AAB only against an explicitly configured non-production environment until production release is separately approved. Never infer a Firebase project from a missing environment variable; fail closed. Do not place staging credentials or server secrets in the app.
5. **Security checks:** Verify authentication lifecycle, logout/token refresh, deep links, external URL handling, file upload validation, network transport, WebView debugging disabled for release, and no sensitive data in logs.
6. **Play Console preparation:** Confirm the current Google Play developer account requirements, identity verification, testing-track requirements, target API level, Data safety declarations, privacy policy, content rating, app access instructions, screenshots, icon, and store listing at release time. Google Play policies and target API deadlines change; re-check official requirements immediately before submission rather than hard-coding today's values in this plan.
7. **Release candidate:** Produce a signed Android App Bundle (AAB), keep signing material outside Git and chat, test an internal/closed track, fix review findings, then obtain explicit owner approval before production release.

## Cost controls

- Capacitor: free/open source; no subscription required.
- Android Studio / Android SDK: no software licence fee.
- Reuse the existing OLDX codebase and assets; avoid paid app builders.
- Google Play developer registration: Google currently lists a one-time US$25 registration fee; verify the exact local payment/tax amount and account requirements at purchase time.
- Keep Vercel/Firebase on suitable free allowances only while usage and product requirements fit their limits. Monitor quotas and billing alerts; never assume free tiers cover production traffic indefinitely.
- Avoid paid SMS/OTP, analytics, crash reporting, or image services until there is a clear need and cost comparison. Do not weaken authentication or security to avoid a legitimate service cost.

## Explicit safety gates

- No changes to Production Firebase project `oldx-1c983`, production domain `oldxbazar.in`, production Vercel deployment, billing, IAM, service identities, secrets, Firestore Rules, or production data as part of this roadmap.
- No app signing key or Play Console credentials may be committed to the repository or shared in chat.
- Do not create an Android wrapper before the unresolved web/backend security and runtime gates are satisfied.
- Do not claim Play Store readiness until device testing, policy declarations, signed AAB verification, and Play Console track testing are complete.

## Current status

This is a roadmap only. The repository currently has no Capacitor dependency or Android project. The Admin API remains an inactive framework-neutral foundation; real Firebase token verification, server-side role resolution, approved staging runtime, timestamp coverage, and staging endpoint tests remain outstanding. Products/Stores legacy timestamp coverage and Users stable pagination ordering are not proven. The current decision remains repository-only review and tests; Production is untouched.
