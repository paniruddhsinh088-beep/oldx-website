# Firestore staging readiness — 4 November 2026

**UNDEPLOYED / HOLD–NO-GO.** Owner reports `oldx-staging` is empty, client Rules
are deny-all, and the Vercel Preview homepage loads but Products fail. These are
owner-provided observations, not a remote inspection by this session. No live API,
Rules, indexes, data, credentials, IAM, billing or deployment changed.

## Query/schema findings and selected Rules candidate

`index.html:3908` subscribes directly to legacy `products`, ordered by `createdAt`
descending with `productLimit`; it does not query a curated public view or constrain
publication. Store discovery at `index.html:3857` reads six `stores` ordered by
`updatedAt` and filters full documents in the browser. Client projection cannot
protect private fields. Owner/product queries filter `sellerUid`; Chat uses
`participants array-contains UID`, with nested messages ordered by `createdAt`.
A homepage shell loading does not establish any Firestore access. Empty collections
still return permission errors under deny-all; adding demo records cannot fix them.
Do not open `products`/`stores` reads or make `auth != null` a global allow rule.

**Selected least-privilege staging candidate: reuse
`tests/firestore-emulator/deny-all.rules` VERBATIM.** No new parallel Rules policy is
needed. In this server-mediated design, no browser/Capacitor client needs Firestore
access; guest/public and authenticated operations use trusted bounded HTTP ports.
The candidate is deliberately not wired into root `firebase.json` for deployment.
`firebase.emulator.json` references it for local tests only. The older
`service-providers-candidate.rules` is a separate historic draft/UID experiment,
NOT the approved opaque-ID v1 staging policy and NOT a deployment shortcut.
The separate Chat private-user-state candidate is also an isolated proposal only.

| Domain | Client Rules (guest, owner, other owner, admin claim) | Trusted server policy required before activation |
| --- | --- | --- |
| Products / Stores | Deny all reads/writes, including legacy mixed documents | Guest sees exact published public DTO only; owner writes use verified actor, eligibility, canonical ownership, revisions, idempotency/audit and photo approval; Store withdrawal invalidates linked Product reads |
| Provider v1 | Deny all, including public view enumeration | Existing opaque owner mapping; private drafts owner-only; separate permission for publication; canonical service/publication/generation revalidation and bounded scope-bound cursors |
| Users | Deny all | Self-only private allowlisted profile through verified session; no caller-set roles/privileges; do not publish Auth/contact/IP/GPS automatically |
| Chats/enquiries/messages | Deny all, including nested messages | Verified participant, current ownership/enquiry, block/revocation checks; bounded private reads; sender-derived identity; canonical state/revision/idempotency; retention/delete policy still gated |
| Admin/permissions/audits | Deny all even with `admin:true` token claim | Verified/revocation-checked token plus trusted current operation permission; rate limiting, exact DTOs, bounded reads and atomic audited mutations; no role bootstrap from browser |
| Unlisted namespaces/subcollections | Deny all via recursive catch-all | New access needs explicit reviewed contract |

Server SDK/service identities bypass client Rules. Keeping deny-all does NOT secure
an unsafe backend: existing injected authorization, quota, publication, rate and
projection boundaries must be bound and independently accepted. Trusted fixture
seeding in tests is a Rules bypass, NOT evidence of application authorization.
Existing actual SDK acceptance cases exercise repository ownership/publication/
private enquiry/Chat contracts separately with synthetic identities, not real tokens.

## Index review (proposal only)

Legacy Product/Store ordering and seller equality/Chat participant-only lookups use
ordinary single-field indexes; no permission failure is fixed by a composite index.
Messages `senderUid != UID` filters and ordering must be reviewed per final query;
no speculative index deployment. Existing `docs/proposals/service-provider-v1.indexes.json`
covers published/id, services array, serviceArea and their bounded discovery combinations,
plus selected private-field index exemptions. Provider schema/mapping is in
`provider-schema-v1.md` and `scripts/provider-schema-v1.mjs`; do not use test paths live.

Marketplace SDK list port (`scripts/firebase-marketplace-repository.mjs`) filters
kind, optional category/Store ID, orders by id, reads limit+1 with scope-bound cursors
and revalidates publication. Future reviewed public namespace indexes need these
combinations (all id ASC): kind; kind+category; kind+storeId; kind+category+storeId;
Store categories array membership plus kind/id. Actual physical namespaces and final
query/explain evidence must be approved before generating a deployable index manifest.
Emulator success does not verify deployed composite-index readiness or billing.

## Small synthetic data plan — local fixtures first, staging seed NOT authorized

Use a manifest of exact IDs, run identifier, intended namespace and rollback owner.
No bulk import or automatic seeding. Four synthetic identity roles: owner A, buyer B,
other seller C, moderator D; no real emails/phones/customer identities or contacts.
Plan two Products (published/unpublished), two Stores (published/withdrawn), two opaque
Provider profiles (multi-service published/private draft), one private enquiry with
a two-message thread, one block fixture, minimal permissions/audit/receipt records.
Only harmless text (`મૂળ हिन्दी Sample`), coarse sample Gujarat locality, bounded
prices and synthetic image IDs. No remote images or real uploads; approved managed
photo fixtures are needed before any staging publication acceptance. Quarantined,
withdrawn and private content must never enter public projections. Preserve authored
Unicode; only app-owned labels use gu/hi/en catalogs.

Current new Emulator fixture set is smaller: ten minimal documents covering legacy
Products/Stores, legacy and v1 Providers, Users, nested Chat, Admin permissions/audit.
Seeded only by a loopback test fixture context. Four client roles must fail reads,
list/create/update/delete; trusted fixture reads verify seeding without claiming auth.
No runtime/UI changes, so Android/Capacitor navigation and platform ports are untouched.

## Deployment prerequisites and rollback — instructions only, no operation authorized

1. Owner separately approves exact staging runtime/bindings, schema namespace/query
   plan, Rules/index artifact hashes, synthetic seed manifest and data-change scope.
   Existing owner approval of safe read-only preflight is not deployment permission.
2. Verify target from trusted runtime configuration AND authenticated project metadata
   is exactly `oldx-staging`; exclude `oldx-1c983`, production domain and `main`.
   Attach existing authorized access securely; never send secrets in chat. Confirm
   network access and least-privilege identity without creating IAM/credentials here.
3. Capture current deployed Rules release/version and exact source/hash, index metadata,
   runtime gate/config version and synthetic-only data inventory. Owner-reported empty
   database is not a backup. Verify zero-cost backup/restore evidence and operator
   rollback access; stop if creating backups/resources or spending is necessary.
4. Before any approved deployment, verify applicable exact-source Rules/SDK tests,
   real token revocation/role/rate handling, server DTO/parent/revision checks, signed
   media/quarantine/private delivery and retention/moderation decisions. Never expose
   legacy private documents or activate unsigned upload as fallback.
5. Separate operator-approved staged acceptance: first deny-all cross-role checks;
   then synthetic Login/logout/refresh; bounded public discovery/detail/publication/
   withdrawal; owner/other-owner writes; participant/block/message checks; mandatory
   photo/quota/retry/withdrawal; gu/hi/en authored Unicode at 320/375px. Capture exact
   request outcomes without tokens, private text or credentials in logs.
6. Rollback triggers: private-data exposure, cross-account access, stale publication,
   unbounded reads, duplicate mutation, media leak, runtime error surge. Disable the
   new runtime gates first, restore the captured deny-all Rules version and prior
   runtime binding/config through separately authorized operator actions; verify
   unauthorized reads/writes remain denied. Do NOT enable legacy broad read fallback.
   Data rollback only from the approved exact synthetic manifest/backup, no bulk deletes
   or legacy image deletion. Rules rollback alone cannot undo leaked data or messages.

## Test evidence and blockers

New `staging-readiness-runtime.test.mjs` is included in the existing baseline Emulator
plan, explicitly guarded to demo project + loopback. No new deployment config/script.
Local guard/baseline/deployment checks: 17/17 passed. An initial restricted-shell
subprocess check failed to capture child stderr; rerunning unchanged tests with the
supported subprocess/network sandbox grant passed. No assertion weakened or skipped.
Local actual Emulator not run: no cached JAR and official binary host
`storage.googleapis.com` remains excluded by enforced network policy. Do not use a
mirror/bypass. Actual execution is delegated to the push-triggered Review CI baseline
Emulator step; record its exact source/run after completion. Historical CI success
is not evidence for the new matrix or for staging.

Remaining blockers: no attached staging identity/config/verified runtime; denied API
network destinations; no verified isolation/backup/rollback; no approved real write/
public-read/media runtime bindings or deployed index evidence; outstanding Chat
retention/deletion and Admin/media privacy/moderation policy; real staging/mobile
acceptance. Fastest safe next step is restoring existing authorized read-only preflight
access/evidence, then reviewing one explicit server-mediated staging slice. Do not
relax client Rules to make the existing legacy listener work. HOLD/NO-GO remains.

## Verified checkpoint

Source: `7597964fa362665a6b575fe458366abfc2bb6e2c`. Remote history preserved;
first GitHub push returned transient internal-server error, ordinary retry succeeded,
remote SHA matched. No force push or activation.

Exact-source CI: Review Safety **41810113997 success**, Branch Security
**41810113895 success**, Service Providers Emulator **41810113893 success**.
Review job `126506972670` logs confirm actual loopback Firestore Emulator baseline
**13/13 pass**, including all **5/5 new staging readiness cases** (four client roles
and trusted fixture access). This is real Emulator execution, NOT staging acceptance.
Existing Service SDK Emulator workflow also passed unchanged ownership/publication/
Chat/media cases; do not infer real token, deployed index or runtime readiness.

Final checkpoint is this documentation-only follow-up commit; resolve with
`git log -1 --format=%H -- docs/proposals/firestore-staging-readiness-2026-11-04.md`.
Stop here with clean tree; no operational deployment or demo-data seeding authorized.

## 5 November owner approval / current preflight

Owner conditionally approves oldx-staging Rules/collections ONLY after identity,
live Rules snapshot, empty-state/backup, rollback and checks are verified. These
prerequisites are currently unavailable in the execution environment. No deployment
or live observation occurred. The least-privilege server-mediated selection remains
deny-all; do not use the unrelated owner-drafts proposal to open legacy products.
New default-disabled native public Browse preparation reuses the existing public
query/publication contracts. See [current checkpoint](../oldx-autonomous-resume.md).

Native Browse fix `dd41d8f093ffc8f4ce453abdf4dfbc2f9130b66a` passed Review
`41990159155`: actual native SDK **11/11**, private Product-draft Rules **6/6**,
integration **207/207**. SELECT/doc public field order is normalized without dropping
any field/value comparison. New ports remain disabled/uninstalled. No deployed Rules
snapshot, live empty-state inventory or rollback verification exists in this environment;
existing scoped Firebase access/network is the exact deployment blocker. Conditional
staging Rules approval is recorded; broad legacy read/write allowances are not a fix.
