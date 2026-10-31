# Local Firestore Emulator Harness

## Safety boundary

This harness is for local development and synthetic test data only.

- Always start the Emulator with the explicit demo project ID `demo-oldx-emulator`.
- Never use `oldx-1c983` or `oldx-staging` as the Emulator project ID.
- Do not run `firebase deploy` as part of these tests.
- Do not import a production or staging database export.
- The Emulator binds to `127.0.0.1` only; do not expose port 8080 publicly.

## Current state

The repository does not yet contain an approved `firestore.rules` file or a complete package/test setup. The root `firebase.json` intentionally configures only the local Firestore Emulator. It does not define deployed Rules, hosting, functions, or project aliases.

This is infrastructure scaffolding, not a passing security test. No application Rules are loaded and no app access policy is validated yet.

## Next implementation steps

1. Install Firebase CLI and Node.js locally.
2. Start only the local Firestore Emulator with project ID `demo-oldx-emulator`.
3. Add the test runner and `@firebase/rules-unit-testing` as development-only dependencies once the repository's build/test tooling is agreed.
4. Author candidate Rules only after completing the outstanding schema and authorization decisions in `FIRESTORE_RULES_HARDENING_PLAN.md`.
5. Load candidate Rules directly into the Emulator test environment; never publish them from this workflow.
6. Add synthetic tests for guest browsing, seller ownership and sold toggle, private user data, stores, chat participants, message transitions, and privileged fields.
7. Require an explicit owner review before any separate staging Rules publication.

## Safe local command (after Firebase CLI installation)

```sh
firebase emulators:start --only firestore --project demo-oldx-emulator
```

Do not replace the demo project ID with either live project ID. This command starts the local emulator only; it does not deploy anything.
