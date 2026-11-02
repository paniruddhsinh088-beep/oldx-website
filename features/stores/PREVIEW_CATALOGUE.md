# Synthetic Store catalogue preview

Open `store-preview.html` with a local static server. This is an isolated demo,
not the production Store page. No real seller, purchases, contact, media,
Firestore reads/writes, account state or analytics are connected.

## Routes and behavior

- Empty fragment or `#store/demo-shop`: the 13-product synthetic catalogue.
- `#store/demo-empty`: an empty-shop onboarding example.
- `#store/demo-shop/product/sample-1` through `sample-13`: a sample product card
  detail. These links reload directly and support browser Back/Forward.
- Unknown or malformed Store/product IDs: accessible recovery, stale public
  identity/detail fields cleared. No route value selects a database path.

Discovery delegates to the existing `buildStoreCataloguePage`: six cards per
local page, title search, category, availability, newest/name/price sorting.
Changing filters resets pagination. Returning from a product retains the current
filters/page and restores result focus when the result is still present.
The sample's `hasMoreInBatch` never claims server-side cursor pagination or a
complete live catalogue. Empty results and the distinct empty-shop state guide
recovery; malformed filters show an alert without rendering markup.

Gujarati/Hindi/English interface catalogs, allowlisted preference, formatting
and fallback use existing shared i18n modules. Store names, descriptions and
product titles are authored samples and are never translated automatically.
Only the existing `oldx.preview.locale.v1` key is persisted; filters, products,
contact details, identity and drafts are not stored. Native-speaker review is
still required. The Service preview shares that language preference.

## Accessibility and shared patterns

The keyboard skip link focuses main content without replacing the current Store
route. Semantic links support direct navigation; labelled controls and status/alert
regions announce filtering and recovery. View changes and paging move focus to
headings; returning from detail restores its result link. Touch controls are at
least 44px high, layouts wrap at 320px, and tests apply actual 200% computed text
sizes in all languages across catalogue, product, empty and not-found views.

Store category choices now reuse the model’s frozen source category IDs rather
than maintaining a second 12-category list. Both previews reuse the existing translator/DOM/preference modules and explicit
static asset allowlist. The browser suites now share one loopback-only server
fixture, removing duplicated request allowlist and MIME handling. The Store adds
no dependency, remote font/media request or runtime framework. Its DOM contains
at most six catalogue cards. No rewrite of the already verified Service layout
or controller was justified; its 16 browser regressions remain required.

The entry point is packaged explicitly, without changing `index.html` or
production Store behavior. Its CSP prohibits forms submitting, inline scripts,
remote script/style/media sources and object embedding; module requests stay
same-origin. [Future integration contract](PUBLIC_DATA_INTEGRATION_CONTRACT.md)
is inactive and excluded from the static package.

Checks: `npm run test:stores`, `npm run test:stores:preview`,
`npm run test:stores:browser`, `npm run test:i18n`, `npm run test:static-build`.
Review CI runs these alongside the existing Service/security regression suites.
