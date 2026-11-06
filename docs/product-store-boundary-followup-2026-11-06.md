# Product/Store boundary and pagination follow-up — 6 November 2026

Branch: security-hardening-review. Parent/source baseline fetched clean:
e053a91393ad292636996dfe7a71c78caef7a145. HOLD/NO-GO remains.
Reviewed AGENTS.md, independent-audit-2026-11-06.md, Product write inventory,
public/private migration plan and current Marketplace/Store/Provider components.
No live Firebase/Cloudinary access, data migration, Rules/index/IAM/billing/secrets,
deployment, main modification or disabled runtime activation. The existing review
Git auto-deployment guard remains false. Java/runtime changes are process-local only.

## Changed behavior and files

- index.html: seller self-promotion/verification controls are disabled; new legacy
  Product payloads set isFeatured/isShopVerified false regardless of checkbox tampering.
  Removed publication's third-party IP lookup and userIp field. Existing contact,
  photos, seller-auth snapshot, stock, edit and acknowledged-write feedback paths
  remain; this is not a public/private schema migration or backend authorization.
- Legacy card/detail/Store pages no longer claim verification from seller-controlled
  fields or a default VERIFIED badge. The legacy curated featured shelf stays empty
  until a trusted curated integration exists. Self-assigned promotion is deliberately
  unavailable, not silently treated as an approved feature. No charge/checkout occurs.
- Product feed and edit fallbacks pin docId to the SDK document ID after data spread.
  Store public/owner reads similarly pin uid to the requested document identity.
  Header lookup no longer overwrites the currently viewed Store's shared data;
  completion/error checks use the exact current user session object.
- Replaced full Store seller-product reads with explicit 24-document pages ordered
  by document ID and startAfter(last SDK snapshot). Every page remains seller-scoped.
  Single-flight guards prevent duplicate requests; foreign/oversized responses reject
  without advancing cursor/cache. A localized gu/hi/en load/retry control permits the
  whole catalogue to be traversed. Category/name/price/stock filters remain available;
  search/sort/counts explicitly describe the loaded subset, not a global indexed search.
  Last full page can require one final empty query to establish exhaustion. Missing
  createdAt does not drop a product because paging uses document ID, not timestamp.
- Store document/page generations discard late results, errors and finalizers on
  route/store changes. Store cache is cleared when opening another public Store.
  Product listener generations prevent unsubscribed callbacks/errors overwriting a
  newer feed. Existing growing homepage limit remains separate unfinished work.
- A partial feed is no longer interpreted as deletion: removed saved-ID pruning and
  its users-document write from the listener; saved/recent views filter only their
  visible subset without persisting destructive cache changes. Saved IDs outside the
  loaded window have honest localized recovery text. Explicit user removal remains.
- package.json registers new read-boundary and legacy browser regressions.
- tests/firestore-emulator/legacy-marketplace-read-boundary.test.mjs exercises the
  actual extracted legacy functions: bounds/cursors, canonical IDs, single-flight,
  duplicate rows, foreign/oversized replies, retry, out-of-order Store documents,
  late callbacks, header/share identity and saved/recent preservation; 8 tests.
- tests/browser/legacy-store-pagination.test.mjs exercises actual legacy catalogue
  helpers/filter and actual Product card in Chrome: 320/375px gu/hi/en, paging,
  retry, stale scopes, canonical ID, 200% text, saved action and no forged badge.
- product-publish-feedback.test.mjs adds forged-checkbox/no-IP assertions. Existing
  session-change/duplicate-submit tests now defer photo/actual write work rather
  than the removed IP request; session/no-duplicate/feedback assertions remain.
- marketplace-locale.test.mjs similarly preserves pending-write locale and session
  regression assertions without restoring the removed IP request.
- marketplace-command-http.test.mjs adds Product/Store private/privilege fields to
  actual trusted command composition negative cases: userIp, phone, mobile, WhatsApp,
  exact coords, claimed owner/seller, flags and role rejected before domain writes.
- admin-runtime-native.test.mjs adds REAL Auth/Admin/Firestore Emulator cases for
  both Product/Store commands: forged private/privileged fields return 400 and leave
  domain document/audit counts unchanged. Rate state is not authority for acceptance.

## Exact local checks

Node 26.13.0, existing pinned npm tree, local verified Java 21.0.13; CI Node24
compatibility is not newly claimed. Browser requests use loopback-only fixtures,
SDK doubles/injected transport, never the live legacy Firebase configuration.

| Command | Result |
| --- | --- |
| npm run test:emulator:safety | 108 pass, 0 fail/skip |
| npm run test:provider-draft:transaction | 232 pass, 0 fail/skip |
| npm run test:stores | 82 pass, 0 fail/skip |
| npm run test:service-providers | 196 pass, 0 fail/skip |
| npm run test:static-build | 5 pass, 0 fail/skip |
| npm run test:service-preview:browser (installed Chrome) | 103 pass, 0 fail/skip |
| npm run test:stores:browser (installed Chrome) | 32 pass, 0 fail/skip |
| node --test tests/firestore-emulator/product-publish-feedback.test.mjs tests/integration/marketplace-command-http.test.mjs | 27 pass; overlaps groups above |
| node --test tests/firestore-emulator/legacy-marketplace-read-boundary.test.mjs | final 8 pass; included in safety |
| node --test tests/browser/legacy-store-pagination.test.mjs | 4 pass; included in Store browser command |
| node scripts/run-emulator-tests.mjs admin-runtime | REAL 16 pass, 0 fail/skip |
| node scripts/run-emulator-tests.mjs product-drafts | REAL 6 pass, 0 fail/skip |
| node scripts/run-emulator-tests.mjs service-providers | REAL 37 pass, 0 fail/skip |
| Compile-only vm.Script/SourceTextModule scan | 417 JS/HTML script units pass; no app execution |
| git diff --check | pass |

Actual Emulator total in this batch: 59 pass, not mocks. Fixed demo-oldx-* project
and loopback host checks remain; no candidate/live Rules were edited. Earlier pure
policy, SDK-double, and browser executions are separate evidence, never live acceptance.
A syntax typo in a newly added test was corrected before passing; no assertion was
removed or skipped. Final related checks run after the last substantive source fix.

## Approved feature preservation

No Service Provider implementation module changed. Existing multi-service profiles,
private owner restoration, required photo workflow/galleries, sharing, enquiries,
conversation/participant flows and buyer-only review eligibility remain. The 196-case
Provider group includes self/unrelated/duplicate/cancelled/pending/guest/blocked review
denials. Store categories/gallery/share/owner form and Product stock/save/chat flows
remain. Disabled trusted ports remain disabled; no synthetic review grants or live
publication is inferred. Operational/moderation acceptance remains necessary.

## Remaining P0/P1 blockers

1. Legacy products/stores/users still mix private contact/IP/location fields with
   display data. Removing new publication IP does not remove historical values or
   the unrelated legacy sign-in/traffic IP collection. Firestore reads expose entire
   documents; browser projection/redaction is NOT a privacy boundary. Preserve deny-all.
2. Existing trusted Marketplace HTTP/repository schemas reject unknown private and
   privilege fields, derive actors from verified Auth and apply ownership/atomic audit.
   Public projections are separate. These are prepared integration components, not
   activated routes or deployed authorization. Bind only after approved schema,
   consent, compatibility, private-contact endpoint and operational acceptance.
3. Legacy sellerUid/contact/coords writes remain browser-controlled and require
   server/Rules enforcement. Canonical document IDs and disabled controls cannot stop
   a malicious alternate client. No rule relaxation, client-trusted role or backfill.
4. Homepage pagination still grows a realtime limit and rereads its prefix. Cursor
   pagination for that feed and trusted summary-based inbox reads are future work.
   Loaded Store filtering is explicit; global indexed search/ranking requires an
   approved query schema/index plan. Do not silently omit legacy products by using
   missing timestamps as a paging key.
5. Existing Admin trusted API binding, Chat retention/deletion/private-media policy,
   real Cloudinary moderation/release/revocation, backup/rollback and synthetic staging
   end-to-end acceptance remain P0. No deployed public promotion source exists.
6. Physical Android/WebView, measured low-end performance and full native-speaker
   locale/accessibility acceptance remain. Repository/browser/Emulator success is not
   launch acceptance. Keep HOLD/NO-GO.

Review and push only this branch with normal fast-forward semantics; preserve any
concurrent remote commits. Final commit SHA is reported after commit in the chat/Git log.
