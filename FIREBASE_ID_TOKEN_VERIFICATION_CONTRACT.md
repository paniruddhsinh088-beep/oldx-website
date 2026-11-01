# Firebase ID Token Verification Contract (Design Only)

Status: proposal for review-branch design work. This document does not implement a Worker, API route, Firebase Admin SDK, IAM binding, secret, network request, or deployment.

## Purpose and trust boundary

Any future user-scoped API must derive the caller identity exclusively from a cryptographically verified Firebase Authentication ID token. A request body, query parameter, cookie, client-supplied UID, role, or custom header is never an identity source.

The first pilot target, if separately approved, is the Firebase project `oldx-staging`. Production project IDs and credentials must not be accepted by the staging verifier.

## Required verification sequence

1. Accept only a single Bearer token from the Authorization header. Reject missing, duplicate, malformed, oversized, or non-Bearer credentials.
2. Parse exactly three JWT segments using strict base64url and JSON parsing. Reject malformed JSON, unsupported types, duplicate/ambiguous headers where detectable, and unexpected payload shapes.
3. Require JOSE header `alg === "RS256"`, a non-empty string `kid`, and no critical extensions or unsupported `crit` values. Reject `none`, HMAC algorithms, custom tokens, and Firebase session cookies.
4. Resolve `kid` only from Google's currently valid Firebase Secure Token public certificate set. Never trust a key URL or certificate supplied by the token.
5. Verify the original encoded header and payload bytes using RSASSA-PKCS1-v1_5 with SHA-256 and the matching RSA public key. Claims are not trusted before this step succeeds.
6. Validate claims after signature verification:
   - `aud` exactly equals the configured staging project ID `oldx-staging`.
   - `iss` exactly equals `https://securetoken.google.com/oldx-staging`.
   - `sub` is a non-empty string and becomes the authenticated UID.
   - `exp` and `iat` are finite numeric timestamps; token is not expired and `iat` is not unreasonably in the future.
   - `auth_time` is a finite numeric timestamp, is not in the future beyond the explicit clock-skew allowance, and is not later than `iat`.
   - Enforce a documented maximum token age only if a route's risk assessment requires it; do not silently substitute `iat` for `auth_time`.
7. Use a small, explicit clock-skew allowance and test its exact boundaries. Do not accept missing claims or coerce strings into numbers.
8. Return only a minimal verified principal such as `{ uid, projectId, authTime }`. Do not pass unverified decoded claims to authorization code.

## Certificate cache and network failure policy

- Fetch certificates only from Google's documented Secure Token certificate endpoint, never a token-provided URL.
- Respect the response `Cache-Control: max-age` and refresh before expiry with bounded network timeouts.
- Cache keys only in memory or an explicitly approved cache; do not persist private material (Google public certificates are public).
- On unknown `kid`, perform at most one controlled refresh, then reject.
- On certificate endpoint failure, use a still-valid cached certificate set only within its advertised validity; otherwise fail closed.
- Never disable signature verification or accept expired certificates to improve availability.
- Document cache stampede protection and a small response-size cap before implementation.

## Authorization is separate

A valid Firebase ID token proves a Firebase-authenticated identity; it does not prove that the caller is an administrator, store owner, product owner, or moderator.

- Every route must declare its required role and resource ownership checks.
- User-scoped routes must not trust `isAdmin`, `role`, `sellerUid`, or similar values from the request.
- Privileged Admin SDK / IAM operations are outside this contract and require a separate approved architecture.
- Firestore access must continue to respect the intended Security Rules; do not introduce a service-account OAuth token as a shortcut that bypasses Rules.
- The Staging Firestore deny-all baseline remains unchanged until a separate rules audit and explicit approval.

## Synthetic-only test matrix

All tests must run locally or in CI with fabricated JWTs and generated ephemeral RSA key pairs. Never use real user tokens, real Firebase certificates, production identities, or network-fetched keys in tests.

Required positive case:
- Correct RS256 signature, staging audience and issuer, valid timestamps, non-empty subject, known synthetic `kid`.

Required rejection cases:
- Missing/duplicate/malformed Authorization header.
- Wrong segment count, malformed base64url, invalid JSON, oversized token.
- `alg=none`, HS256, unsupported algorithm, missing/unknown `kid`, unsupported `crit`.
- Invalid signature, signature made by a different key, tampered header or payload.
- Wrong `aud`, wrong `iss`, production audience, missing/empty `sub`.
- Missing, non-numeric, expired, or future `exp`; invalid/future `iat`; missing/invalid/future `auth_time`; `auth_time > iat`.
- Unknown `kid` after one refresh, expired certificate cache, network timeout with no valid cache.
- Request body UID or admin flag differs from verified principal; verified principal remains authoritative.

## Runtime and cost gate

Before any Worker prototype, separately measure WebCrypto RSA verification CPU time with representative synthetic keys/tokens in the intended runtime. Do not assume the free-tier CPU budget is sufficient. Include cold and warm certificate-cache cases, latency, failure behavior, and a request-rate ceiling. No deployment, resource creation, secrets, IAM, billing, or Firebase changes are authorized by this design document.

## Approval gates

Implementation requires owner approval of platform, region, budget, route scope, token-age policy, certificate cache policy, rate limits, monitoring, rollback, and staging-only release gates. Until then this is documentation and test-design only.
