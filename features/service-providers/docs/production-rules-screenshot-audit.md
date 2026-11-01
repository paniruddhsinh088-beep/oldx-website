# Production Firestore rules screenshot audit (2026-11-01)

Source: user-provided Firebase Console screenshot, visible lines 1–65. User subsequently confirmed the screenshot is from the LIVE production Firebase project. This is a visual transcription of a screenshot, NOT a machine-verified exported/deployed ruleset. Do not deploy any draft from this file.

## High-confidence findings

- Lines 54–61: `match /chats/{chatId}` allows read/update when signed in and (resource == null OR auth.uid in resource.data.participants); allows create for ANY signed-in user without validating participants, type, or owner; nested `match /messages/{msgId}` allows read and write to ANY signed-in user. Thus any authenticated user can access or modify other users' chat messages by known path, even when room reads are restricted.
- Lines 49–52: `match /stats/{docId}` permits public unauthenticated read/write. Abuse/spam and data integrity risk.
- Lines 11–15: `match /users/{userId}` permits unrestricted field changes by the owning signed-in user. Client-controlled roles must not be trusted, and public user reads may expose personal data.
- Lines 5–9: `match /admins/{userId}` permits reads by authenticated users, writes denied. Product delete admin check uses document existence; verify how admin records are provisioned and who can read them.
- Lines 24–46: product seller ownership checks exist; evaluate validation and other product fields separately.
- Lines 17–22: store ownership check exists; validate schema and create semantics separately.
- No service-chat-specific rule appears in the visible screenshot. This does not prove there are no additional deployed rules elsewhere or that the full active production ruleset is limited to these visible lines.

## Required before rollout

1. Export or copy full current deployed Firestore rules as text and identify Firebase project ID (production versus staging). Do not paste API keys or secrets.
2. Build and emulator-test a combined candidate ruleset preserving legitimate product chat, with message read/write restricted to participants and sender UID immutable, plus service-specific guards.
3. Audit and migrate legacy chat records and blocks. Avoid relying on client-side block checks for authorization.
4. Restrict public stats writes (server-only or tightly validated, rate-limited server endpoint), and protect sensitive user fields.
5. Require verified source, emulator tests, migration parity and explicit deployment approval. No live changes authorized by this audit.
