# Store directory/category milestone — 3 November 2026

Branch security-hardening-review only. Clean base 9d80771; fetched/read/fast-forwarded
owner interruption rule `69d3b6d9dc1c4f3cfd4383bcc828b747ce0df311`. AGENTS,
launch register, feature matrix, approved design/language and recovery checkpoint
reviewed. Existing Product recovery retained; no restart, reset, main or merge.

Implemented default-off source:
- Existing Store profile supports optional bounded unique `categories` (known IDs,
  primary category first). Old single-category profiles still round-trip unchanged.
  SDK public queries use one bounded OR query for legacy primary or new secondary
  category, deterministic ordering, existing scope/generation cursors and fresh
  canonical owner/publication checks. Private fields/photos never enter directory.
- Existing home Store grid, category filter, directory pagination, localized empty/
  loading status, owner category restore/edit and public detail links use existing
  Store ports. Primary category is retained on reload; clearing selections fails
  validation instead of silently dropping or replacing categories. Accepted Store
  arrays are cloned to prevent mutation after response acceptance.
- Existing Product/Store/Provider session lifecycle can be fanned out through a
  disabled portable adapter. It forwards UID/opaque scope only, not tokens/roles;
  failures clear all bindings. Provider uses its existing bootstrap starting scope,
  not a new state machine or authorization model. No automatic auth listener exists.

Validation: one selected eight-script regression checkpoint, **627 executions**:
transaction integration 98; Store modules 82; i18n 11; source safety 83; static 3;
Service modules 196; Admin 115; existing browser command 39. Logs:
`/workspace/work/store-directory-regression/`, runner `/tmp/oldx-directory-check.cjs`.
Final Store/session focused checks 4/4 after immutable-copy refinement. Browser
Store cases cover gu/hi/en, 320/375px, multi-category save/edit/reload, directory,
share and withdrawal. Shared actual SDK Emulator acceptance also tests mixed legacy
and multi-category rows, cursor continuation/invalidation and malformed categories.
Local official Emulator download remains blocked; actual evidence comes from CI.
An initial Provider scope adapter mismatch failed a test and was corrected to the
existing required revision/generation bootstrap contract; no assertion was removed.

Readiness: Product prior UI/SDK recovery retained; Store directory/category source
advanced; Provider full owner/buyer/inbox/reply/deep-link orchestration remains next.
Chat/Admin/media/review/localization requirements are retained, not declared done.
No real staging/live or Android acceptance. No percentage completion inferred.

Next executable batch: compose existing Provider owner/bootstrap/discovery/enquiry
ports with trusted provider inbox/reply lifecycle and real-markup route acceptance;
then complete Store/Product navigation acceptance at the shared host boundary.

Operational gates remain: approved runtime/commercial eligibility, concrete schema/
compatibility, verified identity/session, trusted cursor signing, OR-query indexes,
privacy/retention, media provider/scanner/quota and separate staging/deployment.
No live Firebase/Cloudinary, Rules/index, IAM/secrets, billing, provider activation,
migration, paid service, native packaging or deployment occurred. **HOLD/NO-GO**.
Source SHA and exact CI are recorded after successful authorized push.

Milestone pushed: `e6cf42f635bf4b9b02f9dff6040aa4dcad3251b7`.
Installed Firebase SDK construction check then reproduced an OR-query API error:
composite filters must be nested under `and(...)`, rather than combined as separate
top-level where/or arguments. Corrected grouping preserves both authorization and
category predicates. Added a real-SDK construction regression with ALL reads mocked
and demo/loopback configuration; no Emulator/live read occurs locally. Corrected
Store/durable/session focused cases: 9/9 pass. CI for the corrected SHA follows.
