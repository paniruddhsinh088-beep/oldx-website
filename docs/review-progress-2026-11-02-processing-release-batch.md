# Trusted processing and atomic media release batch — 2 November 2026

Read uploaded request, AGENTS, roadmaps/launch/approval/photo/Android records and
`d495220b`/`9a1d1368`; clean HEAD and fetched remote both
`9a1d13682ed7b62bf44d0617e983b2bac121e4af`. Preserved prior/canonical automation
history. Cloud runtime/network checks remain restricted; no credential or provider
readiness inferred. Public documentation research only, no provider API/account action.

## Completed implementation

- Default-disabled real JPEG/PNG/WebP decode, bounded re-encoding/compression,
  orientation/alpha preservation and verified EXIF/GPS/XMP/IPTC/ICC removal, source/
  processed SHA-256, cancellation/deadline and bounded concurrency. Pinned free sharp
  0.35.5 dev dependency; native modules excluded from browser/Capacitor assets. A
  missing content scan remains awaiting-scan/false, never a fabricated approval.
- Inactive SDK moderation and atomic Product/Store release/withdrawal with independent
  current roles, owner/publication/revision/hash checks, current moderator approval,
  stable receipts/audit/generation and separately retained published references.
  Private edits preserve last published image; reject/pending moderation withdraws
  it atomically. No real Cloudinary public copy, URL, scanner or byte gateway.
- Journal now retains verified processed hash for release contracts; legacy metadata
  without it is not automatically promoted by the new release writer.
- Corrected previous Chat render-loop integration defect and added an executed
  actual-listener ordering regression. Dynamic first-party Chat labels now localize
  in gu/hi/en without touching authored messages. Added 320px/processed WebP fixture
  browser regression. Existing Product/Store/Service/Chat/Admin/features preserved.
- Refreshed Cloudinary Free limits/signature/abuse/runtime findings from official
  sources. Vercel Hobby commercial eligibility is a concrete unresolved runtime gate,
  not permission to change plan or spend. Native build/Play work remains unstarted.

[Implementation/limits](trusted-processing-and-media-release-contract.md) and refreshed
[photo audit](photo-storage-audit-and-inactive-adapter-2026-11-02.md) distinguish real
codec work, synthetic scan authority, actual isolated SDK metadata, and live readiness.
Provider private photo processing/moderation scope is supported; Provider public-photo
release/read extension and full end-to-end UI/runtime acceptance remain incomplete.
All agreed requirements remain, including verified buyer reviews/moderation.

## Validation

Focused processor/release and actual Chat callback/browser tests passed. A broader
sweep preceded the final generated-WebP browser case; final-source comprehensive
non-emulator results are recorded below. The actual Emulator scenario reuses real
codec-generated metadata with synthetic scan/role authority; CI evidence follows.
Local actual Emulator download remains blocked; no bypass/mirror or false local claim.

All 34 commands in the final broader sweep passed. A final Provider-private photo
moderation fixture extension passed the focused release suite; it confirms v1 keys
are unchanged and Provider public release remains rejected by this contract.

| Command | Passed |
| --- | ---: |
| `npm run test:emulator:safety` | 83 |
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
| `npm run test:service-providers` | 196 |
| `npm run test:emulator:guard` | 10 |
| `npm run test:service-preview` | 13 |
| `npm run test:service-preview:browser` | 29 |
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
| `npm run test:provider-draft:transaction` | 76 |

`npm audit` reported 13 moderate development-toolchain advisories, zero high/critical,
and no reported sharp/@img advisory. This is not a native-code CVE certification;
existing CLI findings remain tracked, no forced override/major upgrade was made.
Sharp native prebuilt loading and tests passed with installation scripts disabled.
`git diff --check` passed. No deployment/config/Rules or paid dependency added.

Next highest-impact source batch: Provider public-media release/read extension and
trusted scan/proof/private quarantine upload composition, then remaining real UI,
locale, review/moderation and security/device acceptance. Actual runtime/provider
schema/identity/rate/quota/privacy/retention and separate staging actions still need
owner approval. HOLD/NO-GO remains; dates are targets, not guaranteed acceptance.

## Exact-source delivery / CI

Feature source `b264c38a1d90eb1f9b3fd212bb9a5bc0a1b9dd4e` passed 3/3 workflows:
- [Branch security 41500612830](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41500612830)
- [Service SDK/Rules Emulator 41500612806](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41500612806)
- [Review safety 41500612835](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41500612835)

Final hardened source `66d34d891c8dd7ef861d2c207f3cae5d1fbdbe63` adds immutable
moderation decision/from-revision/revoked-scope/generation audit fields and assertions,
plus SDK workflow path coverage for the new server modules and shared fixtures.
Focused release tests passed 2/2. Its applicable exact-source workflows passed:
- [Service SDK/Rules Emulator 41501193483](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41501193483)
- [Review safety 41501193442](https://github.com/paniruddhsinh088-beep/oldx-website/actions/runs/41501193442)

Branch Security did not trigger for that narrow follow-up under its existing path
filter; it passed on the feature source above. Do not describe it as a third final-
source run. Review safety still runs the relevant Admin/Chat/safety regressions on
the final source. No unchanged expensive LOCAL browser suite was repeated for the
follow-up. Expanded SDK path filtering ensures future server-only changes get actual
SDK Emulator validation, rather than relying on an unrelated package/feature change.

Actual SDK/candidate Rules runtime now passes 28 cases, including the real generated
codec metadata + independent moderation + atomic release/private edit preservation/
revocation/withdrawal sequence. It also tests Provider-private service-photo moderation
without adding v1 photo fields or allowing Provider public release. Scan/permission
records are synthetic isolated authority, not live scanner/provider/IAM evidence.
Local 34-command sweep, 76 integration cases, 29 browser cases and actual CI Emulator
results are separately identified; no local actual Emulator claim.

Remote remained unchanged before normal source pushes; original `37209fd`, canonical
automation `58356e2`, `d495220b`, `9a1d1368` and all prior history preserved. No concurrent
work needed overwrite/force-push/merge. No live Firebase/Cloudinary, Rule/index/IAM/
secret/billing/Vercel config/deployment, migration, main or native packaging action.
This final documentation follow-up changes no verified executable source. HOLD/NO-GO.
