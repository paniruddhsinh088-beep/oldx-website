# Legacy blockedUsers compatibility and migration gate

Status: development design only; no migration executed.

OLDX currently reads blockedUsers from users/{uid} in the browser contact adapter. The proposed serviceChatBlocks/{blockerUid}/blocked/{blockedUid} edge collection is not populated. Never interpret a missing edge as proof that the users are not blocked while legacy lists remain authoritative.

## Safe transition

1. Audit the deployed users collection security rules, document shape and every existing block/unblock handler in index.html.
2. Decide which representation is authoritative. During transition, chat creation must be denied if either representation indicates a block or if the authoritative check cannot be performed.
3. Reconcile legacy block lists into edges using a trusted, idempotent process; never grant clients permission to write another user's edges.
4. Verify per-user edge counts, both block directions, and spot-check missing users and malformed lists. Log counts without exposing personal block lists.
5. Ensure block/unblock actions update the authoritative representation atomically or fail closed; design retry and rollback behavior.
6. Emulator-test stale edges, missing edges, concurrent block/unblock, and unauthorized forged edge writes.
7. Only after reconciliation and a complete legacy /chats rules audit may a separately reviewed service room create rule be enabled.

Until then, service chat create, message writes and typing writes remain disabled. Do not deploy draft fragments directly.
