# OLDX Multilingual / Indian Languages Product Plan

Status: **Approved product direction for planning only**. No UI, database, account, or runtime change is activated by this document.
Branch: `security-hardening-review`.

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

Target the 22 languages in the Eighth Schedule of the Constitution of India, plus English as a practical fallback:

Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri (Meitei), Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu, Urdu, and English.

Suggested first rollout for translation QA: Gujarati, Hindi, Marathi, Bengali, Punjabi, Tamil, Telugu, Kannada, Malayalam, Odia, Assamese, Urdu, and English. Keep architecture locale-extensible so the remaining scheduled languages can be added without changing product logic. This rollout sequence is a proposal, not a limitation or a claim that translations already exist.

## What is translated

All first-party interface text must use translation keys, including:
- Welcome, language selection, signup/login, validation and error messages.
- Home, navigation, category names, search, filters, sorting and empty states.
- Create/edit listing, product details, seller/store flows and form hints.
- Chat controls, notifications, saved ads and account settings.
- Privacy, consent, blocking/reporting, export/deletion, help and support.
- Admin interface only for authorized staff, separately reviewed.

Use locale-aware date, time, number and currency formatting. Use Unicode fonts/fallbacks that correctly render every supported script. Support right-to-left layout for Urdu and Kashmiri where appropriate; test mixed-script text, numbers, icons, forms, chat bubbles, and navigation.

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
- [ ] Script/font tests for all enabled languages; RTL tests for Urdu/Kashmiri.
- [ ] Language selection works before authentication, offline, and after reinstall/login on another device.
- [ ] Profile language change updates all screens immediately and persists correctly.
- [ ] Search and user-generated listing/chat text are not silently translated or modified.
- [ ] No language preference is exposed through public profile endpoints.
- [ ] Bundle-size and startup-performance measurements show no material regression.

## Rollout plan

1. Inventory all visible interface strings and centralize them behind translation keys.
2. Build the first-launch language picker and private preference persistence with a safe local fallback.
3. Translate and QA Gujarati, Hindi, and English end-to-end first.
4. Add the next rollout languages in reviewed locale bundles, then the remaining scheduled languages.
5. Complete script/RTL/accessibility/performance tests before enabling each locale.
6. Release behind a reversible feature flag; retain English fallback and allow users to switch language at any time.

## Current authorization boundary

This is a product and architecture plan only. No implementation, Firebase schema/rules change, data migration, provider provisioning, billing, deployment, or production modification is authorized by this document. Continue work only on `security-hardening-review` until the existing security and owner-approval gates are satisfied.
