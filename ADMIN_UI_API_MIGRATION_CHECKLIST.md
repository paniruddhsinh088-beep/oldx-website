# OLDX Admin UI → Trusted API Migration Checklist

**Branch:** `security-hardening-review`  
**Status:** Static mapping of the current `admin.html`; migration plan only. No UI code, API endpoint, Firestore access, or deployment changed.

## 1. Existing UI behavior confirmed in source

| Current UI behavior | Current implementation | Target operation | Migration requirement |
|---|---|---|---|
| Dashboard traffic | Direct read of `stats/traffic`, field `totalViews` | `dashboard.summary` | Return only trusted aggregate; null/unavailable until aggregate source exists |
| Total Ads / Featured Ads | Full `products` collection read and browser count | `products.list` plus trusted summary | Never derive global counts from current page; summary is independent |
| Ads table | Full products read; renders title, category, finalPriceStr, location, sellerUid | `products.list` | Fixed projection; bounded pagination; no full document spread |
| Ads search | Browser `includes()` over all cached titles/locations | `products.list?q=` | Define indexed prefix/token strategy; do not claim substring parity |
| Delete ad | Direct `products/{id}.delete()`; immediate local removal and success alert | No enabled operation in v1 | Permanent delete remains disabled until retention/legal hold/recovery and owner approval; UI must show unavailable, not fake success |
| Users list | Full `users` collection read | `users.list` | Bounded page; UID and approved display fields only |
| User search | Browser `includes()` over displayName/email | `users.list?q=` | Search only fields the caller is allowed to see; email search disabled unless specifically approved |
| User table | Displays displayName, email, lastIp, UID | `users.list` | Default table omits email/IP; show displayName and UID only |
| View Audit File | Opens modal from cached user + all cached products | `users.case.read` and `users.case.products.list` | Require case ID, purpose/reason and separate permission; server returns minimal fields and records an audit event |
| Modal identity | Reads displayName, email, UID | Case-read projection | Email only under explicit approval; UID and displayName can be returned by approved case summary |
| Modal network info | Reads lastIp and lastSeen | Case-read projection | IP is currently client-reported and untrusted; do not present as verified evidence. Require separate policy approval or omit. lastSeen needs approved purpose and access scope |
| Modal listing history | Filters the full products cache by sellerUid | `users.case.products.list` | Server-side bounded query by exact sellerUid; never fetch all products into browser |

## 2. Required client behavior after migration

1. Obtain the current Firebase ID token from the authenticated Firebase session; send it as a Bearer token. Never send or trust a browser-side role flag.
2. Call only fixed Admin API operations. Never construct Firestore collection paths in the browser.
3. Render the initial page as loading; replace it with data only after a successful API response.
4. Keep pagination state per tab. Send only the opaque `nextPageToken` returned by the API; clear it when query/filter/page size changes.
5. On 401, return to sign-in. On 403, show access denied. On 503, show a temporary configuration/unavailable state. Do not silently fall back to direct Firestore reads.
6. Preserve current table columns that remain approved, but remove email/IP columns from the default Users table. Keep UID available for support/case reference.
7. Do not optimistically remove a listing or show success for deletion until a separately approved server mutation returns a committed result. In v1, permanent deletion is disabled.
8. Forensic modal must require an explicit case context and server response; do not build it from a broad client cache. Show source/verification labels for sensitive evidence.
9. Dashboard counts must come from trusted aggregates, not current-page length or browser scans.
10. Keep empty, loading, error, and retry states distinct. API failures must preserve the last confirmed UI state without claiming success.

## 3. API response and UI contract

- Lists return a fixed `items` array, optional opaque `nextPageToken`, and server-generated `requestId`.
- Product item projection: document ID, title, category, finalPriceStr, location, sellerUid; moderation fields only after exact field verification and approval.
- User item projection: UID, validated displayName, and only explicitly approved account status.
- Case summary and case-product history are separate calls; both require case authorization and audit.
- Dashboard values may be null/unavailable until trusted aggregate data exists.
- Every sensitive response is non-cacheable.
- The UI must never receive full Firestore documents or raw cursor positions.

## 4. Migration order

### Phase A — API client shell (no endpoint assumption)
- Add a small API client that obtains a fresh Firebase ID token, sends JSON/HTTP requests to a fixed same-origin API base, and normalizes safe error codes.
- Keep it inactive until a trusted staging endpoint is approved and deployed.
- Unit-test token absence, HTTP errors, malformed JSON, pagination reset, and no direct-Firestore fallback.

### Phase B — Read-only Products and Users
- Implement fixed server projections and bounded pagination in staging.
- Verify synthetic Emulator fixtures and server-side field minimization.
- Replace the browser full reads and client caches.
- Add search only after an indexed search strategy exists.

### Phase C — Dashboard and case access
- Build trusted aggregates through approved write paths.
- Implement case-scoped read permissions and audit events.
- Do not expose IP/email until policy approval and evidence provenance are defined.

### Phase D — Mutations
- Keep permanent delete disabled in v1.
- Add reversible moderation operations only after atomic audit, idempotency, reason validation, and recovery tests pass.

## 5. Explicit unresolved decisions and gates

- Is Admin email visibility required, for which roles/purposes, and should search include email?
- Should IP be omitted entirely? Existing `lastIp` is browser-reported and must not be represented as verified.
- What exact case type, reason codes, retention, and permission gate apply to forensic access?
- What trusted aggregate source will power dashboard counts?
- Which backend runtime, region, billing, service identity, IAM scope, and secret storage are owner-approved for staging?
- What retention/legal hold/recovery workflow is required before permanent product deletion?

## 6. Safety boundary

This checklist does not modify `admin.html`, implement endpoints, create Firestore Rules, provision roles, add secrets, change Firebase/Vercel settings, or deploy anything. Production remains untouched.
