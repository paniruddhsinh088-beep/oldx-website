# Media provider proof binding — review-only regression (2 November 2026)

Branch: `review/media-proof-binding-20261102` based on `9a1d13682ed7b62bf44d0617e983b2bac121e4af`; target: `security-hardening-review`.
No production/staging/provider credentials, API calls, Firebase Rules, deploy, billing, main or merge.

## Change
- `scripts/media-proof-binding.mjs` requires an injected verifier's upload/delete result to echo the exact purpose, image, nonce, private provider path, expected asset revision and source digest or provider asset ID. It rejects malformed/accessor/prototype-modified proof objects. It does not itself verify a signature, provider bytes, scanning, ownership or deletion.
- `scripts/firebase-media-journal.mjs` freezes expected claims before calling the injected trusted verifier, then rejects cross-image, cross-purpose, stale-revision or cross-lease claims as `OUTCOME_UNKNOWN`. No quota refund, asset publication or deletion occurs on a mismatch.
- Regression tests exercise both the pure matcher and the durable journal's upload/delete transaction paths; the existing full integration command includes the matcher tests.

## Evidence
- Isolated Node 22.16.0 `node --check` on the new helper/test: passed.
- Isolated Node 22.16.0 `node --test media-proof-binding.test.mjs`: 3/3 passed before commit. This is NOT a full repository test.
- Exact-source Node 24 integration and Firestore Emulator tests: check the draft PR's review-safety CI; not claimed until observed.
- Local full checkout unavailable: GitHub DNS resolution failed. No real provider/verifier exists, and no operational media release is approved.

## Remaining gate
The actual verifier must independently authenticate provider outcomes, image bytes, source digest, MIME, processing/moderation, signed provider identity and settled absence. An echo check is defense-in-depth, not trusted proof. Continue with a provider-neutral trusted processing/verification adapter and owner decisions on zero-cost storage, runtime, quotas, retention, moderation and private delivery. Release HOLD/NO-GO.
