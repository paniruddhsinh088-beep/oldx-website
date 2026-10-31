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


## G. Initial source inspection findings (2026-11-01)

These are static source observations from the current `security-hardening-review` branch; they are not runtime measurements.

### Chat safety and media
- `checkScamAndSendChatMessage()` currently uses a small browser-side keyword list and blocks messages containing matches. This is not trusted enforcement and can create false positives (for example, broad tokens such as `won`) while missing more complex scams.
- The same function checks the recipient's `users/{uid}.blockedUsers` from the browser before sending. This is not an authorization boundary; authoritative block enforcement remains a Firestore/backend Rules requirement.
- Chat attachments are read as Base64 Data URLs in the browser and stored with the message. The inspected upload handler has a MIME allowlist but no visible byte-size limit or server-side content moderation. This can increase Firestore document size and client memory/network work.
- No server-side suspicious-activity scoring, trusted rate limiting, image moderation pipeline, quarantine workflow or appeal workflow was found in the inspected Chat/Product paths.

### Product photos
- Product images are compressed in the browser with canvas (maximum dimension 800px, JPEG quality 0.7) and placed into the product document as Base64 strings.
- Product edit follows a similar browser-side compression path.
- The inspected upload path does not run a server-side explicit-content classifier before images become part of the product record. Client-side file selection and compression are not content moderation.
- Store-photo upload uses a separate Cloudinary browser upload path; it also needs its own moderation/security review before any shared photo policy can be considered complete.

### Performance
- Global unread badge listener reads every message in every chat room for the signed-in user, then calculates unread count in the browser.
- Opening Inbox fetches all chat rooms and then downloads the full message history for each room to calculate latest message and unread count.
- Opening a Chat performs another unbounded query for messages from other senders and updates their read status one document at a time, even though the visible chat listener is limited to 35 messages.
- These patterns are likely to increase Firestore reads, latency and memory use as users accumulate chats. They are high-priority optimization candidates, but changing unread/read semantics requires a tested design (for example, bounded pagination and trusted unread/read metadata).
- The initial HTML loads Tailwind from its CDN and Leaflet JS in the document head; these are candidates for load-path measurement and deferred/non-blocking loading, but must be regression-tested before changes.

### Next technical work
1. Trace the full product-image and edit-image upload contracts, accepted file counts/sizes, and any legacy data compatibility before designing moderation.
2. Trace chat attachment compatibility, message write/read semantics and existing safety warning UI before changing message behavior.
3. Establish a repeatable baseline for Firestore reads, initial render, image bytes and interaction latency.
4. Design bounded inbox/chat pagination and unread/read metadata that preserve correct counts and all existing message visibility rules.
5. Only then implement isolated Staging changes with source tests and browser/device tests.

- **Low-risk first performance improvement applied on the review branch:** Product Card images (including Recently Viewed cards that reuse the same card renderer) now use browser-native lazy loading and asynchronous image decoding. A source regression assertion was added. This reduces unnecessary off-screen image work, but its real-world impact still needs mobile/slow-network measurement.


### Chat attachment and existing warning behavior (additional source review)
- Chat attachment selection currently checks the browser-reported MIME type against an allowlist, but does not impose a visible file-size cap before reading the entire file into memory as a Base64 Data URL and storing it inside the Firestore message document.
- The browser MIME type is user-controlled/untrusted metadata; server-side file signature/content validation and size enforcement are required. A migration to Firebase Storage or another approved object store should be evaluated so large binary content is not embedded in Firestore documents.
- Current chat warning logic runs only in the browser. It blocks any message containing broad strings including `won`, `prize`, and any `http(s)` link. This can block harmless local marketplace messages and still be bypassed by a modified client. It is not a reliable scam detector.
- **Do not simply expand the keyword list or treat this client-side check as security.** Replace it only after a trusted server-side policy and a user-friendly warning/appeal flow are designed. Detection should use contextual signals and graduated friction, not isolated words.
- Current block checks also query another user's `blockedUsers` array from the client. This is private-data exposure and not an authorization boundary; it must be replaced with an authoritative private block check in Rules or a trusted backend before the chat enforcement model is considered complete.
- Existing chat history UI subscribes to the latest 35 messages, while a separate read-receipt query retrieves all messages from other senders and updates each document individually. A bounded read-receipt design must preserve the existing "latest 35" display and owner-approved block/history semantics.

### Implementation caution
The current client-only keyword check should be treated as a temporary UX warning, not a security control. Until the trusted moderation backend is approved and implemented, do not claim that suspicious chat activity is comprehensively detected or prevented.
