# Admin Backend Integrated Security Review

Review scope: current `security-hardening-review` source only. No live environment, Firebase data, Rules, IAM, secrets, or deployed runtime was accessed or changed.

## Verified safeguards in the current source

- `authz.mjs` requires a Bearer token, injected token verification, server-side active-role lookup, an `admin` role, and an explicit operation allowlist. Caller-provided UID and role are not used.
- `http-handler.mjs` enforces GET for reads and POST for mutations, returns no-store/security headers, rejects unsupported list query features, and scopes signed page tokens to actor UID, operation, query, filters, ordering, and page size.
- Mutation requests fail closed if the validator or atomic commit dependency is missing. The handler accepts only a plain validator result with `ok === true`, an own data-property `value`, and a plain-record normalized payload. Only that normalized payload reaches the commit adapter. Exceptions return a generic error.
- `admin-api-client.mjs` uses a fixed same-origin `/api/admin` base path, fresh ID-token callback, no-store fetch, and has no Firestore fallback.
- `admin-read-adapter.mjs` uses fixed collection names and field projections, caps pages at 50, orders by `createdAt` plus document ID, and rejects search/filter requests it cannot safely implement.

## Blocking gaps before any runtime or UI integration

1. **No deployed trusted runtime:** no Firebase Admin SDK composition, Vercel Function/Cloud Function endpoint, trusted service identity, or deployed API is present. The helpers are dependency-injected source only.
2. **No operation-specific mutation schemas:** structural validator-result checks do not validate business fields or nested payloads. No mutation should be enabled until each operation has an owner-approved schema and tests.
3. **No trusted atomic commit adapter:** domain changes and append-only audit records are not yet committed by a real trusted database transaction. No mutation endpoint or legacy Admin UI may be wired.
4. **Read operation coverage is partial:** the HTTP handler/client name Dashboard, Reports, Audit and case endpoints, but the current Firestore read adapter defines only Products, Users and Stores. No verified implementation for the other read operations was found in this review.
5. **Collection readiness is unresolved:** Users has no verified universal immutable `createdAt` source write. Products and Stores set `createdAt` on new records, but legacy coverage is unknown. No staging data coverage/index audit has been performed. Do not enable pagination against live collections until read-only evidence confirms every required document has a valid timestamp and required indexes.
6. **Legacy Admin page remains unsafe to connect:** source review previously found direct browser reads of complete Products and Users collections and a direct browser-side Product delete. Keep the old UI disconnected from privileged functionality until a replacement backed by verified endpoints is ready.
7. **No staging runtime validation:** existing preview login network failure and missing Products remain unresolved. No deployed backend, staging Firestore Rules change, or runtime integration test has been completed.

## Read-adapter allowlist

The read executor now requires a trusted `enabledOperations` allowlist and passes it to the adapter. The adapter independently rejects missing, malformed, unknown, or non-enabled operation entries before opening a Firestore query. This is a source-level fail-closed gate only: no production or staging operation is enabled by this change. Each collection still requires its own read-only staging timestamp/index audit and explicit trusted composition approval before enablement.

## Release decision

**Not ready for Admin runtime integration, staging deployment, Capacitor packaging, or Play Store submission.** Continue source-level review and tests only. Keep all changes on `security-hardening-review`.

Production branch `main`, Production Firebase project `oldx-1c983`, and `oldxbazar.in` remain out of scope and must remain untouched. No deployment, Rules publication, IAM/secret changes, billing changes, data migration, or collection scan is authorized by this review.
