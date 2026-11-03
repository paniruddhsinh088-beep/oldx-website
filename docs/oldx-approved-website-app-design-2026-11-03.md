# OLDX approved visual design target — 3 November 2026

## Owner decision
The owner reviewed the concept illustrations of the OLDX desktop website homepage and the OLDX Android mobile app (five views: Home, Categories, Seller Store, Service Providers, Chat) in ChatGPT on 3 November 2026, explicitly liked both, and requested that the visual direction be saved and used. **Status: APPROVED AS A DESIGN TARGET**, not approval to deploy, spend money, change operational settings, or declare any feature live.

## Design direction
- OLDX branding: bold navy/royal blue with a warm orange X, clean white/light-blue surfaces, generous whitespace, rounded cards, legible typography, subtle borders/shadows, attractive but fast-loading visuals.
- Desktop homepage: logo, prominent search, Gujarat/location, language selection, account/chat/notification controls; navigation for Home, Products, Stores, Service Providers, My Posts, Orders/help where supported; concise hero banner with Post Product and Create Store actions; category icon tiles; product cards with photo/price/location/favorite; seller Store cards; Service Provider cards; clear trust and direct-contact cues.
- Mobile app: consistent brand and visual hierarchy, responsive Home, category list, seller micro-store/catalogue, multi-service provider discovery/contact, private Chat inbox, and a persistent compact bottom navigation for Home, Store, Post, Services, Chat (adapt to actual signed-in state and navigation semantics).
- Three initial UI languages: Gujarati, Hindi and English. Gujarati typography must be correctly proofread, not copied from generative image text. Preserve user-authored content.
- Mobile-first: 320px and 375px acceptance, touch targets, safe areas, keyboard visibility, fast startup, small bundles, accessible contrast, clear loading/empty/error/retry states. Keep shared web code Capacitor-compatible.
- Seller storefronts should feel like mini-websites with catalogue and shareable preview; Service Providers support multiple services and appropriate buyer contact/review flows. Product, Store, Service, Chat, Admin security requirements remain unchanged.

## Important boundaries
The generated illustrations are **visual concepts**, not screenshots of implemented code or a pixel-perfect binding contract. Product photos, store/provider names, verification badges, ratings, prices, counts, notifications and example chats shown in the concepts are illustrative, not real records or approved factual claims. Do not render fake verification badges, fake ratings, fake unread counts, or unsupported commerce features (e.g. Orders) in the live UI. Use real authorized data and meaningful empty states. Prefer visual fidelity in layout, spacing, branding and usability over literal invented text.

## Implementation priority for Codex
1. Read AGENTS.md, latest source, launch decision register, and Product/media checkpoint; do not overwrite concurrent work.
2. First connect existing Product form/discovery/private enquiry UI to the default-off trusted SDK/HTTP ports and cover retries, cancellation, mobile layout and gu/hi/en.
3. Apply this approved design system incrementally to existing pages without breaking features; use shared CSS/components, no heavy UI framework or costly service solely for appearance.
4. Extend the same visual patterns to Store, Service Providers and Chat, with real role/authorization boundaries. Add real-markup browser tests, accessibility, performance and responsive checks.
5. Preserve security, privacy, low recurring cost and approval gates. Work only on security-hardening-review; no main merge, live/staging deployment, Rules/index/provider activation, IAM/billing changes or paid actions without separate explicit approval. Launch stays HOLD/NO-GO until tested and approved.

## Design source note
Visual references were generated in the ChatGPT conversation on 3 November 2026. They are not included as binary assets in this Markdown checkpoint; ask the owner to provide the concept images if pixel-level reference is required. This file is the durable approved design brief for the repository and future Codex work.
