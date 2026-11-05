# Chat Unicode draft safety — 2 November 2026

**Review-only source change.** Base: `security-hardening-review` at `967dd8de`. Feature branch: `review/chat-unicode-draft-safety-20261102`; target is `security-hardening-review` only. No merge, live backend, Firebase, Rules, Vercel, secrets, paid resource or deployment.

## Reason and scope

The existing shared `normalizeMessageDraft` is used by the **synthetic** Service buyer/provider conversation preview. It already rejected markup/C0/C1 controls, empty drafts and more than 2,000 UTF-16 code units, normalized to NFC and trimmed edges. However, lone UTF-16 surrogates and explicit Unicode bidi embedding/override/isolate controls were accepted. Those controls can produce misleading visual message order, especially in multilingual previews.

This review patch rejects U+202A–U+202E and U+2066–U+2069 plus unpaired surrogate code units. It retains existing public function shape, 2,000-code-unit limit, plain-text policy, NFC and whitespace behavior. Gujarati/Hindi combining marks, Indic ZWJ/ZWNJ, ordinary line breaks and valid emoji pairs remain supported. It deliberately does **not** strip or translate user text. No trusted send authorization, moderation or identity is claimed.

## Regression evidence

- Isolated source copy from the exact branch base, patched locally: `node --check features/chat/message-text.mjs` — passed on Node 22.16.0.
- `node --check tests/service/chat-message-text.test.mjs` — passed on Node 22.16.0.
- `node --test tests/service/chat-message-text.test.mjs` — **8/8 passed** on Node 22.16.0. Cases include gu/hi/emoji/Indic joiners, NFC, newline, markup/control rejection, bidi controls, lone surrogates, code-unit boundaries and object-coercion avoidance.
- Repository clone unavailable in this environment because `github.com` DNS could not resolve. Full local repository tests and actual Firebase Emulator tests **not run locally**.
- The new test lives under `tests/service/` and is picked up by existing `npm run test:service-preview` in review-safety PR CI; record exact-source CI separately after it runs.

## Review/acceptance

This change only affects the synthetic shared draft helper, not legacy live Chat or real backend. Product decision: rejecting explicit bidi control characters is a conservative preview safety policy, not a blanket prohibition on Arabic/RTL languages. If future messaging needs direction controls, use a reviewed rendering/isolation strategy and server-side policy rather than silently relaxing validation. No backend should trust this client-side validator for authorization or size enforcement.

Before any real Chat launch: verify authenticated membership/block state and rate/size limits server-side, retention, deletion, moderation, text/attachment lifecycle and three-language mobile accessibility. HOLD/NO-GO remains.
