# Independent local audit and closure batch — 6 November 2026

Status: HOLD/NO-GO. Repository-only source changes; no runtime activation.
The original audit below is a historical snapshot. The latest verification is recorded here.
Branch: security-hardening-review. Clean starting HEAD and fetched remote:
bc55343c529ea9c2b8f0b29d67e39c6b004e2253. Fast-forward reported already up to date.
Existing ZIP directory untouched. No main/production/live Firebase or Cloudinary
access, Rules/IAM/secrets/billing changes, runtime activation or deployment.

## Reviewed follow-up and actual Emulator verification — 6 November

All nine original files were reviewed, including complete new tests, docs, source
and packaging assertions. No accidental removal of the Product/Store/Provider/Chat
journeys was found in this diff. Legacy Admin data/deletion is deliberately unavailable
until a trusted API is bound; it is a safety restriction, NOT a completed Admin migration.
The UID UI gate is not claimed as authorization. No live or candidate Rules changed.

Two additional source files are necessary before the authorized push: vercel.json
previously enabled automatic review Preview deployments. Only security-hardening-review
is now false; main/other branch policy is untouched. The deployment-boundary regression
requires this exact false value. This tightens the no-deployment boundary and does not
activate or deploy anything. See https://vercel.com/docs/project-configuration/git-configuration.
No workflow deploy command was found. All disabled runtime gates remain unchanged.

Portable static tests now register BOTH ancestor and config leaf-link rejection on
Windows as well as POSIX: real Windows junctions require no file-link privilege;
POSIX retains a regular-file symlink. Five tests pass, no platform test is skipped,
private targets are reachable in fixtures and previous output remains unchanged.

Java was absent from PATH. Downloaded official Eclipse Temurin JRE 21.0.13+9,
Windows x64 archive, and verified SHA256 before extraction:
2332c0b4cff6bed722da3567c91d5e47568bcba863fa4945d0a8d6fc76158628.
Runtime is under the local TEMP/oldx-java21-21.0.13/runtime directory. JAVA_HOME/PATH
were changed only in child test processes; no registry/global environment/service,
paid installation or cloud resource was changed. Official metadata:
https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse.
The installed firebase-tools requires Java >=21; its official source confirms the
minimum: https://github.com/firebase/firebase-tools/blob/main/src/emulator/commandUtils.ts.

Actual native Emulator suites, with Java on the child PATH, all PASS:

| Exact npm command | Actual tests |
| --- | --- |
| npm run test:admin-runtime:emulator | 15/15 |
| npm run test:emulator:rules | 13/13 |
| npm run test:product-drafts:rules | 6/6 |
| npm run test:storage:rules | 7/7 |
| npm run test:chat-private-user-state:rules | 10/10 |
| npm run test:service-providers:rules | 37/37 |

Total actual Emulator executions: 88 pass, 0 fail, 0 skip. Five suites were invoked
via equivalent node scripts/run-emulator-tests.mjs baseline/product-drafts/storage/
chat-private-state/service-providers; admin-runtime used its npm command. The fixed
runner uses only demo-oldx-* projects and loopback hosts; emulator data was ephemeral.
Official Firestore v1.22.0 and Storage emulator binaries were cached locally.
Admin SDK emitted a metadata-detection warning before tests; no test failed and no
live Firebase project was selected. Synthetic negative tests still exercise production
project strings as rejected input; they do not access production.

Fresh regressions on reviewed source:
- npm run test:emulator:safety: 99/99.
- npm run test:admin-backend: 117/117.
- npm run test:static-build: final 5/5.
- npm run test:provider-draft:transaction: 231/231.
- npm run test:chat-message-authorization: 32/32; test:chat-privacy: 9/9;
  test:stores: 82/82.
- CHROMIUM_PATH set to installed Chrome for npm run test:service-preview:browser:
  103/103, ~158.9s. Real Chrome against isolated fixtures, not live staging.
- node --test tests/firestore-emulator/product-public-private-transform.test.mjs
  features/stores/public-data-scope.test.mjs features/stores/public-data-contract.test.mjs
  tests/integration/staging-public-query.test.mjs tests/integration/product-conversation.test.mjs
  tests/integration/provider-enforcement.test.mjs tests/integration/provider-enquiry-transaction.test.mjs:
  40/40. These overlap existing groups and are NOT added to an aggregate count.
- npm run test:stores:browser (installed Chrome): 28/28, including bounded discovery,
  sort/filter/cursor races, route restoration, withdrawal and 320px/200% text.
- Focused Admin/Chat/deployment regressions: 9/9; git diff --check passes.
No assertions weakened, no failing test skipped. No new source-level Emulator defect
was observed. Native Rules/SDK success does not establish operational acceptance.

Further source review confirms remaining blockers at index.html:1500 (growing
product limit), :2404 (per-room full message history), :2531/:4822 (legacy participant
construction), :4447 (unbounded Store seller products), :5083/:5092 (legacy private IP
and privileged flags). Trusted projection/participant enforcement modules and their
negative tests pass, but the legacy paths still require approved integration and
privacy/compatibility acceptance. No unsafe migration or permissive Rules shortcut.
No performance vitals, physical Android/WebView or real provider moderation/revocation
acceptance is claimed. All original operational P0 blockers below remain applicable.

Reviewed changes are intended for security-hardening-review only. Parent/base is
bc55343c529ea9c2b8f0b29d67e39c6b004e2253; obtain final commit identity from git log.
Push must be normal fast-forward only, after a fresh fetch; never force-push.

## Original audit snapshot

## Confirmed source corrections

- admin.html:63,241,304: remove legacy Firestore SDK/database initialization,
  collection-wide reads and product delete. Both legacy entry points fail closed
  without I/O, clear cached lists on load and show unavailable service (not fake
  zero totals). Hardcoded UI identity is not trusted authorization. No API is enabled.
  functions/admin-backend/admin-legacy-disconnected.test.mjs covers direct invocation
  with forbidden transport/database hooks, cache clearing and source disconnection.
- index.html:1663,2179,2541,2634: own and detach typing subscription on room change,
  close and Auth change. Generation invalidation rejects queued old snapshots,
  preventing late presence-listener resurrection. This is not complete Chat lifecycle
  enforcement; existing message/receipt/presence paths still need trusted integration.
  tests/firestore-emulator/chat-listener-lifecycle.test.mjs has three regressions,
  registered in package.json safety command. Before correction all three failed.
- scripts/build-static-assets.test.mjs:59,71: EPERM occurred while constructing a
  file symlink, before the build security assertion. A real Windows directory
  junction (POSIX directory symlink elsewhere) now proves ancestor links are rejected,
  their private target is reachable, no private output is copied and previous output
  remains intact. Missing-config preservation is independent. POSIX additionally
  retains real leaf-file symlink coverage; Windows does not claim file-link privilege.
  No production builder guard is relaxed, no skipped test or Windows setting change.
- tests/integration/staging-marketplace-packaging.test.mjs:13: root+'/' containment
  assertion rejected native Windows backslash paths. Use path.relative/sep with
  absolute/traversal rejection and the same scripts/functions/features allowlist.
  The previously failing package case now passes; disabled generated handlers still
  return 503 with no-store and no SDK initialization in temporary output.

## Exact local evidence

Node 26.13.0 / npm 11.20.0; Git 2.56.0.windows.4. CI targets Node 24;
installation warns superstatic expects 20/22/24. No toolchain version/settings changed.
npm ci --ignore-scripts --no-audit --no-fund installed 748 locked packages;
package-lock.json is unchanged. No provider client/account initialized by installation.

| Command | Result |
| --- | --- |
| npm run test:emulator:safety | 99 pass, 0 fail/skip; source/model tests, not Rules Emulator |
| npm run test:admin-backend | 117 pass, 0 fail/skip |
| node --test scripts/build-static-assets.test.mjs | 4 pass on Windows, 0 fail/skip |
| npm run test:provider-draft:transaction | 231 pass, 0 fail/skip; SDK doubles/injected HTTP and package/codec checks |
| node --test tests/integration/staging-marketplace-packaging.test.mjs | 1 pass; overlaps transaction suite |
| npm run test:service-providers | 196 pass, 0 fail/skip |
| npm run test:stores | 82 pass, 0 fail/skip |
| npm run test:chat-message-authorization | 32 pass, 0 fail/skip |
| npm run test:chat-privacy | 9 pass, 0 fail/skip |
| npm run test:chat-private-user-state | 9 pass, 0 fail/skip |
| npm run test:product-migration | 11 pass, 0 fail/skip |
| npm run test:product-category | 8 pass, 0 fail/skip |
| npm run test:firebase-config | 6 pass, 0 fail/skip |
| npm run test:emulator:guard | 14 pass, 0 fail/skip |
| npm run test:toolchain | 2 pass, 0 fail/skip |
| $env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'; npm run test:service-preview:browser | 103 pass, 0 fail/skip, ~171.5s; PowerShell process environment only |
| npm run test:admin-runtime:emulator | BLOCKED: could not spawn java -version; no emulator test executed |
| node --experimental-vm-modules --no-warnings (compile-only tracked/untracked JS and HTML scripts via vm.Script/SourceTextModule) | 415 units pass; no linking/app execution/network |
| git diff --check | pass |

Browser tests use loopback fixtures and injected SDK/transport ports. They exercise
real Chrome DOM/layout at 320/375px (some wider), gu/hi/en, 200% text, keyboard,
photo retry/revocation, Product/Store/Provider and private Chat flows. They do NOT
prove real Firebase/Cloudinary integration, low-end Android performance or WebView.
No Java executable was available on PATH or the inspected standard install roots.
No system JDK/Android/toolchain install attempted. Actual Rules/SDK Emulator evidence
must be obtained on an approved existing Java-equipped runner; historical CI results
in docs are not a fresh CI result for this local diff.

## Remaining prioritized blockers and references

1. P0 Admin trusted runtime: functions/admin-backend/authz.mjs resolves active role
   from verified identity on every request; http-handler.mjs rejects missing mutation
   validator/atomic adapter. These injectable contracts are not proof of deployed
   role revocation or durable audit. New disconnected legacy UI prevents direct
   browser bypass, but API UI binding and operational acceptance remain incomplete.
2. P0 Product/Store privacy: scripts/staging-marketplace-context.mjs separates
   private/public records into marketplacePrivate_v1 and
   marketplacePublic_v1 collections; firebase-marketplace-repository.mjs and public
   projections have isolated tests. Legacy index.html still reads products/stores/users,
   stores userIp/contact data in product records and sends privileged product flags.
   Legacy reads can expose private fields if permissive Rules are installed. Do not
   fix with permissive Rules or silently migrate/delete fields; approved schema/
   consent/compatibility and server-mediated binding are required. See public/private
   migration plans and features/stores/public-data-contract.mjs.
3. P0 Chat: new provider conversation core enforces participant/eligibility/block/revision
   and idempotent transactions in isolated tests. Legacy client still constructs
   participants and performs message/receipt/profile operations. Deployed participant,
   retention/deletion, account cleanup and private-media acceptance remain unverified.
4. P0 operational media/runtime: functions/staging-marketplace/bootstrap.mjs,
   scripts/staging-marketplace-media.mjs and docs/proposals/provider-real-integration-gates.md
   retain default-off/project-bound routes. Native journal/provider/review/lease/atomic
   publication code exists. No actual provider signature compatibility, moderation,
   secure server identity, quotas, rollback or CDN/private-byte acceptance was tested.
   Historical cloud-runner credential/network blockers must not be assumed to describe
   this Windows laptop; no credentials were discovered or operational calls attempted.
5. P1 bounded reads/mobile: index.html grows productLimit and resubscribes, loads all
   store seller products, and reads message histories per inbox room. Trusted bounded
   public/inbox projections exist separately; migrate using accepted schema and fresh
   authorization, not client-trusted counters. Initial Tailwind/maps/SDK/font loading
   remains heavy. No measured LCP/INP/CLS/low-end-device benchmark is claimed.
6. P1 Android: responsive browser evidence only. No Capacitor/native Android project,
   signed bundle, real WebView/picker/back/permissions/offline acceptance. Keep the
   existing Android roadmap gates; do not start release packaging before web readiness.

Next safe batch: Java-equipped actual emulator matrix against this diff, Node24 CI,
then reviewed Admin bounded-API UI binding and trusted Product/Store/Chat integration
acceptance. Operational access, policies and activation remain separate gates.

Final remote read-only ls-remote again matched base HEAD bc55343c529ea9c2b8f0b29d67e39c6b004e2253; no concurrent remote commit was replaced. Nine local files changed/added; no commit or push.
