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

## Asynchronous sample behavior

The labelled sample-behavior selector offers normal, delayed (350ms), failed,
invalid and withdrawn mock responses. Reload sample retries the current view.
These controls change only in-memory demo behavior; they do not alter a real
Store's publication status. Loading/error/withdrawn messages use the same three
catalogs, announce state accessibly, clear previous product/header/cards, and
retain query controls for rapid changes. Paging is disabled during loading.
Old responses are ignored even if the mock ignores cancellation. Returning through
history re-reads the sample, without restoring withdrawn card/detail state.

The small request controller is isolated from DOM, locale and SDK code. The
existing Service request counter remains unchanged: both previews use the same
latest-request principle without a risky rewrite of already working components.
Only Store adds an injectable offline read boundary. Browser tests replace that
module with controlled promises to assert exact completion order without sleeps.
No global mock hooks are added to the shipped preview.

Mock requests have a five-second deadline. Timeout uses the same localized safe
error/retry state, aborts the mock where supported and rejects any later result.
Timers are cleared on success, failure, replacement, route clear and withdrawal.
Page-hide clears accepted/pending state; a persisted page-show requests a fresh
sample instead of trusting browser back/forward-cache publication state. The
cache-lifecycle browser regression dispatches deterministic PageTransitionEvents;
it does not claim coverage of every engine's real cache implementation.

Product routes now use an independent single-product mock read with fresh Store
and listing publication/identity checks. They do not look up a card within the
first 24 catalogue results. Withdrawn or removed samples clear all detail fields
and show localized unavailable recovery; malformed responses show safe error/retry.
The same existing request controller protects catalogue-to-detail transitions,
late results, timeouts, history and page-cache restores. See
[detail contract and remaining approvals](DETAIL_READ_CONTRACT.md).

## Share the sample Store

An accepted public sample header now offers a labelled canonical Store URL,
copy and native share. The URL is built from the current preview page/origin,
validated sample Store ID and `#store/…` route; queries, product IDs and local
filter state are excluded. Both catalogue and detail share the Store link.
The caption and notice explicitly describe a sample, not a published real shop.

Sharing reuses the existing Service transport. Native cancellation never silently
copies; unavailable/denied clipboard access leaves a labelled read-only link for
manual copying. All labels, pending/result feedback and recovery use gu/hi/en.
A pending share disables repeated actions; loading, invalid/unavailable data,
withdrawal and route/cache invalidation clear sharing state. Late completion may
not restore old feedback. A URL already handed to the OS/clipboard cannot be
retracted by a later revocation. Future server reads still require fresh policy.

No production URL, poster/photo, QR export or dynamic Open Graph preview is added.
Legacy Store sharing and the production application are unchanged.

The Store preview now includes a [text-only sample share card and local SVG export](SHARE_CARD_PREVIEW.md). Real imagery and production sharing remain gated.
