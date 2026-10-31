# OLDX Performance Read-Cost Audit and Baseline Plan

**Branch:** `security-hardening-review`  
**Audit date:** 2026-11-01  
**Scope:** Static inspection of the current `index.html` chat/inbox read paths. No application code, Firebase data, Rules, indexes, backend, or deployment changed.  
**Evidence level:** Source inspection only. No live Firestore read counts, browser timings, or mobile-device measurements were available.

## 1. Confirmed chat read patterns

### A. Global unread badge

The `startGlobalUnreadMessagesListener(userId)` path:

1. Subscribes to every chat document whose `participants` array contains the signed-in UID.
2. For each chat, runs a messages query filtered by `senderUid != userId`.
3. Downloads the matching message documents and counts documents whose `status` is not `read` in browser JavaScript.

The messages query has no visible `limit()`, aggregate count, or pagination in this path. As message history grows, badge refresh cost grows with received-message history across all of the user's chats. A chat document snapshot can also trigger the per-chat message reads again.

### B. Inbox open

The Inbox path first loads the user's chat documents, then uses `Promise.all` to run a descending `createdAt` messages query for every chat. The query has no visible `limit()`. It downloads each room's full message history to select the latest message and calculate unread count in the browser.

This duplicates work already performed by the global unread badge path. The number of parallel message queries grows with the user's chat count; the number of documents read grows with message history, not just the number of conversations displayed.

### C. Chat open / read receipts

The `loadChatMessages(chatRoomId)` path queries all messages where `senderUid != currentUid`, with no visible limit, then calls `update({status:'read'})` separately for each returned message.

The visible realtime message listener is limited to the latest 35 messages, but the separate read-receipt query is not visibly bounded to those 35. Opening a long-running conversation can therefore read and write many historical message documents even though only 35 are rendered by that listener.

## 2. Cost and user-experience risks

- **Unbounded read amplification:** inbox and badge work can repeatedly download old messages that are not needed to render the latest preview or unread badge.
- **Write amplification:** opening a chat can issue one read-status update per received message.
- **Parallel burst:** opening Inbox starts one full message query per conversation in parallel.
- **Duplicate work:** the global badge and Inbox independently calculate unread counts from message history.
- **Slow-network impact:** the UI may wait for many message queries before sorting and rendering the Inbox.
- **Growth sensitivity:** these costs become worse as a user accumulates conversations and message history.

These are code-path risks, not measured production costs. Actual billing impact depends on real chat volume, listener lifetimes, caching, and query execution.

## 3. Safe target design to evaluate (not implemented)

Do not simply add a small limit to the existing unread query: that would silently undercount unread messages in older history.

A candidate design is a trusted, per-participant chat summary containing only the minimum UI data, such as:

- last-message preview and timestamp;
- unread count or a read cursor for each participant;
- a server-maintained summary version / update timestamp.

The summary must be updated by a trusted backend after validating the authenticated sender, chat membership, message creation, and read action. Client-supplied unread counts, sender identity, timestamps, or summary fields must not be trusted. Do not expose private message content in global/public summaries.

A read action should ideally advance a participant-specific read cursor or use another bounded, idempotent server-side operation rather than updating every historical message. Before choosing this approach, verify whether existing UI, push notifications, message status indicators, Delete for Me, Delete for Everyone, and chat history depend on per-message `status` fields.

## 4. Required compatibility and security tests

Before any implementation, test:

1. A user with zero, one, and many chat rooms.
2. A room with more than 35 messages and unread messages both inside and older than the visible 35-message window.
3. Both participants opening the same chat concurrently.
4. New messages arriving while Inbox is open.
5. Reconnect after offline periods and duplicate/retried send or read requests.
6. Read cursor/count correctness after Delete for Me and Delete for Everyone.
7. Block and unblock behavior without removing existing shared history.
8. Outsiders cannot read chat summaries, messages, or participant-private fields.
9. Direct client writes cannot forge unread counts, last-message metadata, sender identity, or read cursors.
10. Existing push notification and inbox ordering behavior remains correct.

## 5. Baseline measurement protocol

Record a baseline before code changes, using a test account and synthetic/test conversations only:

- Browser/device: Android Chrome plus desktop Chrome.
- Network: normal connection and throttled slow mobile profile.
- Journeys: initial page load, open Inbox, open a chat with 35 messages, open a chat with 500+ messages, send a message, return to Inbox.
- Browser metrics: LCP, INP, CLS, first useful content, Inbox render time, chat-open time, JavaScript errors.
- Firestore metrics: document reads and writes per journey, listener count, query count, and bytes transferred where available.
- Repeat each journey several times and report median plus worst observed run; separate warm-cache and cold-cache runs.
- Use synthetic data only. Do not export or disclose real users' private messages for performance analysis.

No numeric performance budget should be claimed until this baseline exists.

## 6. Delivery boundary

- This audit is documentation only.
- Do not deploy backend functions, change Firestore Rules, alter chat schema, or migrate real chat data as part of this audit.
- A trusted unread/read summary is a backend/schema change and requires a reviewed design, Emulator tests, Staging validation, and explicit owner approval.
- Production rollout requires separate explicit approval.
