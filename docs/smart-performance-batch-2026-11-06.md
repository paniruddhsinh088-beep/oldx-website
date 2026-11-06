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
