# OLDX Trust, Content Safety, Performance and Easy-Use Requirements

**Branch:** `security-hardening-review`  
**Status:** Requirements and implementation plan only. No moderation service, model, schema migration, paid integration, or Production change is authorized by this document.  
**Owner request recorded:** 2026-11-01

## Owner-confirmed product goals

1. Chat users should receive a clear warning when suspicious activity is detected.
2. Pornographic/explicit product photos should trigger a user warning and be removed from public product display; repeat or severe violations should be handled under a clear moderation policy.
3. The app should feel fast and smooth, including on mobile devices and slow or unstable internet.
4. The app should remain easy to use for ordinary local Buyers and Sellers. Safety controls must not make normal chat, listing, editing, or browsing unnecessarily difficult.

## A. Chat suspicious-activity warnings

### Detection signals to evaluate

- High-volume or repetitive messages sent in a short period.
- Repeated copy-paste messages across multiple chats.
- Repeated unsolicited links, suspicious shortened URLs, or known malicious domains.
- Scam-like patterns such as requests for OTPs, passwords, PINs, advance payments, or off-platform payment pressure.
- User reports and verified block/report patterns.
- Threats, harassment, abusive language, impersonation, or attempts to move users into unsafe channels.

A single keyword, unfamiliar phrase, local-language expression, or ordinary phone number must not by itself trigger an automatic account penalty. Gujarati, Hindi, English and common mixed-language text must be considered to reduce false positives.

### User-facing response

- Show a short, understandable warning close to the relevant action (for example, before opening a suspicious link or after a rate limit is reached).
- Explain the reason in plain language and provide a safe next step.
- Use graduated actions: warning → temporary send cooldown / link caution → report/review → proportionate account restriction only when evidence and policy justify it.
- Provide an accessible Report option and a way to appeal or request review when an action affects account access.
- Do not silently delete legitimate chat history. Preserve the owner-confirmed rule that existing chat history remains visible after a block.
- Do not expose private chat contents to public users or ordinary Admin tables. Any automated analysis must be disclosed clearly and limited to the stated safety purpose.

### Enforcement boundary

Detection and enforcement must not rely only on browser JavaScript. Rate limits, link reputation checks, report handling, and any message restrictions must be enforced through a trusted server-side boundary. Do not trust client-supplied risk scores, sender identity, timestamps, or moderation outcomes.

## B. Explicit / pornographic product-photo moderation

### Upload and moderation flow

1. Validate file type, size and image decoding before accepting an upload. Do not trust filename or browser MIME type alone.
2. Run an image-safety classifier or trusted moderation service on the server before making the image publicly visible.
3. If the result is clearly explicit/prohibited, immediately quarantine or hide that image from public product pages and show the Seller a clear warning with the reason and next step.
4. If confidence is uncertain, keep the image unpublished and send it to a review path rather than automatically penalizing the account.
5. Allow the Seller to replace the image and request review where appropriate.
6. Apply repeat-offender restrictions only under a documented, proportionate policy.

### Deletion and evidence handling

- “Remove” means immediately remove the image from public display and active product feeds.
- Keep any quarantined copy in a restricted, access-controlled review store only when legally and operationally justified, with short documented retention, audit logging and deletion schedules.
- Permanent deletion must follow the approved retention/appeal policy. Do not silently retain explicit material indefinitely.
- Do not display, forward, or include explicit images in ordinary Admin views, logs, analytics, or support messages.
- Do not send images to a third-party moderation provider until the provider, data region, retention, cost, security and privacy terms have been reviewed and the owner explicitly approves the integration.
- Do not promise perfect detection. Classifiers can make mistakes; uncertain cases need review and appeal.

### User-friendly warnings

- Tell the Seller which image was rejected and what kind of content is not allowed, without showing explicit preview content again.
- Keep the rest of the product draft intact so the Seller can replace only the rejected image.
- Preserve normal legitimate product images; avoid broad category or skin-tone-based assumptions.

## C. Speed, smoothness and slow-network resilience

### Performance work

- Measure current page load, interaction responsiveness, image weight, JavaScript execution, Firestore reads and network failures before optimizing.
- Prioritize mobile-first loading and the first useful screen.
- Use responsive image sizes and modern formats where supported; lazy-load below-the-fold images.
- Avoid downloading full-resolution product galleries before the user opens a product.
- Paginate and limit product, chat and Admin queries; avoid unbounded collection reads.
- Cache only safe, non-sensitive public data with explicit freshness/invalidation rules. Never cache private chat, account, or Admin data in a shared/public cache.
- Reduce duplicate listeners, repeated DOM rendering, unnecessary Firestore reads and large synchronous work on the main thread.
- Add loading, empty, retry and offline/slow-network states. Prevent duplicate submissions while a request is pending.
- Keep map, analytics and other non-essential scripts from blocking core browsing and chat interactions.

### User experience and acceptance targets

- Core actions should remain usable on common Android phones and mobile browsers.
- Product browsing, opening a product, contacting a seller, sending a message and managing one's own listing should remain understandable with minimal steps.
- On slow connections, show useful content progressively and provide clear retry feedback rather than freezing or silently failing.
- Set measurable budgets only after a baseline is recorded; proposed metrics include Core Web Vitals (LCP, INP, CLS), page weight, image bytes, Firestore reads per journey and chat send latency.
- Test on a representative range of devices and throttled networks before declaring improvements complete.

## D. Safety and usability guardrails

- Avoid false-positive warnings that interrupt normal local marketplace conversations.
- Explain warnings in simple Gujarati/Hindi/English where feasible.
- Do not require Admin approval for ordinary Seller actions such as editing a listing or changing Sold/Available status.
- Keep warning text actionable and non-accusatory.
- Provide accessible controls, readable text, clear progress and recovery from errors.
- Security and moderation must be privacy-preserving, auditable and proportionate.

## E. Delivery sequence

1. **Requirements and threat model:** inventory current chat send/report/block paths and product image upload/storage paths. No policy enforcement changes yet.
2. **Baseline and test plan:** measure mobile performance and slow-network behavior; define test cases for spam, suspicious links, false positives and explicit-image classifier confidence.
3. **Architecture proposal:** compare self-hosted moderation and external providers, including privacy, data residency, retention, pricing, latency and Gujarati/Hindi coverage. Present the selected option for owner approval before any paid service or external image sharing.
4. **Staging implementation:** implement server-side checks, quarantine, warnings, report/review and performance optimizations behind controlled Staging-only rollout.
5. **Validation:** test false positives, bypass attempts, image replacement, appeals, mobile usability, slow networks and regression of existing marketplace journeys.
6. **Owner review:** show results, limitations and cost/privacy implications. Production rollout requires explicit owner approval.

## F. Not yet decided / not authorized

- Exact definition and severity levels of suspicious chat activity.
- Whether automated chat analysis will be limited to metadata/rate patterns or include message-content classification; this requires clear privacy notice and owner approval.
- Moderation provider/model, hosting region, image retention and review staffing.
- Exact prohibited-image policy, confidence thresholds, appeal window and repeat-offender consequences.
- Performance budgets after baseline measurement.
- Any paid provider, new Firebase/Storage schema, backend deployment, Firestore Rules publication, real-data migration or Production rollout.

**Current implementation status:** This file records requirements and a safe delivery sequence. It does not mean chat detection, image moderation, warning UI, automatic removal, or performance optimization has already been implemented or tested.
