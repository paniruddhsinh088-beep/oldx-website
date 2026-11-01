# OLDX Cloudflare Workers + Firebase Compatibility Review

Reviewed: 2026-11-01  
Branch: `security-hardening-review`  
Status: architecture/security review only. No Worker, Google service identity, secret, Firebase resource, billing setting or deployment was created or changed.

## Executive result

Cloudflare Workers Free remains a promising low-cost option for small, stateless request handling, but it is **not yet approved as OLDX's privileged Admin backend**.

The key distinction is between two ways a Worker could call Firestore:

1. **Forward a verified user's Firebase ID token to Firestore REST.** Firestore evaluates Security Rules for that user. This can be appropriate for user-scoped operations when the Rules are correctly designed and tested.
2. **Use a Google OAuth access token from a service account.** Firestore treats this as application/service-account access, bypasses Firestore Security Rules, and authorizes through Google Cloud IAM. This is privileged and requires a dedicated least-privilege staging identity, safe key/token management, and a separate approval.

For this reason, do not add a service-account private key to a Worker or repository as a shortcut. The current admin backend starter remains source-only and disconnected.

## Verified platform facts

### Cloudflare Workers Free

The official Workers pricing page currently lists:
- 100,000 inbound requests per day across Workers.
- 10 ms CPU time per invocation.
- No charge for duration on Free.
- Workers Paid has a USD $5/month minimum account charge.

The official limits page also lists 128 MB memory, 50 subrequests per invocation and fail-closed routing as an available mode. When the Free daily request limit is exceeded, requests can return Error 1027. Keep security-critical routes fail-closed; never bypass authorization to keep the app available.

A 10 ms CPU budget is small. Token parsing, RSA signature verification, validation and request shaping must be benchmarked on the actual Worker runtime. Network waiting does not count as CPU time, but CPU-heavy image decoding/re-encoding is not suitable for this Free Worker request path.

### Firebase ID token verification

Firebase's official guidance requires a backend to verify the ID token's signature and claims, including:
- RS256 algorithm and a recognized signing-key ID.
- Expiration and issued-at time.
- Audience exactly matching the Firebase project ID.
- Issuer exactly `https://securetoken.google.com/<projectId>`.
- Non-empty subject/UID.
- Authentication time in the past.

Public signing certificates must be refreshed according to their HTTP cache lifetime. Never trust a UID or role sent separately in the request body.

The Worker must pin the expected project ID to exactly `oldx-staging` in Staging and reject any mismatch. Production credentials/configuration must not be available to this Worker.

### Firestore REST authorization modes

Firebase documents two relevant modes:

- Firebase ID token: request is evaluated under the user's Firestore Security Rules.
- Google OAuth access token from a service account: request acts as the application; Firestore Security Rules are bypassed and Google Cloud IAM decides access.

This means an ID-token-based Worker can only perform operations explicitly permitted by Firestore Rules. It must not try to work around the current Staging deny-all rules.

A service-account-based Worker can perform privileged operations, but it becomes a high-value trusted backend. It must have a dedicated staging-only identity and narrowly scoped IAM. A private service-account key is a significant security risk; Google recommends safer alternatives where available. Cloudflare Workers does not automatically inherit Google Cloud workload identity merely because it is a Worker, so a secure credential federation/signing design must be proven before use.

## Recommended OLDX architecture adjustment

### Phase 1 — no new backend runtime

- Keep current Vercel frontend as-is while its plan eligibility is checked.
- Keep Firebase Auth and Firestore as the existing identity/data platform.
- Keep Staging Firestore rules deny-all until collection-specific authorization and migration plans are tested.
- Continue pure local policy models, synthetic tests, frontend performance audit and source review.
- Do not create Worker, R2 bucket, service account, IAM grant, secret or billing change.

### Phase 2 — narrow Worker pilot, only after explicit approval

If a lightweight API is still needed, pilot a Worker only for a narrowly scoped, low-risk request:
- Verify Firebase ID token using maintained JWT tooling and Google's published certificates.
- Validate all required claims and exact `oldx-staging` audience/issuer.
- Derive actor UID from verified `sub`.
- Pass the user's original Firebase ID token to Firestore REST so Rules continue to apply.
- Use fixed collection paths, strict field allowlists, bounded queries and no arbitrary path/query forwarding.
- Do not process image bytes or hold service-account keys.
- Fail closed on verification, project, Rules, quota or provider errors.
- Measure CPU time and p50/p95 latency using synthetic tests before considering wider use.

This phase does not authorize real data access or writes; Staging rules remain deny-all until a separately approved rules plan exists.

### Phase 3 — privileged Admin operations remain separate

Do not use a Free Worker as an improvised Admin SDK replacement. For operations requiring Admin SDK/IAM privileges (for example, managing Firebase Auth users, assigning custom claims, or bypassing user Rules), compare:
- Firebase Cloud Functions / Cloud Run with a dedicated staging service identity; or
- A separately designed and reviewed Worker-to-Google identity federation approach.

Choose only after checking billing, regional availability, token revocation requirements, IAM, secret handling and integration test coverage. If safe identity federation cannot be proven, prefer the managed Google runtime despite possible billing requirements, or defer privileged operations. Do not weaken security to stay on a free tier.

## Important constraints for current OLDX source

- `functions/admin-backend` is framework-neutral, dependency-injected source only. It has no Firebase Admin SDK composition or deployed endpoint.
- Mutation schemas are not complete.
- No trusted atomic Firestore mutation + audit adapter exists.
- Admin Products/Users/Stores collection readiness is not verified.
- Existing browser Admin UI is unsafe to connect.
- Staging Firestore rules remain deny-all.
- The app's direct client Firestore paths will continue to be denied by those rules until the rules are deliberately reviewed and approved.

Therefore this review does not make OLDX ready for Admin runtime, Capacitor packaging or Play Store submission.

## Performance rules for mobile users

- Keep listing pages static/edge-cacheable where possible.
- Serve responsive, compressed derivatives rather than full originals.
- Lazy-load below-the-fold images and reserve image dimensions to prevent layout shift.
- Paginate results; never load whole collections.
- Avoid extra API round trips on the critical first screen.
- Cache public approved derivatives with immutable versioned URLs; never publicly cache chat/profile content.
- Prefer a same-origin API route to avoid extra CORS/preflight round trips.
- Measure on mid-range/low-end Android and constrained mobile networks before rollout.

## Decision

**Keep Cloudflare Workers Free as a candidate for a narrow user-scoped API pilot, not the selected privileged Admin backend.** R2 remains a candidate for image objects only after secure upload processing and moderation are designed and approved.

No runtime or provider provisioning is authorized by this review.

## Official sources

- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Firebase verify ID tokens: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Firestore REST API authentication and authorization: https://firebase.google.com/docs/firestore/use-rest-api
- Google service-account OAuth guidance: https://developers.google.com/identity/protocols/oauth2/service-account
- Google service-account key security: https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys

Pricing, quotas and product limits can change. Re-check official terms before any future approval.
