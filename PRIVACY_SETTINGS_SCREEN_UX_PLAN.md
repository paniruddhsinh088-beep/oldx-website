# OLDX Privacy Settings — Screen-by-Screen UX Plan

**Status:** UX proposal only; not implemented  
**Branch:** `security-hardening-review`  
**Related policy:** `USER_PRIVACY_CONTROLS_AND_DATA_RETENTION_POLICY.md`  
**Related security boundary:** Staging Firestore remains deny-all until approved backend, collection rules, and emulator coverage are ready.

## 1. UX goals

- Make privacy controls easy to find on mobile, including low-end Android devices.
- Use plain Gujarati-first wording with short explanations and clear defaults.
- Separate visibility consent from profile data entry.
- Never imply a setting is active unless the server has confirmed it.
- Keep privacy controls usable on slow networks; show saved, pending, and failed states.
- Do not collect new personal data just to display the settings screen.

## 2. Entry point and navigation

**Proposed path:** Profile / Account → Privacy & Security.

Add a visible “Privacy & Security” row in the signed-in account area. Keep it out of the primary marketplace navigation so browsing stays uncluttered, but do not bury it behind an admin or advanced-only menu.

If the user is signed out, show a short explanation and require sign-in before loading account-specific controls. Do not display another account's cached settings.

## 3. Screen A — Privacy overview

**Purpose:** Explain the user's current privacy posture at a glance.

Suggested sections:
- Contact details — “Only you can see these unless you choose to share them.”
- Location — “Your exact location is private by default.”
- Online status — “Choose whether others can see when you are active.”
- Saved ads and activity — “Manage what is saved to your account or this device.”
- Data requests — “Request a copy of your data or ask to close your account.”

UX requirements:
- Show a small status label such as “Private by default”, “Shared for this listing”, or “Not available yet”.
- Status must come from trusted persisted state; do not infer it from a local toggle.
- Provide a short “Learn how this works” explanation for each category.
- Avoid alarming red warnings for normal private defaults.

## 4. Screen B — Contact sharing

Controls:
- Phone number visibility: Private / Share on selected listing or store.
- WhatsApp visibility: Private / Share on selected listing or store.
- A separate consent confirmation when the user enables sharing.

Consent copy must identify:
1. The exact field being shared.
2. The target listing/store or audience.
3. What other users can do with the information.
4. How to revoke sharing.

Rules:
- Private is the default.
- Entering or saving a phone number does not grant public-sharing consent.
- Consent is granular; phone consent does not imply WhatsApp consent.
- Revocation prevents future disclosure after server confirmation.
- Clearly explain that information already copied or seen by another person cannot be recalled.

Do not add a single broad “share all my details” switch.

## 5. Screen C — Location privacy

Controls:
- Location permission: Not requested / Granted at device level / Denied at device level (where browser APIs expose this state).
- Public location display: Approximate area / Hidden.
- Exact coordinates: Private by default; only share for a clearly stated feature that needs them.

UX requirements:
- Explain why location is requested before triggering the browser permission prompt.
- Offer manual area selection so users can use marketplace discovery without granting precise device location.
- Never treat device permission as permission to publish coordinates.
- Do not retain precise coordinates from a one-time search unless the user explicitly saves them for a stated purpose.
- Do not promise that hiding location removes information already visible in old screenshots or messages.

## 6. Screen D — Activity and presence

Controls:
- Online status: Show / Hide.
- Last seen: Show approximate status / Hide.
- Read receipts: On / Off, only if the backend can enforce consistent semantics for both participants.

Defaults:
- Presence sharing off or minimal until owner approves the product default.
- No detailed activity timeline in the user-facing UI.
- Explain that hiding presence does not necessarily hide delivery/read state if those are separate features.

Do not add a toggle until trusted server-side enforcement and cross-user tests exist.

## 7. Screen E — Saved ads and device data

Actions:
- View and remove saved ads.
- Clear recently viewed items.
- Explain account-synced vs device-only storage.
- On logout or account switch, clear account-specific cached content from the device.

Safety:
- Do not store authentication tokens or private message content in local storage.
- Avoid silently clearing user data without a clear confirmation.
- If a setting cannot be synchronised, say so and do not display a false “saved” state.

## 8. Screen F — Blocked users and reports

Blocked users:
- List blocked accounts with a simple unblock action.
- Explain that blocking should prevent future contact and be enforced by trusted backend policy.
- Do not reveal private information about the blocked user.

Reports:
- Provide a separate report flow from blocking.
- Show what content/evidence will be submitted before confirmation.
- Collect only the minimum details needed for review.
- Show a report reference/status without exposing internal moderation notes.

These controls must not be implemented as client-side hiding alone.

## 9. Screen G — Notifications

Controls:
- Push notifications: Enable / Disable, with system permission status explained.
- Message preview: Full preview / Generic preview, with generic preview as the privacy-preserving default proposal.
- Explain how to revoke notification permission in device/browser settings.

Do not prompt for push permission at first page load. Ask only after a user action demonstrates a relevant need.

## 10. Screen H — Your data

Actions:
- Request a copy of account data.
- Request account correction where a field cannot be edited directly.
- Start account deletion request.
- View request status and any required next step.

Deletion states:
- Request received.
- Processing.
- Waiting for review / blocked.
- Completed.
- Failed and safely retryable.

The UI must not say “Your account and all data have been deleted” until the trusted workflow verifies all required data classes and external media references. If some records must be retained, explain the category and reason in reviewed, user-safe language.

## 11. Shared interaction and accessibility rules

- Use short labels, one-line helper text, and a clear “Save” action only when needed.
- Prefer immediate save only for low-risk preferences, with an explicit saved confirmation from the server.
- For consent, deletion, unblock, and other consequential actions, use a clear confirmation step.
- Keep touch targets comfortably large and avoid dense tables or multi-step forms on mobile.
- Provide keyboard focus, accessible labels, sufficient contrast, and screen-reader status announcements.
- Show loading and retry states; do not silently fail.
- Preserve the user's last safe setting if a network request fails.
- Do not show a toggle as enabled while a save is pending or rejected.

## 12. Data and API contract prerequisites

Before UI implementation, each control needs:
- A documented owner and data field.
- A trusted API operation and authenticated UID binding.
- Server-side validation and authorisation.
- Explicit consent record where sharing is involved (who, what, scope, timestamp, policy version, revoked timestamp).
- A versioned response so the UI can distinguish unsupported, pending, and saved states.
- Audit events for sensitive consent changes and admin access.
- Tests for cross-user access denial, revoked consent, stale sessions, account switching, and weak-network retries.

No UI toggle should write directly to Firestore as an authorisation shortcut.

## 13. Release sequencing

**Phase 0 — Design (current):** UX plan, field matrix, copy review, data ownership, and approval register.

**Phase 1 — Read-only shell:** Build static screens with no sensitive reads/writes; use clearly labelled demo data only in local preview.

**Phase 2 — Trusted preferences:** Implement only low-risk account preferences after backend contract and emulator tests are approved.

**Phase 3 — Consent controls:** Enable contact/location sharing only after per-field consent storage, server enforcement, revocation tests, and privacy notice review.

**Phase 4 — Data requests:** Enable export and deletion status only after resumable backend workflows and external media reconciliation are verified.

**Phase 5 — Rollout:** Staging-only validation, owner acceptance, limited rollout, monitoring, and rollback readiness before any production release.

## 14. Explicit non-goals

This plan does not:
- edit the live site or existing account UI;
- enable a Firestore collection or relax deny-all Staging rules;
- create API endpoints, database fields, or consent records;
- change notification, IP, location, analytics, or storage behaviour;
- create provider accounts, IAM identities, secrets, buckets, or billing;
- migrate or delete user data;
- authorise Production or Play Store release.

## 15. Owner approvals still needed

- Final defaults for presence and read receipts.
- Which listing/store surfaces may expose phone or WhatsApp.
- Whether approximate location is shown publicly and at what granularity.
- Notification preview default.
- Final wording and language support (Gujarati, Hindi, English).
- Data export scope and deletion exceptions.
- Legal review of privacy notice, retention periods, and processor disclosures.

Until the relevant approval and backend/security gates are complete, these screens remain a proposal and existing secure Staging rules remain unchanged.
