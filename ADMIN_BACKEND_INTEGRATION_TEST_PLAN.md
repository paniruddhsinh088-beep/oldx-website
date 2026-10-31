# OLDX Admin Backend Integration Test Plan

**Branch:** `security-hardening-review`  
**Status:** Test specification only. No backend runtime, endpoint, role grant, Rules, or deployment is created here.

## 1. Test boundary

All tests use synthetic identities and a local isolated Emulator or a separately approved staging-only backend. Test fixtures must never include real user records. The Admin test identity must be synthetic until the owner-approved identity is provisioned through a separately approved server-side process.

## 2. Identity fixtures

| Fixture | Expected role/state |
|---|---|
| guest | no Firebase ID token |
| userA | authenticated ordinary user |
| userB | authenticated ordinary user |
| adminActive | active Admin resolved by server-side role registry |
| adminRevoked | formerly Admin, now revoked/inactive |
| malformedToken | invalid token |
| expiredToken | expired token |
| forgedClientAdmin | ordinary user sending `role=admin`, `isAdmin=true`, or another UID in request body |

## 3. Authentication and role tests

- Missing, malformed, expired, revoked or invalid-signature token returns 401.
- Valid ordinary-user token returns 403 on every Admin endpoint.
- Active server-resolved Admin is allowed only the operation allowlist.
- Revoked/suspended Admin is denied after role revocation takes effect.
- Body/query `uid`, `actorUid`, `role`, `isAdmin`, or permissions never elevate privileges.
- Hard-coded Admin UID in browser HTML never authorizes an API call.
- Role registry and custom-claim update paths are not exposed to Admin clients.

## 4. Read API tests

- Dashboard returns bounded aggregate values and no raw stats document.
- Products/users lists enforce pageSize 1–50 even when caller requests 0, negative, 51, or huge values.
- Cursor is opaque, validated, bound to the query, and cannot be used to select arbitrary collection paths.
- User response contains only approved fields; private email/IP fields are absent unless a separate owner-approved purpose/permission exists.
- Product response contains fields required for Admin moderation and no unrelated private seller data.
- Search length is bounded; unsupported substring behavior is not silently claimed.
- Sensitive responses use `Cache-Control: no-store`.
- Repeated requests are rate-limited safely.

## 5. Mutation tests

- Product create/update rejects unknown fields and client-set privileged flags.
- Feature/verify actions require the active Admin role and produce audit events.
- Quarantine/restore require a valid reason code and bounded reason; state changes and audit event are atomic.
- User suspend/restore requires reason and records an audit event; normal users cannot perform either action.
- Store review/verify/suspend/restore validates current state and writes audit event.
- Report resolution requires a valid case/action and records actor and timestamp.
- Account deletion endpoint only creates an idempotent request/task; it does not synchronously erase records.
- Permanent deletion fails closed while legal hold, retention, evidence, or recovery checks are unresolved.
- Admin cannot alter audit records or role registry.
- Admin UI displays success only after server confirms commit; failures preserve previous UI state.

## 6. Sensitive chat access

- Admin cannot list or browse all chats by default.
- Case-linked safety access requires case ID, reason and explicit safety permission.
- Access to chat content creates an audit event.
- Expired/closed case access is denied unless a new authorization is granted.
- Ordinary user chat participant permissions remain independent and unchanged.

## 7. Seller and user regression protection

- Seller A can still update only approved own product fields.
- Seller A can toggle own `isSold` true and false.
- Seller B cannot update Seller A's product.
- Seller cannot set `isFeatured`, `isShopVerified`, moderation or audit fields.
- User A cannot read User B's private profile.
- User A can read/update only their own approved private preferences.
- Public profile reads expose only approved public fields.
- Guest and ordinary user cannot access Admin endpoints.

## 8. Operational and failure tests

- Backend startup fails closed if configured for Production project ID.
- Every test request is bound to an explicit staging/test project; no fallback to production.
- Emulator host must be loopback for local tests.
- Firestore transaction conflict, timeout, duplicate request and retry do not create duplicate moderation or deletion tasks.
- Audit event write failure causes sensitive mutation to fail safely rather than silently proceeding without audit.
- Error responses contain no stack trace, secret, raw database path or private document content.
- Request IDs are server-generated and traceable across logs.

## 9. Exit criteria

A backend implementation is ready for staging review only when all relevant positive and negative tests pass, Admin UI flows use the trusted API rather than direct broad Firestore reads, no secrets enter browser bundles, and staging-only isolation is demonstrated. Passing this plan does not authorize a deployment or Rules publication; those require separate explicit owner approval.
