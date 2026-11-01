# Homepage and Mobile Performance Source Audit

Status: read-only source audit of `index.html` on `security-hardening-review`. No application behavior, Firebase configuration, production environment, or deployment was changed.

## Scope and evidence

Reviewed the homepage document (5,226 lines; approximately 316 KB at the inspected branch revision), initial external resource declarations, product/store loading, chat/inbox reads, and image-processing/rendering paths.

### Initial page resource loading

The document loads these resources in the initial HTML head:

- Tailwind Play CDN script: `https://cdn.tailwindcss.com`.
- Font Awesome 6.4 stylesheet from cdnjs.
- Leaflet CSS and JavaScript from unpkg, even though the map is used in the ad-posting wizard and not in the first viewport.
- Firebase App, Auth, Firestore and Storage compat SDKs from gstatic; the Storage SDK is loaded despite the current Storage plan/access limitation.

Potential impact: render-blocking stylesheet/script work, additional DNS/TLS connections, and downloading map/storage code before the user opens a feature that needs it. This is a source-level risk, not a measured Lighthouse result.

### Firestore listener and read amplification

- Homepage product listener is bounded by `productLimit` and ordered by `createdAt` (source around lines 3856–3858). This is a useful existing bound, but cursor-based pagination and listener scope should be verified before increasing the limit.
- Homepage store discovery is bounded to six records (around line 3804) and store photos are marked `loading="lazy"` (around lines 3820–3825).
- Global unread-message listener subscribes to every chat document matching `participants array-contains userId` (around lines 2230–2235), then issues a messages query for each chat without a limit (around lines 2240–2244). This can create N+1 reads and grow with chat history.
- Inbox loading fetches all matching chat rooms (around lines 2310–2313), then runs one messages query per room with no limit (around lines 2325–2327), and counts unread messages by scanning each fetched message set. This is another N+1 / unbounded-read path.
- The active chat view has a bounded latest-message listener of 35 messages (around lines 2616–2617), which is a better pattern to retain.

Potential impact: slow inbox opening, excess Firestore reads/cost, battery/network use on mobile, and increased listener work for users with many conversations. The current deny-all Staging Rules mean these client requests are expected to be denied in staging until a separately approved rules design is ready.

### Images and client-side processing

- Store card images use lazy loading.
- Product edit preview images use lazy loading (around lines 3130–3137).
- Product image compression decodes the selected image in the browser, resizes its longest side to at most 800px, and emits JPEG at quality 0.7 (around lines 4860–4890). This reduces upload payloads but is synchronous canvas work after decode and can affect low-end phones for large source images.
- Product images can still be represented as data URLs in application paths (including validation/rendering around lines 3131 and 5024). Embedding large image data in Firestore documents increases document transfer and memory pressure; the separate image-storage migration design remains the intended direction.
- This compression is not a security boundary: browser-provided MIME types and client-side resizing cannot replace server-side byte validation, decoding/re-encoding, moderation, quotas, and ownership checks.

## Recommended order (no code change yet)

1. **Reduce initial JS/CSS work:** replace runtime Tailwind CDN with a pinned, build-generated stylesheet only after confirming current styling coverage; do not change visual output blindly.
2. **Defer feature-only libraries:** load Leaflet CSS/JS only when the map wizard is opened; load Firebase Storage SDK only when a supported upload path exists and the approved provider is available. Avoid introducing dynamic loading regressions.
3. **Fix inbox read amplification:** store or maintain a trusted last-message summary and unread counters per conversation, then query bounded summaries. This requires a server-authoritative write path and a migration/consistency plan; do not implement client-trusted counters.
4. **Bound chat reads:** use a latest-message query with explicit order and limit; derive unread state safely from trusted summaries or a bounded server-side query. Do not fetch entire chat histories just to render inbox rows.
5. **Image rendering:** use `loading="lazy"`, `decoding="async"`, explicit width/height or aspect-ratio placeholders for below-the-fold images; preserve eager/high-priority behavior only for the actual hero image if present. Audit every image renderer before broad changes.
6. **Measure before/after:** collect mobile Lighthouse/Web Vitals (LCP, INP, CLS), network transfer, JS execution, Firestore document reads, and low-end Android interaction timing. Use synthetic/demo data and a staging preview only after its environment is verified.

## Explicit non-goals and safety boundaries

- No Firebase Rules changes or deployment; Staging Firestore remains deny-all.
- No Storage SDK activation, upload provider configuration, Cloudinary setting changes, bucket creation, or billing.
- No Firestore data migration, production data access, production deployment, or `main` changes.
- No client-side replacement for server authorization or image security.
- No claims of measured performance improvement; this is a static source audit only.

## Acceptance criteria for a future implementation

- Initial homepage does not download map or upload-only code until needed.
- Inbox work is bounded independently of lifetime chat count and message history.
- Product/store browsing remains paginated and stable under poor mobile networks.
- Images reserve layout space, decode off the critical path where supported, and never expose private originals by default.
- No UI regressions, no additional unbounded Firestore listeners, and no increase in unauthorised data exposure.
- Mobile measurements and Firestore read counts show improvement on the same synthetic workload.
