# Isolated Service profile preview

The existing `service-preview.html` can display its six synthetic profiles at
`#provider/p1` through `#provider/p6`. `#services` opens discovery and
`#my-services` opens the local multi-service draft form. Direct loads, reloads
and browser history work without a server route or Firebase query. Unknown or
malformed IDs show an accessible recovery view and clear stale sharing state.

Only `buildPublicProviderProfile` output reaches profile rendering and share
state. The explicit allowlist adds description and supported language codes to
the existing public card fields; private contact details, owner identifiers,
coordinates and moderation/trust claims are excluded. This projector accepts
**already-public** data; it is not a publication or authorization boundary.
The current caller supplies synthetic fixtures only.

Copy/share actions build a link from the current preview page's origin and
validated sample ID. Query parameters, unrelated fragments and draft/consent
state are never shared. Native share cancellation does not silently copy.
Clipboard denial leaves a labelled, read-only URL for manual selection. Async
results from an earlier route cannot update the newly selected view. All new
status/recovery copy is present in Gujarati, Hindi and English. Authored sample
names, services and descriptions are preserved across language switches.

These are preview links only. No real provider is published, no production
`/services/provider/:id` endpoint is implemented, and social crawler metadata,
real contact, uploads and backend integration remain gated by the roadmap and
owner decisions. The existing production URL/QR helpers remain separate and
inactive; this page does not generate QR assets pointing at an unimplemented
production route.

Checks: `npm run test:service-providers`, `npm run test:service-preview`,
`npm run test:service-preview:browser`, `npm run test:i18n` and
`npm run test:static-build`.

Profiles also offer a [local sample buyer-enquiry rehearsal](SAMPLE_ENQUIRY_PREVIEW.md), with no sending, booking, contact or persistence.

The Services navigation now links to a [separate synthetic provider inbox](ENQUIRY_INBOX_CONTRACT.md). It uses authored fixtures, never real incoming messages.
