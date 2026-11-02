# Media proof binding — concurrent-work-safe review (2 November 2026)

This source is based on the newer `security-hardening-review` commit `b264c38a1d90eb1f9b3fd212bb9a5bc0a1b9dd4e`, preserving the Codex trusted image processor, `processedDigest` journal metadata, atomic release work, browser locale fixes and all other concurrent changes. Supersedes draft PR #9 without rewriting its history. Target: `security-hardening-review` only.

## Change
- `scripts/media-proof-binding.mjs`: fail-closed secondary validation of verifier outcome claims: purpose, image, nonce, provider path, revision, upload source digest or deletion asset ID. Rejects accessor-backed, malformed or prototype-modified proofs.
- `scripts/firebase-media-journal.mjs`: freeze expected upload/delete proof claims and refuse mismatched verifier returns as `OUTCOME_UNKNOWN`, without quota refund or asset state mutation.
- `tests/integration/media-proof-binding.test.mjs`: 3 pure Node tests, including cross-image, cross-purpose, cross-lease, revision and malformed proof cases.
- `tests/integration/durable-media-acceptance.mjs`: two transaction-level regressions for wrong-image upload and wrong-purpose delete; verifies quota/state unchanged.
- `package.json`: add the matcher tests to the existing integration suite, preserving new trusted-image-processor and media-release test commands.

## Evidence and limitations
Isolated local Node 22.16.0 helper/test `node --check` passed; `node --test media-proof-binding.test.mjs` passed 3/3. These were a local copy of the new pure helper, not a full repository run. Exact-source Node 24/Emulator evidence must come from this PR's review-safety CI; do not claim before checking. GitHub clone failed with `Could not resolve host: github.com`; no local full repo/Emulator run. The actual trusted provider proof verifier, scan authority, byte delivery and runtime are not implemented/approved; echo checking is defense in depth, not authentication.

No main, merge, live Firebase, Rules, Cloudinary, provider, credentials, IAM, deployment or billing change. No staging/production action. Release remains HOLD/NO-GO.
