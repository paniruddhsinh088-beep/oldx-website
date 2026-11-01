# OLDX Multilingual / Indian Languages Product Plan

Status: **Approved product direction for planning only**. No UI, database, account, or runtime change is activated by this document.
Branch: `security-hardening-review`.

## Review-branch implementation checkpoint — 2 November 2026

The isolated Service preview now has Gujarati/Hindi/English catalogs (103 keys per
language), a visible native-script language selector, safe fallback/interpolation,
plural/number/INR/date helpers and a local allowlisted locale preference. The
selected catalog is lazy-loaded alongside the English fallback. Browser checks
cover language switches, data preservation, unavailable storage/catalogs, load
races, focus and large-text mobile layouts. See `features/i18n/README.md` and
`docs/review-progress-2026-11-02-locale-batch.md` for implementation/evidence.

This is a preview-only slice under the current development request. It does not
activate localization in the main marketplace/authentication UI, write private
account preferences, enable backend access or imply native-speaker review. All
whole-application release gates below remain outstanding. Provider/authored text
and canonical service selections are not translated or rewritten.

## Product goal

OLDX is a local-first Indian marketplace. A user should be able to use the complete application interface in a familiar Indian language, choose the language on first launch, and change it later from Profile / Settings without reinstalling or losing data.

## User experience

1. On first app launch, before Sign Up / Login, show a welcoming language picker. This ensures authentication screens are localized too.
2. Provide a clear language name in its own script and an optional familiar English label; do not rely on flags to represent languages.
3. After selection, immediately localize the interface and continue to Sign Up / Login.
4. Persist the preference locally for instant startup and, after authentication, in the user's own private profile/preferences record. Do not store it in a public profile.
5. On another device, load the signed-in user's saved language preference. If unavailable or offline, use the local selection and a safe English fallback.
6. Add Profile → Settings → Language so a user can change language at any time. Apply changes immediately without account recreation or app reinstall.
7. Keep the selection accessible: searchable list, readable native-script labels, keyboard/screen-reader support, and no forced language switch based on GPS or IP.

## Language coverage

Initial supported languages are limited to:

- Gujarati (`gu`)
- English (`en`)
- Hindi (`hi`)

Do not expose other language choices in the initial language picker or settings. Keep the locale architecture extensible so additional Indian languages can be added later without changing product logic. This three-language scope is the current product decision; translations are not yet claimed to be implemented.

## What is translated

All first-party interface text must use translation keys, including:
- Welcome, language selection, signup/login, validation and error messages.
- Home, navigation, category names, search, filters, sorting and empty states.
- Create/edit listing, product details, seller/store flows and form hints.
- Chat controls, notifications, saved ads and account settings.
- Privacy, consent, blocking/reporting, export/deletion, help and support.
- Admin interface only for authorized staff, separately reviewed.

Use locale-aware date, time, number and currency formatting. Use Unicode fonts/fallbacks that correctly render every supported script. Test Gujarati, English, and Hindi script rendering, mixed-script text, numbers, icons, forms, chat bubbles, and navigation. RTL support is not required for this initial three-language release; add it if a future supported language requires it.

## Important distinction: interface language vs user-generated content

Translating the app interface does not automatically translate marketplace listings, seller descriptions, names, chat messages, store names, or uploaded images. Those are user-generated content and should remain exactly as authored unless a separate optional translation feature is designed, costed, disclosed, and approved. Never silently rewrite a seller's words or a private chat.

## Technical design principles

- Use a central locale dictionary/catalog with stable keys; no hard-coded visible UI strings in components.
- Keep translation content separate from business logic and user data.
- Use a predictable fallback chain: selected locale → English → safe key-based fallback; never display raw undefined/null values.
- Avoid runtime machine translation for core interface text; maintain human-reviewed translations and a glossary for marketplace/privacy terminology.
- Include plural rules, interpolation, date/number/currency formatting, validation messages, and accessibility labels.
- Lazy-load locale bundles to keep mobile startup fast; cache the selected locale bundle and avoid downloading every language on launch.
- Keep language preference private and owner-controlled; only accept allowlisted locale codes. No IP/GPS-based inference.
- Do not alter Firestore Rules or create a new collection until the data schema and rules have been reviewed and emulator-tested with explicit approval.
- Keep the system compatible with the current web app and future Capacitor packaging; language preference must survive app updates.

## Quality gates before release

- [ ] Human-reviewed translation for every visible screen and error state in each enabled language.
- [ ] Native-speaker review of marketplace, safety, privacy, consent, blocking, and deletion terminology.
- [ ] No missing keys or accidental mixed-language UI in automated locale coverage tests.
- [ ] Layout tests for long strings, small Android screens, large text, and low-end devices.
- [ ] Script/font tests for Gujarati, English, and Hindi; verify mixed-script content and fallback fonts.
- [ ] Language selection works before authentication, offline, and after reinstall/login on another device.
- [ ] Profile language change updates all screens immediately and persists correctly.
- [ ] Search and user-generated listing/chat text are not silently translated or modified.
- [ ] No language preference is exposed through public profile endpoints.
- [ ] Bundle-size and startup-performance measurements show no material regression.

## Rollout plan

1. Inventory all visible interface strings and centralize them behind translation keys.
2. Build the first-launch language picker and private preference persistence with a safe local fallback.
3. Translate and QA Gujarati, Hindi, and English end-to-end.
4. Complete script/accessibility/performance tests for these three locales before enabling them.
5. Release behind a reversible feature flag; retain English fallback and allow users to switch language at any time.
6. Consider additional languages only as a separately prioritized future enhancement.

## Current authorization boundary

This is a product and architecture plan only. No implementation, Firebase schema/rules change, data migration, provider provisioning, billing, deployment, or production modification is authorized by this document. Continue work only on `security-hardening-review` until the existing security and owner-approval gates are satisfied.
