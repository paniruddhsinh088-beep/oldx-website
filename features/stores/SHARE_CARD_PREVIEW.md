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
