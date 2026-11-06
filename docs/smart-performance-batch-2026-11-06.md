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

## Store / Provider owner UI acceptance — 6 November 2026

Starting HEAD 893b85fcf1173b304b7e282959ee967c6f7c0d02; HOLD/NO-GO.
Reused existing Store Auth/command ports and configureWebsiteProviderFirebase;
no new architecture, dependencies, live bootstrap, Rules or cloud changes.
Store browser acceptance now exercises composed token ports, draft save, lost-ack
same-key retry, owner-form recovery, multiple categories and logout cleanup across
Gujarati/Hindi/English at 320/375px. Provider acceptance uses the actual existing
website configurator for multi-service private draft edit/retry, full page reload
and owner recovery, logout/destroy clearing and 200% text across the same locales.
Store public catalogue/share/withdrawal assertions remain intact. Browser backends
are isolated SDK doubles, not evidence that routes or media are live.

Confirmed fixes: Store rejects malformed publication/receipt/photo recovery DTOs,
including non-boolean success, before restoring a private draft. Late prior-session
owner responses cannot restore the next session. Provider owner commands now disable
without a session, and destroying an enabled binding clears private form contents.
No existing design or approved feature was removed.

Final focused results (60 distinct tests passed, no failures/skips):
- `node --test tests/integration/store-owner-recovery.test.mjs tests/integration/store-ui.test.mjs tests/integration/firebase-marketplace-integration.test.mjs tests/integration/provider-native-session.test.mjs`: 21. The two Store recovery tests were also rechecked after the final strict-success assertion.
- `node --test tests/browser/store-integration.test.mjs tests/browser/provider-owner-session.test.mjs`: 6; Provider 3 rechecked after destroy cleanup.
- `node --test tests/integration/provider-owner-bootstrap.test.mjs scripts/build-static-assets.test.mjs`: 11.
- `node --test --test-name-pattern='existing UI stays|session/page/search|integration feedback|owner bootstrap|existing owner binding' tests/browser/service-preview.test.mjs`: 5 selected affected cases.
- `node scripts/run-emulator-tests.mjs admin-runtime`: 17 actual isolated Auth/Firestore Emulator tests; native Store/Provider authorization, audits, revocation and direct-client denial preserved. Signed browser token integration with live staging remains unverified; no Emulator-specific client security relaxation.

The initial deferred-read test fixture invoked its resolver before the scheduled
read; corrected the fixture's scheduling without changing security assertions.
Staging Rules/inventory access remains blocked as previously recorded; no repeat
investigation. Live deployment/activation, media operation, trusted Chat summaries
and real-device acceptance remain outstanding. Next: bind the existing owner journeys
to an approved staging host/transport once prerequisites are verified; independently,
add scoped media/gallery recovery acceptance using the existing media contracts.

## Gallery/photo acceptance batch — 6 November 2026

Started at 318f5f91fdb6f3931b150dfe851daac09309a09c; HOLD/NO-GO.
Provider photo UI now restores profile/service gallery descriptors through existing
ownerReferences, with the existing bounded-read deadline/retry contract. Recovered
items show service labels without fetching private URLs/bytes. Session/parent changes
clear previews and reject late reads; revision changes preserve only never-dispatched
local selections. Completed galleries do not consume another service's local selection
limit. Attach/removal retries retain request IDs; pending uploads resolve status rather
than retransmitting bytes. No upload/publication gate or server contract was enabled.
Store acceptance adds managed-reference recovery, pending replacement reload recovery
without a second upload, and logout/history receipt cleanup. Multiple categories and
multi-service profile/session work were not repeated or changed.

38 distinct focused tests passed, zero failures/skips:
- `node --test tests/integration/authenticated-photo-client.test.mjs tests/integration/mandatory-photos.test.mjs tests/integration/provider-photo-contract.test.mjs tests/integration/photo-lifecycle.test.mjs`: 18.
- Store photo browser selection in `authenticated-photos.test.mjs`: 6 existing tests (`--test-name-pattern='authenticated store'` before adding new cases), then 3 added descriptor/replacement cases (`--test-name-pattern='authenticated store gallery'`).
- `node --test tests/browser/provider-gallery-recovery.test.mjs`: 3, including stalled-read timeout/retry, same-key attach/remove retries, service isolation and late-read logout cleanup.
- `node --test --test-name-pattern='Provider private photo upload' tests/browser/provider-website.test.mjs`: 3.
- `node --test scripts/build-static-assets.test.mjs`: 5.
Browser cases use loopback injected media responses across Gujarati/Hindi/English,
320/375px and enlarged Provider text. These are not real uploads or staging acceptance.
Server/Rules boundaries were unchanged, so unchanged native Emulator suites were not
rerun. Existing staging access/activation, trusted processing, signed-token and media
approval gates remain blockers; no cloud operations, Rules edits or deployment.

## Staging-first preflight — 6 November 2026

Read-only MCP get_environment/get_project verified oldx-staging / 38472235077,
ACTIVE, billing disabled. Connection works; only environment/project/update tools
are exposed. Deployed Rules, collection/schema inventory and actual data cannot be
read through this session. MCP still points at the original ZIP directory with no
firebase.json; no environment setting was changed. Do not infer empty data or deny-all
Rules from old notes. Staging execution blocked; no production operation.
Minimum next live step: obtain authorized Rules snapshot/rollback reference and a
complete orphan-aware data inventory, then verify compatibility, permissions and
zero-cost eligibility before the existing private draft save/owner integration.
Repository-only improvement: existing documentary checker accepts independently
verified empty inventory without a document backup/restore; it still requires Rules
rollback, complete inventory, review, permissions and cost/feature evidence. Unknown
or non-empty data retains backup/restore requirements. ExecutionAuthorized always false.
`node --test scripts/staging-preflight-evidence.test.mjs`: 7 passed, 0 failed/skipped.
No deployment, data write, migration, Rules change or backend activation; HOLD/NO-GO.
