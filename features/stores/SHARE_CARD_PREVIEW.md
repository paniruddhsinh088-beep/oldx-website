# Synthetic Store share-card preview and SVG export

The isolated Store page now displays a responsive text-only card with sample
Store name, public sample categories, sample city and canonical sample URL.
A visible localized badge labels it synthetic/not live. No actual shop photo,
contact, map, tracking image, external font, QR API or production route is used.
Category copy comes from immutable authored demo metadata, not a live schema.

`preview-card.mjs` validates bounded input, escapes XML, wraps grapheme clusters
without truncating long names, and returns a standalone SVG with title/description.
The HTML figure is the accessible equivalent preview; the SVG is not injected as
HTML and the existing no-images CSP is unchanged. System fonts including Gujarati/
Devanagari fallbacks shape text; exported files require suitable local viewer
fonts. Browser checks verify valid multilingual SVG and actual download bytes,
not every external viewer or native platform.

Export runs only from a user action, waits for local font readiness, checks current
revision, creates a bounded Blob/object URL and revokes the URL after handoff.
Cancel invalidates preparation; locale/data/route/publication changes discard
pending work and stale feedback. Denied/unavailable APIs give manual link fallback.
Success says a download was *requested*, not that a file was saved. Cancellation
of an OS/browser download after handoff cannot be observed or undone by this page.
No file is uploaded and no sample export creates a public Store or review claim.

Missing/invalid data disables export. Loading/withdrawal clears card fields.
Tests cover private-field/query exclusion, unsafe text, XML escaping, long names,
Gujarati/Hindi grapheme boundaries, missing fields, object-URL cleanup, denied
export, cancellation and stale work; mobile tests cover labelled controls,
keyboard download, all locales and 320px/200%-text layouts.

Real photo handling, publication, trusted canonical/crawler routes, media policy,
backend/index/Rules integration and any deployment remain owner-gated.

## Opt-in public Store export

The trusted Store DOM can now download the same Blue–White–Orange SVG template
from an accepted public Store view. Export includes the Store name, translated
category, OLDX branding and same-origin Store deep link with query state removed.
It reuses the existing object-URL cleanup and checks route, revision and Store
scope immediately before handoff. Guest public reads may export. A private
owner form, unavailable Store or withdrawn publication after refresh cannot.

The sample retains its synthetic city. The public export uses a branded text
fallback because the current public DTO has a free-form locality and no
export-safe photo field. Approved photos remain visible via the existing public
media viewer. Future exports need a vetted city field and a publication-scoped
photo snapshot. The existing QR encoder is Provider-specific and uses a Node
npm import. There is no Store-compatible browser QR path in the static build.

Store links are still fragment-based. No Store-specific Open Graph metadata is
served by the static shell. Reliable social previews need an approved crawlable
Store route that renders only current public metadata, denies withdrawn Stores
and applies the approved public image/cache policy. No live crawler behavior
was verified.

Minimum routing contract for approval: a same-origin non-fragment Store path on Pages, served by the existing trusted backend through an approved boundary. The initial HTML must use the accepted public Store projection for canonical URL and Open Graph tags. Return a safe unavailable response after withdrawal and ensure cache expiry or invalidation. Keep the current deep link for app navigation.
