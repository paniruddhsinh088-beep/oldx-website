# OLDX Firestore Access Inventory (Review Draft)

**Scope:** `security-hardening-review` only  
**Purpose:** Record Firestore access observed in the browser application before designing any application rules. This is an inventory, not an authorization policy.

## Safety boundary

- Do not merge this review branch into `main` or deploy Firebase Rules to Production.
- Production Firebase project `oldx-1c983` and the live site are out of scope.
- Staging Firebase project is `oldx-staging`.
- Keep the current staging Firestore deny-all policy until the access model is reviewed and tested with synthetic data.
- The emulator's `tests/firestore-emulator/deny-all.rules` is a deny-all baseline fixture; it is not the application's final rules.
- Do not copy production user records, admin UIDs, credentials, or secrets into Staging.

## Collections observed in `index.html` and `admin.html`

| Collection / path | Observed client operations | Required policy questions |
|---|---|---|
| `products/{productId}` | Public listing listener and reads; seller create; product updates/deletes; seller-filtered queries; store catalogue queries | Which fields are public? Is seller UID immutable and bound to `request.auth.uid`? Which updates are seller-only? How are moderation, featured status, and admin deletion protected? |
| `users/{uid}` | Profile reads/writes; saved-ad and blocked-user updates; presence/last-seen listener and updates | Restrict private profile fields to the owner. Define a narrow chat-participant read for online status/last-seen. Prevent users from changing roles or privileged fields. |
| `chats/{chatId}` | Chat room creation/merge, participant queries, room listeners and metadata updates | Only listed participants may access a room. Participant list and product association must not be arbitrarily changed by clients. |
| `chats/{chatId}/messages/{messageId}` | Message creation, message listing/listeners, read-status updates, per-user hide and delete-for-everyone updates | Sender must equal the authenticated UID on create. Only participants may read. Restrict status and deletion fields to the correct participant/action; prevent arbitrary message rewriting. |
| `stores/{uid}` | Public store reads, owner store reads/writes, homepage query by update time | Public read fields should be deliberately limited. Writes must require `request.auth.uid == uid`; validate allowed fields and types. |
| `stats/traffic` | Client read, update, and initial set for traffic counter | A client-writable global counter can be abused. Consider moving increments to a trusted backend or designing a tightly constrained operation. |

## Admin dashboard finding

`admin.html` checks a hard-coded admin UID in browser JavaScript, then directly reads all `products` and all `users`, and deletes product documents from the client.

That browser-side check is not an authorization boundary: client code can be modified or bypassed. Any admin data access or destructive action must be enforced by Firestore Rules and/or a trusted server-side admin backend. For Staging, keep Admin access disabled until server-side authorization and role checks are implemented. Do not copy the Production admin UID into Staging.

## Presence and chat privacy decision

The accepted product behavior is that online status and last-seen are visible only to chat participants. The final rules must implement that narrow access rather than making all user documents readable to every signed-in user.

## Storage note

The candidate Storage policy and its emulator tests are separate from Firestore. They are test-only and must not be deployed to a live bucket as part of this review. Storage deployment remains out of scope while the required plan/enablement is unavailable.

## Verification status

- GitHub Actions review safety workflow on the current review-branch head passed, including Firebase config safety, local safety tests, Admin backend starter tests, Firestore Emulator authorization tests, and Storage Emulator authorization tests.
- Those emulator tests do not prove the deployed Staging application's full user flows or authorize publishing rules.
- Vercel Preview deployment for the review branch is READY. The branch-scoped Preview environment variables include `OLDX_FIREBASE_ENV=staging` and `OLDX_FIREBASE_PROJECT_ID=oldx-staging`.
- The live Preview UI and Google sign-in still require an interactive browser check. Do not treat a READY build as proof that sign-in or data flows work.

## Next steps (in order)

1. Review and validate this source-derived collection/operation inventory.
2. Define per-collection field-level authorization and immutable fields.
3. Build synthetic-data Firestore Emulator tests for owner, other-user, chat participant, non-participant, and staging-admin-disabled cases.
4. Only after those tests pass, prepare a Staging-only rules candidate for review. Do not publish it automatically.
5. Separately verify Google sign-in and Products loading in the Staging Preview using a synthetic test account.
