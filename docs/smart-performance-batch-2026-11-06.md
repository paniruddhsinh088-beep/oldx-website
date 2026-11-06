# OLDX smart performance batch — 6 November 2026

Status: HOLD/NO-GO. Repository-only; no runtime gates activated or cloud resources accessed.
Started at feecd3b99b0e71296384b96a7204c3dc9a5287af. Before committing, fetched and
preserved concurrent owner documentation commit 788f24e58019295fa93aabaf41d9ec6f005c9ac4
with a normal fast-forward. Original design/forms and approved feature paths retained.

## Actual source improvements

- `index.html`: homepage uses fixed 12-document snapshot cursors instead of growing
  realtime prefixes. Two bounded streams preserve SDK timestamp ordering and discover
  missing-timestamp legacy records without inventing dates; canonical IDs, deduplication,
  single-flight loads, session/generation guards and server-confirmed retry cursors.
  The ID stream adds one bounded scan over the catalogue, not repeated prefix reads.
  Search still covers loaded records. Saved IDs are never pruned by partial pages.
  Explicit refresh/reconnect and acknowledged own publish/edit/stock/delete update the UI.
  Other users' changes now require refresh; this is deliberately an on-demand feed.
- Inbox and global badge share in-flight reads. Rooms are paged 30 at a time,
  incoming messages 50 at a time with at most four concurrent room workers, and preview
  reads fetch one record. Complete counts retain unread-first sorting; failure shows
  unknown/retry rather than zero or a partial total. Typing-only room changes do not
  trigger count rescans. Cards render 20 at a time; canonical IDs override stored fields.
- Chat retains latest-35 realtime messages and adds 35-record older cursor windows,
  with an explicit return to Latest. Only displayed incoming non-hidden/non-deleted
  unread messages are offered for receipts; session changes cancel pending work.
  Denied receipts are not automatically retried in a write/revert loop.
  Existing safe renderer, typing, blocking and message actions remain in place.
- Paging/retry controls support Gujarati, Hindi and English and mobile widths.
  No new dependencies, privileged flags, authorization bypasses or trusted-count writes.

## Verification (final reviewed source)

All following commands passed, zero failures/skips:

| Command | Tests passed |
| --- | ---: |
| `npm run test:emulator:safety` (Node/source/model, not actual Emulator) | 125 |
| `npm run test:provider-draft:transaction` (isolated integrations) | 232 |
| `npm run test:service-providers` | 196 |
| `npm run test:chat-message-authorization` | 32 |
| `npm run test:chat-read-receipt` | 5 |
| `npm run test:inbox-summary` | 5 |
| `npm run test:chat-privacy` | 9 |
| `npm run test:emulator:guard` | 14 |
| `npm run test:static-build` (Windows junction protections retained) | 5 |
| `node --test tests/browser/{legacy-performance,marketplace-locale,product-integration,store-integration,provider-conversation-integration,service-messaging-integration,legacy-store-pagination}.test.mjs` (expanded filenames, Chrome) | 33 |
| `node scripts/run-emulator-tests.mjs baseline` (actual Firestore Emulator) | 17 |
| `node scripts/run-emulator-tests.mjs chat-private-state` (actual Firestore Emulator) | 10 |

Browser fixtures execute actual extracted legacy functions; they do not demonstrate a
live backend. New real SDK tests exercise timestamp precision, missing timestamps,
cursors and exact counts beyond one page against synthetic loopback demo data. Fixture
seeding/authorized SDK reads use the explicit test-only Rules bypass; guest/owner/other/
forged-admin reads and forged receipt writes are separately denied by baseline Rules.
This does not establish an approved production participant authorization policy.
Java 21 was set only in child processes. Logs remain ignored under `.firebase/`.
Initial fixture extraction/lifecycle issues were corrected without skipping assertions.
The static HTML/form shell before Firebase initialization matches the starting HEAD.

## Remaining gates / next useful integration

- One inspection of exposed staging tools found only get_environment, get_project and
  update_environment. No deployed Rules snapshot, collection/schema inventory or data
  inspection is exposed. Do not retry or bypass this limitation. `oldx-staging`
  (38472235077) is the owner-confirmed target; actual Rules and whether data is empty,
  disposable or valuable remain unverified. No reset, backup system, migration or Rules
  change was attempted. Capture Rules and inspect actual data with authorized read-only
  access before choosing the simplest reversible staging process.
- Exact legacy unread counting still costs O(all incoming history) overall despite
  bounded queries; the room metadata listener also still covers all user's rooms.
  Missing sender identity/schema compatibility needs trusted validation. Permanent
  improvement requires existing trusted summaries/read cursors and atomic authorized
  writes; browser counts/participant lists are never server authority.
- Existing marketplace host integration, Product conversation repository and Admin API
  client were reviewed/reused conceptually, not duplicated or activated. Public/private
  projections, trusted Chat identities, Admin atomic audit and legacy mixed documents
  still need approved schema/Rules/runtime integration and acceptance. Existing default-off
  prepared components and synthetic Provider/media tests are not live feature completion.
- Live Cloudinary/media operation, real device/Capacitor acceptance and staging feature
  journeys remain unverified. No billing, IAM, secrets, deployment settings, main or
  production operations. Production requires separate final owner approval.

## Next smart integration batch — 6 November 2026

Starting HEAD: ccb84374ce59a97526f99870f2d349d281932ce2. HOLD/NO-GO remains.
No homepage/Chat pagination changes, live access, route activation, Rules edits,
new dependencies, backup infrastructure or design rewrite in this batch.

Implemented `features/marketplace/firebase-integration.mjs` as a small composition
of the existing Provider Auth bridge, authenticated Product/Store command client and
public projection client. The existing Product form can now save/recover private
drafts using those composed ports in an explicitly bound host. Product/Store kinds
are supplied by the adapters; credentials remain transport-only. Existing Provider
command/owner/media ports are reused, and the existing Admin API client can consume
the same session-scoped token dependency. No browser role grants authorization.
The new browser module is included in the existing static asset allowlist.

Fixed a confirmed shared Auth boundary issue: a replacement Firebase user object
with the SAME UID previously retained the old session scope. Exact user identity now
rotates the scope and rejects old token acquisition, including before observer
notification. Product/Store requests are cancelled on session changes; already
sent mutations retain unknown-outcome semantics and are not automatically replayed.
Normal token refresh preserves the scope. Public response projection rejects private
contact fields. Existing Admin direct Firestore access/deletes remain disabled.

Final relevant tests: all pass, zero failures/skips:

- `node --test tests/integration/firebase-marketplace-integration.test.mjs tests/integration/provider-native-session.test.mjs tests/integration/marketplace-session.test.mjs`: 18.
- `node --test functions/admin-backend/*.test.mjs` (expanded filenames): 117.
- `node --test scripts/build-static-assets.test.mjs`: 5.
- `node --test tests/browser/product-integration.test.mjs`: 10; existing form at
  320px, Gujarati draft recovery/logout and other existing responsive/locale journeys.
- `node --test tests/browser/store-integration.test.mjs`: 3 (passed in the combined
  browser run; unchanged by the subsequent Product fixture correction).
- `node scripts/run-emulator-tests.mjs admin-runtime`: 17 REAL loopback Firestore
  and Auth Emulator tests, including native transactions/audits, private ownership,
  participant journeys, forged field denial, revoked-token rejection and deny-all.

The initial new browser fixture incorrectly stripped the owner request's required
kind field; corrected without removing assertions. The initial new Emulator test
incorrectly expected unsigned Auth Emulator tokens to pass the browser bridge's
signed-token syntax. Final test explicitly requires rejection BEFORE dispatch and
separately verifies real native runtime save/recovery using its existing tightly
gated demo-only unsigned-token support. No production/browser token check was
relaxed. The staging-labelled Auth facade exists ONLY in that test around the demo
Auth instance; it does not initialize or access staging. Thus the browser bridge
journey is SDK-double evidence; a signed-token staging end-to-end journey is still
unverified. Native runtime tests are actual Emulator evidence, not deployed acceptance.

Next smallest Chat path: reuse existing inbox-summary/read-cursor contracts and
server-owned private state. Integrate verified participant lookup plus an atomic
message/summary/cursor update with idempotent replay, blocking and deletion semantics,
then reconcile legacy history before switching the reader. A browser count or cursor
must never be the authority. This server integration remains unimplemented/default-off.
Next useful feature task: extend the composed Store owner draft/recovery and Provider
host session fanout through existing UI acceptance; retain deployment/publication gates.

Staging Rules snapshot and inventory remain unavailable as previously recorded; no
repeated tool investigation, emptiness assumption, reset or migration. Product/Store/
Provider live routes, trusted unread summaries, Admin role/audit acceptance, media
operation and real-device/Capacitor acceptance remain blockers. This batch does not
mount the prepared host in the live legacy page or enable any backend route.
