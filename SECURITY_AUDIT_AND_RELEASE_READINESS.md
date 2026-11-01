# OLDX Security Audit Checklist and Release Readiness

Branch: `security-hardening-review`
Review type: source/design and synthetic-test readiness; not a live penetration test.
Status: **HOLD — not approved for runtime activation, staging deployment, or release.**

## 1. Scope and environment safety

- [x] Work is isolated to `security-hardening-review`.
- [x] Production Firebase project `oldx-1c983`, `main`, and live domain are out of scope.
- [x] Staging Firestore rules remain deny-all.
- [x] No production records, users, admin UIDs, or credentials copied to Staging.
- [x] No Storage plan upgrade, rules deployment, provider account, bucket, IAM identity, secret, billing change, or backend deployment performed.
- [ ] Owner has separately approved named backend and data decisions D1–D12. No approval currently recorded.

## 2. Source-level security coverage

- [x] Firestore collection and browser access inventory documented.
- [x] Product public/private field split and seller-consent contracts documented.
- [x] Product image reference classification and upload/lifecycle/abuse policies have synthetic tests.
- [x] Chat read receipts and unread consistency have a policy contract and synthetic tests.
- [x] Chat message ownership, attachment metadata, and mutation authorization have synthetic tests.
- [x] Chat privacy policy tests cover participant-only visibility, per-user hiding, global tombstones, bidirectional block checks, block-list ownership, bounded pagination, and safe summary projection.
- [x] Privacy preference allowlist, consent scope/ownership/revocation, and disclosure gates have synthetic tests.
- [x] Data export/deletion request state and completion gates have synthetic tests.
- [x] Account deletion reference inventory and dry-run/reconciliation contract documented.
- [x] Admin backend source review documents fail-closed gaps and unsupported operations.

## 3. CI evidence

Latest review-branch commit at this checklist creation: `827f37cdfd10623b43a9c46bbd4c4da1243e4ec2`.

- [x] GitHub Actions run `41284620905` completed successfully for that exact commit.
- [x] The workflow includes the chat privacy policy suite.
- [ ] Emulator tests are not a substitute for a full application integration test or an independent security assessment.
- [ ] Repeat the full workflow after any subsequent source change; do not infer success from an earlier commit.

## 4. Blocking items before Staging runtime

- [ ] Owner explicitly decides D1–D12 in `STAGING_BACKEND_OWNER_APPROVAL_REGISTER.md`.
- [ ] Select and document a trusted backend platform and region based on verified account eligibility and expected traffic.
- [ ] Define hard monthly spend ceiling, usage alerts, quotas, and manual disable procedure before any billable resource.
- [ ] Define least-privilege Staging-only identity and secret rotation without sharing secrets in chat or source.
- [ ] Implement verified Firebase ID token validation in the selected runtime and derive actor UID only from verified claims.
- [ ] Implement operation-specific request schemas and atomic audit-event + mutation commits.
- [ ] Complete collection-specific read/write rules and emulator tests; only then seek explicit approval to replace deny-all Staging rules.
- [ ] Resolve block enforcement in a Rules-verifiable design or trusted backend. The current synthetic policy helper does not itself enforce blocks in the deployed app.
- [ ] Verify chat, privacy, export, deletion, and account cleanup against synthetic end-to-end workflows with failure injection.
- [ ] Confirm indexes and timestamp coverage from an approved, read-only Staging audit before enabling paginated reads.
- [ ] Resolve legacy Admin UI direct reads/deletes; keep it disconnected until trusted APIs are validated.
- [ ] Confirm preview authentication and marketplace data-loading issues are diagnosed without weakening security rules.

## 5. Image/upload release gates

- [ ] Owner approves storage provider, budget, object retention, quotas, and moderation workflow.
- [ ] Private quarantine and server-side byte/content validation are implemented.
- [ ] Trusted processing creates safe derivatives; client MIME, extension, and metadata are never authoritative.
- [ ] Atomic quota reservations, idempotency, duplicate prevention, cleanup race handling, and reconciliation are integration-tested.
- [ ] Public delivery is limited to approved derivatives; deletion/revocation behavior is verified.
- [ ] No upload feature is activated while Storage billing/access or provider ownership remains unresolved.

## 6. User privacy and data lifecycle gates

- [ ] Public profile fields are explicitly allowlisted; private contact/location fields remain private by default.
- [ ] Contact/location disclosure requires specific, revocable, owner-bound consent.
- [ ] Presence and read-receipt exposure is minimized and controlled.
- [ ] Block list is private; a blocked person cannot enumerate who blocked them.
- [ ] Export links are private, expiring, owner-bound, and not publicly enumerable.
- [ ] Account deletion is asynchronous/idempotent, covers every verified data reference, and reports partial failure honestly.
- [ ] Retention, legal holds, backups, and external image deletion are documented before promising complete erasure.

## 7. Release decision

**Current decision: NO-GO.**

Do not connect the legacy Admin page to privileged endpoints, enable real upload, migrate live data, change Firebase rules, package a release build, submit to Play Store, or deploy to Production based on this checklist.

Next safe work may continue on the review branch: close source-level gaps, improve synthetic tests, and prepare owner decision evidence. Any Staging resource access, rules change, runtime provisioning, billing, secret/IAM change, migration, or deployment requires separate explicit approval. Production remains a separate future release gate and is not authorized here.
