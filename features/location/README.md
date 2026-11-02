# Inactive location and Google Maps UX boundary

This independent, dependency-free module prepares the owner-approved location UX without changing the live OLDX page. Nothing requests location on import. A reviewed UI must call `request()` **only after an explicit user action**, and must inject `navigator.geolocation` at that boundary. No buyer coordinates are persisted, sent, logged or used for tracking by this module.

- `createLocationPicker({ geolocation, onChange })`: high-accuracy (30 s, no cached fix) one-shot request; manual-pin override, cancellation, disposal and stale-callback protection. Call `dispose()` when leaving the screen.
- `accuracyQuality(metres)`: `good` up to 50 m, `usable` up to 100 m, `poor` above 100 m; missing/invalid accuracy is rejected. Show measured metres; never promise exact GPS. A poor fix is only a candidate for retry/manual review, not a saved selection.
- `googleMapsDirectionsUrl(latitude, longitude)`: fixed HTTPS Maps destination link. The operating system may open Google Maps if installed, otherwise the web fallback should work. No custom app scheme or buyer-origin parameter.

**Integration still pending:** review the product/ad, Store and default-location call sites in `index.html`; consolidate only after checking existing manual map-pin flows, permissions, localization, focus and legacy compatibility. Use an explicit `Directions` action with `target="_blank"` and `rel="noopener noreferrer"` where opening a new tab. Add Gujarati/Hindi/English error and accuracy copy through the shared catalogs. Test Android with and without Google Maps, denied permission, slow/poor GPS and manual pin races. A browser/Node test cannot prove the native app handoff.

**Evidence:** `node --test features/location/location-actions.test.mjs` (pure Node tests, no browser or real GPS). Run from repository root. No Firebase, Maps API key, backend, storage, network request or deployment is involved. Staging deny-all and release HOLD/NO-GO remain unchanged.
