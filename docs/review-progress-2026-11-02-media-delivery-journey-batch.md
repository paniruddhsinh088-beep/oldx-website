# Durable media/delivery and portable journey batch — 2 November 2026

Reviewed AGENTS, current roadmap/Android/launch/feature/security/approval records,
photo architecture and `1b2f20c8` / `d1a49c4d`. Clean starting HEAD and fresh remote
both `d1a49c4dce1b29e582a4f35fd0f90b799727206d`. Existing checkpoints and automation
preserved; no concurrent change initially found. Managed network remains restricted.
No live Firebase/Cloudinary, credentials, resource, deployment or billing action.

## Completed source

- Durable Emulator-locked journal: atomic global/user/parent quota + lifetime reservation
  caps, asset/attempt/nonces, private registry, scoped idempotency/audit, lost-ack handling,
  pending upload reconciliation, no-reference delete leases, settled-absence refund and
  explicitly authorized aged owner-scoped orphan recovery. Proofs are injected trusted
  test authority; no real provider call, decoder/scanner or background worker.
- Trusted public Product/Store media snapshot/projection and private Chat/profile
  token/redemption contracts. Only explicitly approved derivative IDs are public;
  no private/public URL fallback. No actual token signer, bytes or delivery gateway.
- Existing owner binding now exposes a platform-neutral disabled buyer port sharing
  session/scope/page cleanup. Mock and actual SDK acceptance connect private create/
  read/cancel through existing HTTP/repository composition. Original request envelope
  is retained through unknown/offline retry; private notes never enter public observers.
- Product/Store archive atomically hides public views and advances generation while
  retaining legacy private photos/text and preventing silent resurrection.
- Reproduced/fixed legacy Chat oldest-window bug: latest bounded 35 messages are now
  queried descending and rendered chronologically from a copy. No auth/rules/send
  controls changed or claimed secure merely because messages render correctly.
- Static packaging/Node import/mobile tests check new client code without browser
  globals and keep all server crypto/SDK modules out of web/native bundles. No Android
  packaging or platform-only dependency. Existing localization/review/moderation/share
  and whole-product requirements remain; untranslated remaining journeys are still P0.

[Implementation/limitations](durable-media-journal-delivery-contract.md) distinguishes
actual journal metadata from provider execution, private associations from public
release, tokens from byte delivery, owner-scoped cleanup from service workers and
portable source checks from real Android acceptance. Nothing here approves runtime.

## Verification / continuation

Focused media, delivery, client and archive tests passed. One full 34-command local
non-emulator sweep passed. Final review hardened quota lifetime accounting, strict
replay DTOs, malformed-receipt rejection and proof tokens; affected media cases and
the 70-case integration command were rechecked, without repeating unchanged browser
suites. New actual SDK Emulator scenario reuses the same media sequence; CI results
are recorded after completion. Local Emulator downloads remain blocked, no bypass.

| Command | Passed |
| --- | ---: |
| `npm run test:emulator:safety` | 82 |
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
| `npm run test:service-preview:browser` | 27 |
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
| `npm run test:provider-draft:transaction` | 70 |

Next highest-impact repository batch: trusted processor/proof verification adapter and
atomic public media-release snapshot writer, private Chat membership/delivery bridge,
and remaining full-journey UI/locale bindings. Still need operational owner choices
(runtime/identity/schema/index/role/quota/cleanup/privacy/retention/media) and separate
staging action/rollback approval. No live/provider/Rules/index/IAM/secrets/billing/Vercel/
deployment/main/merge/migration/Full Reset action. HOLD/NO-GO and deny-all unchanged.
