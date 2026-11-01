# Review-only locale foundation

The isolated Service preview supports Gujarati (`gu`), English (`en`) and Hindi
(`hi`). Each catalog has 103 matching keys. Translations are draft preview copy;
native-speaker review is still required before release. The main marketplace,
authentication screens and account preferences are not wired to these modules.

## Modules and boundaries

- `i18n.mjs`: explicit locale allowlist, lazy catalog loaders, English/key fallback,
  own-property interpolation, plural rules and Indian number/INR/date formatting.
  English is the eager fallback; only the selected additional catalog is loaded.
  Module caching reuses a loaded catalog. Unknown locale input cannot select an
  import path or a remote URL.
- `dom.mjs`: applies translations only to marked first-party text, placeholder
  and accessible-label nodes. It uses textContent; it cannot change routes,
  permissions, arbitrary attributes, disabled contact actions or input values.
- `preference.mjs`: stores only an allowlisted code at `oldx.preview.locale.v1`.
  Storage denial, corrupt values and quota errors are handled without breaking
  the interface. No profile, consent, auth UID or contact detail is stored here.
- `catalogs/`: separate language resources. Keep key sets, plural forms and named
  interpolation variables identical. The coverage test checks each template key.

The preview defaults to Gujarati to preserve its existing behavior. The general
translator defaults to English. Language is never inferred from IP, GPS, browser
locale or a person's name. An explicit choice persists locally; private account
sync and a whole-app first-launch picker remain future, separately gated work.

## Using the translator

```js
const translator = await loadTranslator('hi');
heading.textContent = translator.t('resultCount', { count: 3 });
```

Render the result as text. Interpolation does not parse markup and must never be
sent to innerHTML. Missing/invalid selected messages fall back to English, then a
visible `[key]` marker. Missing interpolation values remain visible as `[name]`.
Plural selection uses the message's language, including when falling back to
English. Non-finite numbers and invalid dates are not formatted as valid values.

Locale changes must not translate or rewrite user-generated content. Provider
names, descriptions, city/locality strings and selected canonical service values
remain unchanged. Only predefined service/category control labels are translated.
Free-text search matches authored content; normalized comparison handles canonical
Unicode equivalence without modifying the underlying record.

The preview controller keeps the newest async language selection, falls back to
English on a missing catalog, preserves the active screen/draft/contact choices,
and restores result focus by provider identity rather than the old sort position.

## Verification and remaining gates

`npm run test:i18n` checks catalog/placeholder parity, fallback, plural rules,
formatting, malicious/unsupported locale inputs and storage failures.
`npm run test:service-preview:browser` covers language switches, lazy loading,
missing catalogs, blocked storage, load races, content preservation, focus, narrow
layouts and actual 200% computed text sizes. Only loopback assets are served and
all external browser requests are denied.

Catalog gzip sizes are roughly 2–3 KiB per language. These are local compression measurements, not a field startup benchmark.
System Noto Gujarati/Devanagari fallbacks are named in CSS; no font API or new
remote font download was added. Native shaping/terminology review, full app string
inventory, offline application caching, first-launch/settings integration and
owner-controlled private preference sync remain outstanding. Nothing is deployed.
