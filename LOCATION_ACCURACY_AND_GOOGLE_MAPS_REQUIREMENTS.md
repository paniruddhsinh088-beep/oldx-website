# Location Accuracy and Google Maps UX Requirements

Status: requirements captured; implementation not started.
Branch: `security-hardening-review`
Scope: Staging-first only. Do not change Production or deploy without owner approval.

## Owner request

1. When a user selects **Use My Location**, OldX should obtain the most accurate location reasonably available from the device, aiming for a location close to the actual place.
2. When a buyer taps a product/store map or directions control, open the destination directly in the Google Maps app when the device supports it; otherwise provide a working Google Maps web fallback.

A 100% GPS accuracy guarantee is not technically possible. The app must communicate measured accuracy in metres and avoid presenting a poor fix as exact.

## Static source findings (index.html, security-hardening-review)

- Store GPS flow already requests `enableHighAccuracy: true`, `maximumAge: 0`, and a 30-second timeout, and displays the browser-reported accuracy in metres. It currently accepts any finite coordinate regardless of how large the reported accuracy radius is.
- Product/ad GPS flow uses `getCurrentPosition` without explicit options, so browser defaults may permit a less accurate or cached fix. It does not display the reported accuracy.
- General `autoDetectUserLocation()` also uses default geolocation options and does not report accuracy to the user.
- Product detail navigation already sets a Google Maps Directions URL (`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`). On supported Android devices this URL commonly hands off to Google Maps, but app/browser behavior must be tested on real devices.
- Public Store "Directions" currently links to OpenStreetMap, not Google Maps.
- Product detail map is a static Leaflet preview with a separate directions control. The Store page also shows an embedded Leaflet map and a separate Directions link.

This is a static code review only; no live device/browser behavior was tested.

## Recommended implementation

### A. Shared high-accuracy location helper
- Use the browser Geolocation API only after an explicit user action or existing permission flow; do not silently request location repeatedly.
- Request `enableHighAccuracy: true`, `maximumAge: 0`, with a sensible timeout (initially 30 seconds).
- Read and retain `coords.accuracy` (metres) alongside latitude/longitude.
- Define a user-friendly quality policy: <= 50 m = good; 51–100 m = usable with a visible accuracy note; > 100 m = ask user to retry or adjust the pin manually. These are proposed UX thresholds, not a claim that GPS always reaches them.
- Never replace a user's manually adjusted map pin with a late-arriving GPS result.
- Provide clear permission-denied, location-services-off, timeout, unsupported-browser and poor-accuracy messages.
- Keep manual map pin selection/dragging as a fallback; do not block local users who deny location permission.
- Avoid unnecessary repeated GPS requests. Use a shared helper consistently for ad creation, store location, distance calculation and any location-based discovery.

### B. Google Maps handoff
- Use a Google Maps Directions URL with the exact destination coordinates, for example `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`.
- Use this same destination format for product detail and public Store Directions; remove the OpenStreetMap destination link from the buyer-facing Directions action.
- Let Android/iOS handle the Google Maps universal/deep link when the app is installed; retain the HTTPS Google Maps URL as fallback. Do not depend on a custom `google.navigation:` scheme as the only route.
- Add safe URL construction/coordinate validation and open external links with appropriate security attributes.
- The embedded Leaflet preview can remain; tapping the explicit Directions action should launch Google Maps.

## Acceptance tests (Staging, real devices)
1. Android with location enabled and permission granted: Use My Location returns coordinates and visibly reports accuracy in metres.
2. Poor reported accuracy (>100 m): user is asked to retry or adjust the pin; poor fix is not silently labelled precise.
3. Permission denied / GPS disabled / timeout / unsupported browser: clear guidance appears and manual pin remains usable.
4. Manual pin drag/tap remains authoritative even if a GPS callback arrives later.
5. Product Directions opens Google Maps app when installed and a valid Google Maps web route otherwise.
6. Store Directions does the same and no longer opens OpenStreetMap.
7. Confirm destination pin/coordinates are correct for both product and store.
8. Check mobile Chrome, Android Google Maps installed/not installed, and at least one iOS browser if supported.
9. Check slow network: GPS UI shows progress, timeout/retry remains understandable, and map actions do not freeze the page.

## Safety and release boundary
- No Firestore schema/rules change is required for this UX feature.
- Do not request background location or store continuous user tracking.
- Do not save a buyer's current location unless the user explicitly invokes a feature that needs it and the data use is clearly explained.
- Implement and test on Staging/Preview first. Production remains untouched until explicit approval.
