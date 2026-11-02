# Launch-path enquiry and atomic media journal batch — 2 November 2026

Reviewed AGENTS, current remote/history, `1d63e326`/`31021b42`, feature matrix, Product/
Store/Service/security/Android roadmaps, release gates, owner decisions/approval
records, photo audit and existing legacy/adapter source. Clean starting HEAD and fresh
remote both `31021b42e0491b953b6392119a57b72d0fe7d617`; no concurrent changes found.
All earlier commits/automation are preserved. Network remains restricted; no credential
or provider account readiness is assumed. No paid dependency/install or live data use.

## Implemented

- Default-disabled private Provider enquiry creation transaction and existing HTTP
  composition operation: verified actor, current account/provider ownership/publication/
  block graph, discovery dataset generation, normalized service/note validation,
  unique actor/key receipt, atomic private record + minimal audit, safe unknown outcomes.
  UID-derived participant read projector reuses existing canonical enquiry DTO/state
  validation. No automatic completion/review grant and no new page or state machine.
- Mock composed acceptance: v1 opaque owner draft -> publication -> bounded discovery
  with two differently versioned Providers -> private buyer/provider enquiry -> withdrawal.
  No actual enquiry SDK namespace or persistence implementation is claimed. Actual
  Provider SDK Emulator evidence is separately reported via CI, not this mock sequence.
- Test-only single-process media journal: atomic quota reservations, upload attempts,
  reference/replacement/delete leases, revisions, idempotency and uncertain-outcome
  reconciliation. Late/unknown upload absence does not refund until settled-operation
  proof. Referenced/published/pending-reference assets cannot be deleted. Publication
  and deletion require independent current authorization. Atomic Store replacement
  preserves old content until swap; bounded staging does not expand attached photo caps.
- Inactive Product/Store/Provider-profile/Provider-service photo compatibility contracts
  preserve legacy Base64/Cloudinary/external references and flag required visibility review.
  No URL-based remote deletion, rewriting, fetching, migration, Service v1 schema change
  or provider execution. Upload replay after attachment retains the original asset ID.
- Verified legacy Search blocker fixed: missing/non-string title/category/location no
  longer throws and breaks autocomplete/catalogue. Tests execute the extracted actual
  helper with malformed records and Gujarati/Hindi/English text. No automatic translation.
- [Concrete P0/P1 launch register](launch-decision-register-2026-11-07.md) preserves all
  requirements, names shortest dependencies, actual remaining source/integration work,
  exact owner decisions, staging tests and conditional Nov 3–7 checkpoints. No launch
  guarantee, release activation or feature removal.

[Technical contracts/limitations](media-journal-and-enquiry-integration-contract.md)
separate in-memory atomicity from durable/distributed transactions, mocked credentials
from actual identity, and proposed media from the existing approved text-only schema.
Legacy Login/Product/Store/Chat/Admin source was rechecked: mixed private/public docs,
client-selected write fields, unsigned Store photos, Base64 Chat size/privacy, and
untrusted Admin direct access remain release blockers. Fixing those requires trusted
integration and approval, not permissive Rules or broad rewrites.

## Verification / continuation

Focused new media/enquiry/search tests pass. Initial composed fixture compared a
publication's nonexistent `generation` field; corrected to the existing canonical
`publicationEpoch`, then explicitly added differing row/dataset version acceptance.
No failing assertion was removed or weakened. One full non-emulator regression sweep
and exact-source CI results follow below. The small atomic photo-swap follow-up was
verified with focused media tests; unchanged expensive suites are not rerun needlessly.

Next highest-impact safe batch: implement isolated emulator-locked private enquiry
persistence/read mapping with canonical owner/publication/blocks and durable receipt/
audit acceptance, then managed photo parent-revision attachment composition. No new
synthetic page. Actual staging still needs concrete runtime/identity/schema/role/quota/
privacy/retention/media decisions and separately approved Rules/index/deployment/
rollback. Existing full-product requirements remain; first Service text slice is only
an intermediate staging milestone. No live Firebase/Cloudinary, provider settings,
Rules/index deployment, IAM/secrets, billing, Vercel changes, migration, main/merge,
production/staging deployment or Full Reset. HOLD/NO-GO and deny-all remain.

## Local test evidence

All 34 non-emulator commands passed once in the combined sweep; the final integration
command includes 63 cases. Focused media swap recheck passed 9 cases. Exact counts:

| Command | Passed |
| --- | ---: |
| `npm run test:emulator:safety` | 79 |
| `npm run test:profile-migration` | 11 |
| `npm run test:admin-backend` | 115 |
| `npm run test:firebase-config` | 6 |
| `npm run test:product-migration` | 11 |
| `npm run test:product-category` | 8 |
| `npm run test:product-image-classifier` | 9 |
| `npm run test:image-upload-contract` | 8 |
| `npm run test:image-lifecycle` | 8 |
| `npm run test:image-upload-abuse` | 12 |
| `npm run test:inbox-summary` | 5 |
| `npm run test:chat-read-receipt` | 5 |
| `npm run test:chat-message-authorization` | 32 |
| `npm run test:account-deletion` | 7 |
| `npm run test:privacy-policy` | 12 |
| `npm run test:data-requests` | 7 |
| `npm run test:chat-privacy` | 9 |
| `npm run test:chat-block-policy` | 12 |
| `npm run test:chat-private-user-state` | 9 |
| `npm run test:service-providers` | 191 |
| `npm run test:emulator:guard` | 10 |
| `npm run test:service-preview` | 13 |
| `npm run test:service-preview:browser` | 24 |
| `npm run test:static-build` | 3 |
| `npm run test:i18n` | 11 |
| `npm run test:toolchain` | 2 |
| `npm run test:stores` | 81 |
| `npm run test:stores:browser` | 28 |
| `npm run test:stores:preview` | 3 |
| `npm run test:service-inbox:browser` | 7 |
| `npm run test:service-buyer:browser` | 6 |
| `npm run test:service-conversation:browser` | 7 |
| `npm run test:service-discovery:browser` | 6 |
| `npm run test:provider-draft:transaction` | 63 |

Local actual Emulator suites were not run: official binary-host access remains
blocked by environment policy; no bypass or mirror attempted. Exact-source GitHub
Emulator evidence is pending below. `git diff --check` passes. No dependencies added,
no package-lock, deployment config or Rules changes.
