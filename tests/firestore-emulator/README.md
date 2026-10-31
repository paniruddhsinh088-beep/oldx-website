# Local Firestore Emulator Harness

## Safety boundary

This harness is for local development and synthetic test data only.

- Always start the Emulator with the explicit demo project ID `demo-oldx-emulator`.
- Never use `oldx-1c983` or `oldx-staging` as the Emulator project ID.
- Do not run `firebase deploy` as part of these tests.
- Do not import a production or staging database export.
- The Emulator binds to `127.0.0.1` only; do not expose port 8080 publicly.
- Use `firebase.emulator.json` for the local test Rules. The root `firebase.json` remains deployment-free.

## Current state

The emulator-specific config loads `tests/firestore-emulator/deny-all.rules`. This is a deliberately restrictive baseline: all client reads and writes are denied. It proves the emulator can be pointed at an isolated Rules file without creating an application policy.

**This is not the OLDX application authorization policy and does not validate guest browsing, seller ownership, private user data, stores, chat participants, message transitions, or privileged fields.** Do not publish this deny-all fixture to staging or production.

The repository still needs an approved application Rules policy based on the completed schema and authorization decisions. No Rules have been published.

## Safe local command

After installing Firebase CLI:

```sh
firebase emulators:start --only firestore --project demo-oldx-emulator --config firebase.emulator.json
```

For a one-shot local test session, use `firebase emulators:exec` with the same `--project` and `--config` values. Keep the project ID exactly `demo-oldx-emulator`.

## Admin atomic audit test boundary

`admin-atomic-audit.test.mjs` exercises Firestore Emulator batch atomicity using synthetic documents. Its `withSecurityRulesDisabled` context represents a trusted server-side writer **only inside this local Emulator test**. It is not Firebase Admin SDK authentication, an HTTP endpoint, a deployed backend, or proof that the current application adapter is secure.

The tests verify that a domain mutation and audit event in one batch commit together, and that a failed batch leaves neither a partial domain mutation nor an audit record. Separate client-context checks confirm that ordinary and admin-claim-like clients remain denied by the deny-all Rules fixture. A future real adapter must still enforce server-verified identity, active owner-approved Admin role, operation allowlists, field validation, idempotency, and append-only audit policy before staging review.

## Next steps

1. Run the Emulator suite in CI and resolve any test or environment failures.
2. Complete outstanding schema and authorization decisions in `FIRESTORE_RULES_HARDENING_PLAN.md`.
3. Select and approve a staging-only backend runtime, identity, IAM, and secret-storage design before implementing a real adapter.
4. Implement the Firebase Admin/Firestore transaction adapter only after that approval; keep project ID validation fail-closed.
5. Author a separate candidate application Rules policy only after schema and authorization decisions are reviewed.
6. Test guest browsing, seller ownership and two-way sold toggle, private user data, stores, chat participants, message transitions, and privileged fields against synthetic data.
7. Require explicit owner review before any separate staging backend rollout or Rules publication.
