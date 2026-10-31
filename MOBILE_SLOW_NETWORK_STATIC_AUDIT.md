# OLDX Mobile and Slow-Network Static Audit

**Branch:** `security-hardening-review`  
**Audit date:** 2026-11-01  
**Scope:** Static review of `index.html` and `admin.html`; no live device, browser, network-throttle, or production testing performed.  
**Evidence:** Source inspection only. Findings below are risks to validate, not measured user-facing failures.

## 1. Initial-load dependencies

The main page loads Tailwind's CDN script, Font Awesome CSS, Google Fonts CSS, Leaflet CSS, and Leaflet JavaScript from third-party origins in the document head. Leaflet JavaScript is a normal parser-blocking script.

**Risk:** Users on slow or unreliable mobile networks may wait on third-party assets before the page finishes parsing. A third-party outage or blocked request may also affect dependent UI.

**Safe follow-up:** Measure cold-cache startup on throttled mobile networks. Then consider self-hosting/pinning critical assets, loading map code only when a map is opened, and deferring non-critical styles/icons. Do not add `defer` to Leaflet blindly: inline scripts may expect global `L` during parsing. Verify all map initialization paths before changing script loading.

## 2. Product image selection and processing

Product create and edit accept multiple `image/*` files. The source processes selected files sequentially through `compressImage()`, using FileReader, an Image element, and canvas before saving Base64 strings to Firestore. The visible inputs do not declare a file-count or input-byte-size cap.

**Risk:** Large or numerous source images can consume substantial memory and delay the form on lower-memory phones. The sequential browser compression path has no visible progress UI in the inspected code. Base64 also increases payload size and keeps image data inside Firestore documents.

**Safe follow-up:** Before reading/decoding files, validate count and byte sizes; show per-file preparation progress and actionable errors; allow cancellation/retry. The durable upload-progress solution should use Firebase Storage resumable upload tasks and retain legacy Base64 read compatibility, but this requires a separately reviewed storage/schema/moderation migration and explicit owner approval. Keep new uploads private/pending until trusted server-side moderation approves them.

## 3. Geolocation startup and map dependency

The main page contains a geolocation request in startup flow with a 10-second timeout and 60-second maximumAge, plus a separate initial location read that updates the in-memory default coordinates. Store location uses a high-accuracy request with a 30-second timeout and maximumAge 0. Ad-location selection uses another geolocation path.

**Risk:** Multiple location requests can create confusing permission/timing behavior and may use different freshness/accuracy policies. A 30-second high-accuracy request may feel stalled on phones with weak GPS reception.

**Safe follow-up:** Centralize explicit user-triggered location requests, state the reason before requesting permission, show progress/cancel/manual-location alternatives, display reported accuracy, and preserve manually selected map pins. Test indoors and on devices without GPS. Do not claim a fixed accuracy guarantee.

## 4. Existing positive practices observed

- Main product-card images set `loading='lazy'` and `decoding='async'`.
- Current product edit thumbnails and chat attachment images also use lazy loading in inspected paths.
- Both main and admin pages declare a responsive viewport.
- Store photo UI communicates a 5 MB maximum; this audit did not establish equivalent client-side byte/count guards for product photos.

## 5. Required real-device test matrix

Use synthetic/test accounts and products only.

| Scenario | Device/network | What to record |
|---|---|---|
| Cold first load | Android Chrome, slow 3G | First useful content, LCP, JS errors, third-party request failures |
| Repeat load | Android Chrome, slow 3G | Cache benefit, layout shifts, interaction delay |
| Browse product feed | Low-memory Android, slow 4G | Scroll smoothness, image decode delay, memory pressure |
| Create product with images | Android, slow 3G | Time per image, memory use, validation, progress accuracy, save outcome |
| Open map / choose location | Android, indoors and outdoors | Permission UX, time to fix, reported accuracy, manual fallback |
| Chat / Inbox | Android, slow 3G | Inbox render time, chat-open time, reads/writes, reconnect behavior |
| Admin panel | Desktop and mobile viewport | Table overflow, pagination, load time, authorization error handling |

Repeat journeys several times; record cold and warm cache separately. Report medians and worst observed values. No numeric performance budget should be claimed until measured.

## 6. Delivery boundary and priority

1. **Low-risk next code task:** add explicit product-image file-count and byte-size validation before FileReader/Image decoding, with clear user-facing errors and regression tests. Agree limits against the intended user workflow before enforcing them.
2. **Next measurement task:** run real Android Chrome and throttled-network tests; source inspection cannot substitute for this.
3. **Larger architecture task:** Firebase Storage resumable upload progress and trusted moderation is a schema/security migration; requires bucket verification, design review, Emulator/Staging validation, and explicit owner approval.
4. Do not change production, publish Firestore/Storage Rules, or migrate existing user data as part of this audit.
