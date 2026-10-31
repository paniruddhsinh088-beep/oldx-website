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

## Next steps

1. Add the emulator runtime and `@firebase/rules-unit-testing` as development-only dependencies.
2. Run real authenticated and unauthenticated authorization tests against the deny-all baseline.
3. Complete outstanding schema and authorization decisions in `FIRESTORE_RULES_HARDENING_PLAN.md`.
4. Author a separate candidate application Rules policy only after those decisions are reviewed.
5. Test guest browsing, seller ownership and two-way sold toggle, private user data, stores, chat participants, message transitions, and privileged fields against synthetic data.
6. Require explicit owner review before any separate staging Rules publication.
