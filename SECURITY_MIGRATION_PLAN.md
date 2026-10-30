# OLDX Firestore Security Migration Plan

Branch: `security-hardening-review`

Status: **Planning / not deployed**. This document does not change Firebase production configuration.

## Why an immediate Rules replacement is unsafe

The current client code still reads and writes the legacy `/users/{uid}` document for several different purposes:
- Public profile and online presence for other users.
- Private email, last IP, saved ads, and blocked-user data.
- Own-account profile and presence updates.
- Admin dashboard user listing.

Firestore Rules cannot hide selected fields in a document. Changing `/users` to owner-only reads before the client migration would break public profile/online-status lookups and may affect the admin dashboard and saved ads.

The visitor counter currently writes directly to `/stats/traffic` from the browser. Closing public writes before moving this operation to a trusted backend will break the counter. Leaving public writes enabled permits tampering.

Chat messages currently use broad authenticated-user rules. Tightening them must preserve participant reads, message creation, read receipts, typing indicators, hide-for-me, and delete-for-everyone behavior.

## Target document layout

### `/publicProfiles/{uid}`
Only fields needed by other marketplace users:
- `displayName`
- `photoURL`
- `isOnline`
- `lastSeen`

Public reads may be retained for marketplace profile/presence functionality. Writes must be restricted to the matching UID and validated fields/types.

### `/privateUsers/{uid}`
Private account data:
- `email`
- `lastIp`
- `savedAds`
- `blockedUsers`

Reads/writes should be limited to the matching UID, with a separately verified admin read path only where the admin dashboard genuinely requires it. Do not make this collection publicly readable.

### Legacy `/users/{uid}`
Keep the current collection and current rules during a compatibility migration. Do not delete or restrict legacy documents until all deployed clients have moved and the new paths have been verified.

## Required migration sequence

1. Add dual-write helpers for profile/presence and private account data while preserving existing `/users` writes temporarily.
2. Backfill existing users into `publicProfiles` and `privateUsers` using a trusted Admin SDK script or Cloud Function. Never run a privileged backfill from an ordinary browser client.
3. Switch public profile and online-status reads to `publicProfiles`.
4. Switch saved ads, blocked users, email/IP reads, and account cleanup to `privateUsers`.
5. Verify signup, login, logout, online/offline transitions, profile edits, saved ads, blocking, chat, and admin dashboard against the migrated schema.
6. Move visitor counting to a trusted backend endpoint/Cloud Function with abuse controls; only then remove client write access to `/stats`.
7. Tighten chat rules after confirming the exact update shapes for typing, read receipts, hide-for-me, and delete-for-everyone.
8. Only after all checks pass, deploy revised Firestore Rules with the owner's explicit approval, then remove legacy fields/documents in a separately approved cleanup.

## Chat Rules requirements (not yet deployable)

- A user may read a chat only if their UID is in its `participants` array.
- Chat creation must require authentication, exactly the intended participant structure, and the caller's UID among participants.
- Participant and product identity must not be changed by arbitrary chat updates.
- A message create must require `senderUid == request.auth.uid` and membership in the parent chat.
- Message updates must be field-limited and operation-specific:
  - recipient read receipt/status updates;
  - participant hide-for-me updates;
  - sender-only delete-for-everyone updates.
- Typing updates must be limited to the caller's own `typing_<uid>` field.
- Validate field types, sizes, and allowed keys. Confirm the actual client payloads before finalizing these expressions.

## Additional issues to resolve

- The client has an email-based admin UI bypass in `index.html`. Admin UI visibility and navigation should use the same UID/admin-document check as the admin page. Firestore Rules remain the actual authorization boundary.
- Product rules should validate allowed fields and types on create/update, not just `sellerUid`. Preserve seller ownership and current image-preservation behavior. Admin product deletion should use a trusted admin claim/document check; admin editing remains disallowed unless explicitly required.
- Store writes should validate owner identity and permitted fields.
- Admin document reads should be scoped to the caller's own admin document for the client-side admin check; admin dashboard access to user records should use a separately restricted path.

## Acceptance checklist before any production Rules deployment

- [ ] New and existing users have both target documents.
- [ ] Public profile and online status work for signed-out and signed-in visitors as intended.
- [ ] Private fields are unreadable by other users.
- [ ] Saved Ads sync works across reload/login.
- [ ] Blocking prevents the intended chat interactions.
- [ ] Chat create/read/send/typing/read-receipt/hide/delete flows work for both participants.
- [ ] Admin dashboard works for the authorized UID only.
- [ ] Product create/edit/delete and existing image preservation work.
- [ ] Visitor counter works through the trusted backend and cannot be directly modified by clients.
- [ ] Firestore Rules Emulator tests cover allowed and denied cases.
- [ ] No live Rules deployment occurs without explicit owner approval.

**Important:** This is a migration plan, not a production-ready Rules file. The current client still depends on the legacy schema, so replacing the active Rules now would risk breaking OLDX.
