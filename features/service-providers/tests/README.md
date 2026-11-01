# Service Providers: Firestore emulator test runbook

These tests target the **isolated draft** `../firestore.rules.draft`, not the production OLDX rules.

## Prerequisites
- Node.js 20 or later, npm, Java 11 or later
- Firebase CLI (run via `npx firebase-tools` or install separately)
- Firebase Firestore emulator available to download
- Run from the repository checkout

## Run
```sh
cd features/service-providers/tests
npm install
npx firebase-tools emulators:exec --only firestore --project demo-oldx-service "npm test" --config ../../../firebase.json
```

If your CLI version does not resolve the relative config path, run from repository root instead:
```sh
npm --prefix features/service-providers/tests install
npx firebase-tools emulators:exec --only firestore --project demo-oldx-service --config firebase.json "npm --prefix features/service-providers/tests test"
```

The test harness loads the draft rules itself and checks owner, guest, public listing, self-approval, and review restrictions. The `demo-` project ID is for local testing only; do not point this at a live Firebase project.

## Release blockers
1. Capture the actual test output and repair any failures.
2. Review the current deployed Firestore rules in Firebase Console; the repository's `firebase.json` currently contains emulator configuration, not a production rules path.
3. Merge only the `serviceProviders` match block into the *complete* existing rules; do not deploy the standalone draft, because its catch-all denies other OLDX collections.
4. Test the merged rules against existing products, stores, users, and chats.
5. Review public profile fields and moderation/admin approval workflow before any staging deployment.
6. Wire the form and adapter only after rules have been deployed and validated.

## Current status
Tests committed but **not executed** in this environment. Do not mark them passing without emulator output.
