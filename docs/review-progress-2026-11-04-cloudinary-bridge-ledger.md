# Cloudinary multipart bridge — 4 November 2026

Baseline: clean `4352cac203dae9feb3b22c0ab23c7de2620dd263` on
`security-hardening-review`, matching fresh remote. HOLD/NO-GO remains.

Implemented `scripts/cloudinary-multipart-bridge.mjs`: default-off, isolated-test-only
server adapter for existing lifecycle `uploadProcessed`/`verifyUploadResult` ports.
No fetch, active route, browser imports, dependencies, credentials or provider calls.
Multipart request fixes the Cloudinary cloud, authenticated quarantine, processed WebP
file, signed parameters and overwrite=false. No unsigned preset or legacy change.

A bounded normalized response DTO must have matching ID/type/format/size/dimensions
and SHA256 public_id/version signature. Because that signature does NOT bind all
metadata or bytes, a separate mandatory trusted `inspectAsset` port must attest stored
asset identity AND content digest (e.g. bounded authenticated byte inspection in a
future approved backend); echoing response metadata is NOT valid implementation.
Only an opaque in-process receipt can pass lifecycle verification, bound to actor,
public ID, bytes and expiry; lease authorization is rechecked before dispatch and attach.
Progress is monotonic, ignores late/invalid callbacks, and reaches 100 only on verified
quarantine outcome. It does not imply moderation approval or public publication.

Composition uses existing atomic upload-attempt journal: concurrent/same-key requests
cannot resend; ambiguous failures retain reservation until existing trusted reconciliation.
No new retry state machine. Draft/preview/remove/replace and independent atomic photo
publication policies remain unchanged. The new bridge intentionally supplies no real
delete binding: managed delete remains fail-closed until its separate provider port exists.
Private Chat images and legacy Base64/Cloudinary images are untouched. Node crypto and
multipart creation stay server-only; existing mobile/Capacitor UI ports are unchanged.

Local focused command:
`node --test --test-isolation=none tests/integration/cloudinary-multipart.test.mjs tests/integration/cloudinary-upload.test.mjs tests/integration/isolated-media-lifecycle.test.mjs tests/integration/media-journal.test.mjs tests/integration/mandatory-photos.test.mjs tests/integration/atomic-photo-publication.test.mjs tests/integration/atomic-photo-replay.test.mjs`

**38/38 passed**, including seven new multipart cases: exact fields/response attestation,
wrong-owner/forged receipts, expiry/revocation, malformed/oversized/forged responses,
concurrent replay, unknown outcomes and cancellation. The initial new progress assertion
assumed a 20-byte fixture; corrected to the actual 21-byte fixture (5/21 = 23%).
No skipped/weakened tests. New suite included in existing transaction CI command.
Local real Cloudinary tests: ZERO; local actual Emulator tests this batch: ZERO.
No UI source changed; exact-source Review CI covers existing mobile/locale browser suites.

P0 triage remains: real Auth/runtime/rates; Provider private/public image byte delivery;
Chat deletion/retention and Admin moderation enforcement; real staging/device acceptance.
No new reproducible legacy bug found or speculative rewrite attempted in this batch.
Next smallest safe batch: signed managed-delete mock binding plus trusted reconciliation
inspection contract; never derive remote asset identity from legacy URLs. Real transport,
independent inspection, runtime/credential access, quota/retention/moderation policy and
staging isolation/rollback acceptance remain blockers. Account/credential changes,
deployment, public activation and unsigned-preset retirement require separate approval.
