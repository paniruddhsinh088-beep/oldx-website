# Notification provider/device and staging acceptance — HOLD

7 November 2026. Offline preparation only. Worker transport remains recording-only;
none of these checks grant deployment, account, billing, IAM or credential approval.

- **Identity/registry:** choose the real worker credential verifier/principal and
  confirm issuer/audience/revocation and server-owned registry administration.
  A verified ordinary user or client role claim must not grant worker permission.
  Emulator verified/disabled-token evidence is not production workload identity acceptance.
- **User preferences:** bind existing user/schema data explicitly. Missing new v1
  choices mean opt-out; unknown versions fail closed. Owner identity comes from
  verified credentials, never target UID in the body. Verify opt-out across devices,
  stale opt-in retries, CAS conflicts, lost acknowledgments and audited no-ops.
- **Content/consent:** generic recording envelopes contain no message text. Stored
  full-preview preference is not enabled full-content delivery. Recheck participants,
  both block mappings, current inventory/read cursors, canonical account eligibility,
  preferences and worker permission at every delivery checkpoint.
- **Device registration:** separately verify user-to-device ownership, permission
  denial/regrant, token rotation, logout/account-switch cleanup and bounded removal
  of invalid tokens. Test supported browsers and Capacitor Android foreground,
  background, offline, retry and navigation behavior without exposing private payloads.
- **Provider reliability:** test provider-supported idempotency, unknown/delayed
  acknowledgments, lease expiry, duplicate attempts, retry limits and consent races.
  Recording deduplication alone does not prove real provider/device exactly-once delivery.
- **Staging:** independently verify exact project, deployed Rules, complete source/
  account/preference/block mappings and writer fencing; approve actual schema and
  permission bindings. Keep transport disabled until acceptance and explicit approval.
  This batch reads no live user data or provider/device tokens.
- **Operations/cost:** retain bounded batches and audit integrity; measure polling,
  authentication latency, rate-limit contention, receipt/audit retention and actual
  provider bandwidth/capacity. Owner preference admission consumes actor/global quota
  even on retries. Budget alerts are not an assumed hard spending cap.

Current repository evidence: isolated canonical Chat + recording worker and owned
preference ports; real local Firestore/Auth Emulator identity tests. No live runtime,
provider registration, device binding, deployment or production readiness claim.
