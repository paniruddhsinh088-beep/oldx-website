# OLDX Admin Backend Threat Model — v1

**Branch:** `security-hardening-review`  
**Status:** Design review only; no backend is deployed.

| Threat | Required control | Test evidence |
|---|---|---|
| Forged `isAdmin` or role in browser request | Ignore client role fields; resolve server-side role | Forged-role requests return 403 |
| Stolen/expired Firebase ID token | Verify signature, issuer, audience and expiry; support revocation check for privileged operations | Invalid/expired/revoked token returns 401 |
| Admin revoked while session remains open | Resolve active role on every request or use short-lived claims with revocation strategy | Revoked identity loses access |
| Cross-project or Production targeting | Startup project allowlist; staging-only project ID; no fallback | Startup rejects Production project |
| Unbounded user/product enumeration | Server pagination, bounded filters, rate limits | Oversized page size rejected/clamped; cursor tests |
| Sensitive user data exposure | Response field allowlists; no-store; audited sensitive reads | Snapshot/response schema tests |
| Privileged mutation without accountability | Atomic mutation plus append-only audit event; reason and request ID | Audit failure prevents mutation |
| Admin account compromise | Owner-controlled role grant/revoke; MFA policy at identity provider; alert on sensitive actions | Role lifecycle and alert tests |
| Chat content misuse | Case-linked access only; no general chat dump | Missing/closed case denied |
| Replay/duplicate request | Idempotency keys and transaction/state checks | Duplicate requests produce one effect |
| Secret leakage | Managed secrets/service identity; redact logs; scan build artifacts | Secret scan and bundle inspection |
| Abuse/DoS of Admin API | Rate limits, bounded payloads, timeouts and pagination | Rate-limit and payload-bound tests |
| Permanent deletion too early | Reversible quarantine first; legal hold/retention/recovery gates | Permanent delete fails closed |

## Security invariants

- Admin authority is broad for approved platform operations, not access to passwords, tokens, service credentials or infrastructure secrets.
- Only owner-controlled processes grant/revoke Admin identities.
- Audit records are append-only and cannot be edited/deleted by Admin clients.
- Seller ownership and seller `isSold` toggle remain unchanged.
- All tests use synthetic data and a test project.
- No Production deployment or Rules publication is implied by passing tests.
