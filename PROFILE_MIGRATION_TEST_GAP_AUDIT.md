# OLDX Profile Migration Test Harness Gap Audit

**Branch:** `security-hardening-review`  
**Scope:** Existing synthetic/local profile migration helper and reference access-policy model.  
**Status:** Static review only; no code or test changes made in this document.  
**Safety:** No Firebase data, Rules, backend, Staging or Production resources accessed or changed.

## 1. Executive finding

The repository already contains useful pure synthetic helpers and tests, but they are an early candidate model—not a production-ready migration tool, not Firestore Rules, and not complete compatibility coverage. Do not run them against real records or treat passing tests as authorization to migrate.

Reviewed:
- `tests/firestore-emulator/profile-migration-transform.mjs`
- `tests/firestore-emulator/profile-migration-transform.test.mjs`
- `tests/firestore-emulator/profile-access-policy-model.mjs`
- `tests/firestore-emulator/profile-access-policy-model.test.mjs`
- `tests/firestore-emulator/fixtures.json`
- `tests/firestore-emulator/README.md`

## 2. Existing helper behavior and gaps

| Area | Current synthetic helper behavior | Gap / risk | Required before use |
|---|---|---|---|
| Display name | Trims and caps at 80 characters | Does not map legacy `name/fullName/username` fallbacks | Add explicit deterministic legacy precedence tests after owner confirms policy. |
| Profile photo | Accepts HTTPS URLs from a fixed host allowlist | Existing app may store compressed data URLs; helper drops them. This could silently remove user profile photos. | Decide canonical storage representation; test data URL size/type and approved upload migration. Never blindly trust arbitrary hosts. |
| Saved Ads | Accepts only string IDs, deduplicates and caps at 100 | Current app explicitly supports string IDs and objects with `docId`; object entries are currently discarded. Metadata preservation and product ID validation are unresolved. | Add fixtures for both shapes; preserve required metadata or deliberately migrate only IDs with an approved UX-compatible fallback. Test duplicates, malformed IDs, oversized arrays. |
| Block list | Projects `blockedUsers` as a private array capped at 200 | Proposed target is a separate private one-way relation; copying it into a private profile perpetuates the current schema and does not establish trusted send enforcement. | Transform to relation records in a pure model; test one-way semantics and privacy. Do not rely on client list reads for enforcement. |
| Email / IP / presence / role | Excludes these fields from public/private projection | Good allowlist behavior, but no separate approved trusted security-event migration exists | Keep excluded unless a separately reviewed lawful trusted-server design is approved. |
| Target merge | Existing target values override stale proposed values | Shallow merge only; no checkpoint, source version, conflict detection or partial failure protocol | Add deterministic conflict/version policy and idempotency tests before a real runner. |
| Access policy model | Candidate public profile readable by anyone; private fields owner-only; trusted always denied | This is a JS reference model, not Firestore Rules. Public read is still a candidate policy pending owner decision. | Translate to real Rules only after public field allowlist approval and Emulator tests. |
| Fixture coverage | Synthetic buyer/seller/product/store/chat/message examples | Missing user profile legacy variants, Saved Ads object form, block relation, presence, delete/hide/read/typing, store privacy settings, timestamps | Expand fixtures and negative/positive cases. |

## 3. Specific incompatibilities to resolve

1. **Photo data URLs:** profile editor uses canvas `toDataURL('image/jpeg', 0.5)`; helper currently accepts only approved HTTPS hosts. A naive run would omit existing data-URL photos. Preserve the user's picture through a staged upload/compatibility design.
2. **Saved Ads object entries:** application reads either a string or `item.docId`; helper accepts only strings. Migration must not drop supported entries or silently change ordering/metadata.
3. **Block model mismatch:** helper stores a private `blockedUsers` array, while the target proposal uses a private relation/subcollection or trusted enforcement. Choose one final target and test enforcement; do not implement both inconsistently.
4. **Public profile approval:** helper model currently permits guest reads of public profiles. This is a candidate policy, not final authorization approval. Confirm exact public fields and whether profile visibility controls are needed.
5. **No real migration runner:** helper is pure and has no Firestore dependency. It does not read, write, page, checkpoint, retry, or verify migrated records.
6. **No Rules validation:** current Emulator config uses deny-all Rules. Existing profile access model tests do not execute Firestore Rules.

## 4. Required next synthetic test cases

- Legacy profile with `displayName`, fallback `name`, `fullName`, `username`.
- Valid HTTPS profile photo, existing data URL, invalid URL, oversized data URL.
- Saved Ads list with strings, `{docId}` objects, extra metadata, duplicates, malformed entries, empty and oversized lists.
- Block relation: A blocks B; B cannot send new messages to A; old history remains visible to both; B cannot read A's private block list; unblock restores intended flow.
- Presence: chat participants can read only their room's presence; unrelated signed-in user and guest cannot.
- Public/private Store field split with opt-in and opt-out contact visibility.
- Newer target profile wins over legacy source without losing unrelated allowlisted target fields.
- Repeated dry-run/projection is deterministic and does not mutate inputs.
- No raw email, IP, block list, presence, arbitrary field or Admin role leaks into public projection.
- Test malformed timestamps and legacy docs with no `createdAt` without crashing or enabling Admin pagination.
- Account deletion fixtures with partial failures and resumable checkpoints.
- Chat message state transitions: recipient read receipt, per-user hide, original-sender delete within 15 minutes, denial after 15 minutes.

## 5. Next safe implementation order

1. Update only pure local transformation helpers to support approved legacy shapes and final target model.
2. Add tests for object-shaped Saved Ads and data URL photo compatibility before any schema cutover.
3. Build a pure relation projection for one-way blocks; keep enforcement separate and trusted.
4. Expand synthetic fixtures for chat presence, store visibility, message transitions and account cleanup.
5. Run local Node tests and CI; verify all changes are limited to synthetic tests/helpers.
6. Only after these tests pass, draft actual candidate Rules for the Emulator. Do not use deny-all fixture as app Rules.
7. No staging database scan, migration, Rules publication or Production change without separate approval.

## 6. Explicit non-authorization

This gap audit does not authorize:
- Running a migration against any real Firestore project.
- Reading or exporting user documents.
- Publishing or deploying Rules.
- Provisioning or deploying Admin backend resources.
- Changing profile photos, Saved Ads, blocks, chat data, Stores or Products.
- Any Production change.
