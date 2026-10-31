# OLDX Stored XSS — Static Rendering Sink Audit

**Branch:** `security-hardening-review`  
**Status:** Static source review and remediation plan only. No HTML/JS application code changed.  
**Scope:** `index.html` on the review branch. Findings are based on source sinks, not a live exploit or penetration test.

## Executive summary

Several dynamic values are interpolated into `innerHTML` templates. Some values originate from user input, Seller-created Product documents, chat messages, or Firestore conversation previews. The current AI reply text is hard-coded. If attacker-controlled markup is stored or returned, the browser may interpret it as HTML/script-capable markup.

This is a potentially high-severity stored/reflected XSS class of issue. Exploitability and exact execution context must be verified safely in a local synthetic browser test before release. Do not rely on Firestore Rules alone: a malicious or compromised account may still create allowed text values that become dangerous at an HTML sink.

## High-priority dynamic sinks observed

| Approx. source line | Rendering context | Dynamic values | Risk / required treatment |
|---|---|---|---|
| 1939 | AI/chat user message bubble | `msg`, `timeStr` | User-entered text must use `textContent` or a safe text node; do not interpolate into HTML. |
| 1961 | AI reply bubble | `aiReply`, `timeStr` | Current `aiReply` values are hard-coded strings, not live model output. Still render as text; if this later becomes service/model output, continue treating it as untrusted. |
| 2346 onward | Inbox/chat list | Other-user display name and room metadata should be traced in the full template | Use text nodes for user-controlled labels; validate IDs separately before event handlers. |
| 2922 onward | Seller's My Ads cards | `p.title` and product display fields | Seller-controlled Product values must be text nodes; image URLs need URL validation and safe attribute assignment. |
| 3612 | Cart rows | `id`, `title`, `price`, `img` | Avoid HTML interpolation and inline JavaScript handlers containing document IDs. Use DOM nodes and event listeners. |
| 4331 | Product detail image slider | `p.images[]` | Validate image URLs and assign via `img.src`; do not interpolate arbitrary values into HTML attributes. |
| 4336–4342 | Product detail highlights | `extraDetails` keys and values | Directly interpolated into `innerHTML`; render keys/values with `textContent`. This is a confirmed unsafe sink pattern. |
| 4744 | Recently viewed Product rows | `m.images[0]`, `m.title`, `m.finalPriceStr` | Product data must not be interpreted as HTML or attributes. |
| 4877 onward | Main Product cards | Product title, image URL, price and badges | Trace every interpolated Product field; use DOM/text nodes and validated URLs. |

Other templates interpolate category labels, state/distance options, and product/store values. Static configuration values have a different trust profile from Firestore/user-controlled values, but should still be rendered safely where practical.

## Remediation principles

1. Prefer DOM construction:
   - `element.textContent = value` for all plain text.
   - `element.setAttribute()` only after validating the expected attribute value.
   - `img.src = validatedHttpsUrl` rather than embedding an untrusted URL in an HTML string.
   - `addEventListener()` with a closed-over validated identifier rather than inline `onclick` strings.

2. Do not attempt ad-hoc HTML escaping as the primary fix for every context. Text, URL, CSS, and JavaScript contexts require different handling. Avoid dynamic values in inline JavaScript and CSS entirely.

3. If a specific feature truly requires rich HTML, use a maintained allowlist sanitizer with an explicit tiny policy and tests. Chat and Product descriptions should default to plain text.

4. Validate Firestore document IDs and URL schemes separately. HTML escaping does not make an unsafe URL safe.

5. Keep existing UX:
   - Product descriptions/highlights should continue to display as readable text.
   - Chat messages should preserve line breaks safely.
   - Product images should continue to load from the existing approved image pipeline.
   - Product cards, cart, Recently Viewed and My Ads should remain clickable through event listeners.

## Safe regression tests required

Use synthetic strings only, for example:
- `<img src=x onerror=alert(1)>`
- `<svg onload=alert(1)>`
- `"><script>alert(1)</script>`
- `javascript:alert(1)` as a rejected image/link URL
- Strings containing quotes, ampersands, emoji and Gujarati text.

Acceptance:
- These values appear literally as text, not executable markup.
- No event handler is created from user-controlled strings.
- Invalid URL schemes are rejected.
- Normal Gujarati/English text, multiline chat messages, titles and existing product image URLs continue to render.
- No raw test payloads are sent to Production or real users.
- Run local browser tests and all existing CI/emulator suites before merging.

## Recommended order

1. Fix chat and AI message bubbles first.
2. Fix Product detail highlights and Product card / My Ads / Recently Viewed sinks.
3. Fix cart and any remaining user-controlled inline event-handler templates.
4. Audit Store and Admin templates for the same pattern.
5. Add a static scan/test to prevent new unsafe dynamic `innerHTML` interpolation.

## Safety boundary

This audit does not change `index.html`, Firestore Rules, Firebase data, external services, or deployments. A focused remediation patch should be made on the review branch with synthetic regression tests, then verified in Staging before Production approval.


## Review-branch remediation status

**Fixed in `index.html` (review branch):**
- User-entered AI-chat prompt is now placed into a paragraph using `textContent`; multiline input is preserved with `white-space: pre-wrap`.
- The current hard-coded chatbot reply and timestamp are also rendered through text nodes. The existing greeting entity is converted to a literal waving-hand emoji so it remains user-friendly without HTML parsing.

**Verification level:** The updated source block was fetched back from GitHub and visually checked after the commits. This is source-level verification only. No browser execution, automated XSS regression test, Staging deployment, or mobile test has yet been completed.

**Still open:** Inbox preview, Product cards, My Ads, Product detail highlights/images, Recently Viewed, cart, and remaining dynamic templates listed above. The chatbot fix does not make the entire website XSS-safe.


**Additional review-branch fix:**
- Inbox conversation previews, timestamps and unread-count badges now use DOM text nodes. The remaining `innerHTML` assignments in that inbox card are limited to fixed, developer-authored icon markup; chat preview text and time are no longer interpolated into HTML.
- Added `tests/firestore-emulator/xss-rendering-source.test.mjs` and included it in `npm run test:emulator:safety`. It statically guards the chatbot and inbox source patterns against regression.
- The test has been committed but has not yet been executed in GitHub Actions or a local Node runtime in this session. It is a source-pattern regression check, not a substitute for a browser-based XSS test.


**Additional Product-detail remediation on the review branch:**
- Product-detail image slider now creates image elements with DOM APIs instead of interpolating image URLs into HTML. It accepts HTTP(S) URLs and base64 PNG/JPEG/WebP/GIF data images only; other schemes and SVG data URLs are rejected.
- Product-detail highlight labels and values now use `textContent`, preventing stored product metadata from becoming markup.
- Added `xss-product-detail-source.test.mjs` to the dependency-free safety suite. It checks the source patterns for dynamic highlight text and image URL filtering.
- This is a source-level mitigation. It has not yet been run in CI or verified in a browser/device. Product-card, My Ads and cart rendering still need remediation.


**Further review-branch remediation (My Ads, Saved Ads Cart, Product Cards):**
- My Ads product titles and prices are now assigned through `textContent`; stock/edit/delete actions use event listeners and close over the product ID rather than interpolating it into inline JavaScript.
- Saved Ads Cart titles/prices now use `textContent`; product navigation/removal use event listeners. Cart image sources are restricted to HTTP(S) or base64 PNG/JPEG/WebP/GIF data URLs, with a fixed placeholder for other values.
- Product cards now use a static DOM skeleton; Firestore-controlled location, category, title and price are populated through text nodes. Save/buy actions use event listeners. Product image URLs use the same restricted scheme check.
- Added `xss-product-card-cart-myads.test.mjs` to the dependency-free safety test command.
- Source review confirms these paths no longer interpolate the listed dynamic fields or IDs into their HTML/inline handlers. The new test suite is configured in GitHub Actions, but no passing CI result has yet been observed for this commit. Browser interaction/regression tests remain outstanding.


**Additional review-branch remediation (Search Autocomplete and Public Store):**
- Search autocomplete no longer interpolates product title, price or image URL into an HTML template. Titles/prices are assigned with `textContent`; image URLs are limited to HTTP(S) and base64 PNG/JPEG/WebP/GIF data URLs.
- Public Store category filter buttons no longer place category IDs into inline JavaScript. They carry escaped data attributes and bind click listeners; active-filter state reads the data attribute rather than parsing an `onclick` string.
- Public Store shop-photo rendering now rejects unsupported URL schemes and accepts only HTTP(S) or base64 PNG/JPEG/WebP/GIF data URLs.
- Added `xss-search-store-source.test.mjs` to the dependency-free safety test command, covering autocomplete text/image handling, Store category action binding and shop-photo URL validation.
- Admin source scan found only two `innerHTML` assignments in `admin.html`, both constant developer-authored icon/button labels; the row data is built separately. This is a source scan, not a full Admin runtime security review.
- The new source tests are configured in GitHub Actions; no passing result or browser-based execution has yet been confirmed. Store public page visual/functional regression testing remains outstanding.
