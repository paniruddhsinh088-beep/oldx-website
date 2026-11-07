# Inactive public Provider query plan — 2 November 2026

## Scope and result

Added `features/service-providers/public-query-plan.mjs` and focused regression tests.
This is a **default-disabled logical plan**, not an active endpoint, Firestore query,
security rule, database schema, signed cursor implementation or browser integration.
The existing Store, Service, Chat, Admin and live website remain unchanged.

The planner accepts only explicit service/city index keys, an availability flag,
a bounded page limit (1–24), and an optional opaque cursor. It rejects global
unscoped queries, free-text scans, unknown/private fields, malformed values and
accessor-based request objects. Gujarati/Hindi/English index keys are NFC-normalized
without changing user-authored display text. It always marks results public-only
and published-only and returns an explicit allowlist of provider public-profile
fields, excluding phone, WhatsApp, email, exact location, owner UID and admin data.

Cursor continuation is unavailable without an **injected server-owned verifier**
that authenticates token expiry and binds it to the exact filter scope. A matching
scope object from an untrusted client is not proof. The verifier is deliberately
not implemented here: token signing keys, server identity and retention policies
have not been approved. The planner itself does not read any documents.

## Required trusted integration and approval gates

1. Approve the public provider collection, its publication/revocation contract,
   canonical `serviceKey` and `cityKey` indexing, public field schema and index
   definitions (D9); validate actual query cost and indexes before deployment.
2. Implement server-owned query execution and public/private document separation.
   The logical `provider-id-ascending` order must be mapped to an approved,
   stable indexed document key with server-bound pagination. Never query legacy
   private provider/user records in a browser and filter them afterwards.
3. Use a server-owned, authenticated, expiring cursor with exact filter scope,
   publication freshness and rollback/revocation behavior. The callback in this
   model is a test seam, **not** a security implementation.
4. Recheck all returned records against publication and the existing
   `buildPublicProviderProfile` allowlist before responding; enforce a hard
   server-side page bound and no private contact disclosure without consent.
5. Run real adapter and isolated Rules Emulator tests for cross-account access,
   private field leakage, cursor tampering, publication withdrawal, race/freshness,
   bounded reads and compatibility. Obtain runtime/region/budget/identity/secret/
   privacy/rollback/release decisions (D1–D12) before any activation.

## Evidence and limitations

Targeted local Node 22.16.0 commands executed:

- `node --check features/service-providers/public-query-plan.mjs` — passed.
- `node --check features/service-providers/public-query-plan.test.mjs` — passed.
- `node --test features/service-providers/public-query-plan.test.mjs` — **5/5 passed**.

The repository declares Node >=24.12.0; that version was not available locally.
Full repository tests, Firebase Rules Emulator and browser/device tests were **not
run** in this isolated network-restricted workspace. GitHub CI results must be
verified independently; do not infer them from local tests.

The branch is based on the observed `security-hardening-review` commit
`52756a5dc0c761737f4ada47e1993ba7e3869563` and is intentionally separate
from concurrent Codex work. No main, merge, deployment, Firebase, credentials,
billing or resource changes were made. Release remains **HOLD / NO-GO**.

Next safe work: review the public index keys/schema against owner decisions,
then connect this planner only to an approved **mock** repository contract and
test strict publication/field projection; never activate live reads implicitly.
