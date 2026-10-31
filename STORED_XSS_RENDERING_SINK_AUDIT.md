# OLDX Stored XSS — Static Rendering Sink Audit

**Branch:** `security-hardening-review`  
**Status:** Static source review and remediation plan only. No HTML/JS application code changed.  
**Scope:** `index.html` on the review branch. Findings are based on source sinks, not a live exploit or penetration test.

## Executive summary

Several dynamic values are interpolated into `innerHTML` templates. Some values originate from user input, Seller-created Product documents, chat input, or remote/AI output. If attacker-controlled markup is stored or returned, the browser may interpret it as HTML/script-capable markup.

This is a potentially high-severity stored/reflected XSS class of issue. Exploitability and exact execution context must be verified safely in a local synthetic browser test before release. Do not rely on Firestore Rules alone: a malicious or compromised account may still create allowed text values that become dangerous at an HTML sink.

## High-priority dynamic sinks observed

| Approx. source line | Rendering context | Dynamic values | Risk / required treatment |
|---|---|---|---|
| 1939 | AI/chat user message bubble | `msg`, `timeStr` | User-entered text must use `textContent` or a safe text node; do not interpolate into HTML. |
| 1961 | AI reply bubble | `aiReply`, `timeStr` | Treat model/service output as untrusted text; render as text unless a deliberately sanitized rich-text format is required. |
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
