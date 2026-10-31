# Owner-confirmed chat privacy decisions

Status: design decisions only; not deployed.
Date: 2026-10-31

1. Presence privacy: Online Status and Last Seen are readable only by participants in the relevant chat. Non-participants must not access these fields through public profiles or direct database reads.
2. Delete for Everyone: only the original sender may delete a message for everyone, and only within 15 minutes of sending. After 15 minutes, Delete for Everyone is unavailable. Delete for Me remains a separate per-user hide action.
3. Blocking: one-way block. A user may block another user; the blocked user cannot send new messages to the blocker. Do not expose private block lists. Enforce this at the trusted authorization/database boundary, not only in the UI.
4. Existing chat visibility after blocking: the blocked user and blocker may continue to view their existing conversation and its historical messages, subject to normal participant authorization and message deletion/hide rules. Blocking prevents new messages from the blocked user to the blocker; it does not erase chat history or remove either participant from the existing conversation.

Implementation guardrails:
- These are approved requirements for the Staging design and test plan only.
- Do not publish Firestore Rules or change Production.
- Before implementation, reconcile all existing chat write paths and implement an authoritative, rules-verifiable block check (or trusted send-message endpoint).
- Add Emulator tests for participant-only presence reads, sender-only 15-minute delete-for-everyone, Delete for Me isolation, blocked-user send denial, and continued historical chat read access after blocking.
- Preserve Inbox, unread count/order, typing indicators, read status, and existing chat behavior.
