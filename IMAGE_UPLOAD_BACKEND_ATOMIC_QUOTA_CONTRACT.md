# Trusted Image Upload Backend Contract — Atomic Quotas and Grant Lifecycle

Status: design contract only on `security-hardening-review`. No endpoint, Firebase Admin adapter, Storage provider, ledger collection, IAM, billing, secret, deployment or live data operation is created by this document.

## Purpose

Translate the local upload-abuse policy into enforceable server-side requirements without trusting browser-supplied identity, time, size, surface, parent ownership or quota history.

The current pure policy model is a test aid. It is not an atomic quota system and must not be called as though it were one in a deployed request handler.

## Trusted request pipeline

1. Verify the Firebase ID token with a server-side verifier; derive `actorUid` only from the verified token.
2. Accept a fixed enum surface: `product`, `store`, `profile` or `chat`. Reject unknown fields and unknown surfaces.
3. Resolve target ownership/participation from trusted database state:
   - product: caller is the authenticated owner of the draft/listing;
   - store: caller UID equals the store owner UID;
   - profile: caller UID equals the profile UID;
   - chat: caller is a current participant in the chat.
4. Validate requested file count and declared size as advisory preflight only. The trusted upload processor must later validate actual byte length, signature, decoding, dimensions and output format.
5. Generate opaque object and grant IDs on the server. Bind each grant to actor UID, surface, parent ID, object ID, maximum bytes, one upload, expiry and quarantine destination.
6. Atomically reserve quota and record the grant before returning a short-lived upload capability.
7. After upload, verify the actual object and transition it through quarantine/processing. Release unused reservations only after authoritative expiry or confirmed failure.
8. Expose only approved derivatives under the existing image lifecycle policy.

## Atomic quota ledger requirements

A future Firestore-backed adapter must implement a transactionally serialized ledger scoped to `(actorUid, surface)`. It must:

- Use server time only; ignore client timestamps and caller-provided history.
- Count every file in a multi-file request: `totalRequestedBytes = bytesPerFile × fileCount`.
- Enforce per-file bytes, request file count, per-user/per-surface grant rate and byte quota.
- Create a unique grant/reservation record in the same transaction as the quota update.
- Make retries idempotent using a server-generated idempotency key; a repeated request must not reserve quota twice or mint additional capabilities.
- Reject stale, replayed, cross-user, cross-surface, cross-parent and already-consumed grant IDs.
- Track reservation state explicitly: `reserved`, `uploaded`, `released`, `expired`, `rejected`.
- Charge actual verified bytes after processing; never trust declared bytes as proof of stored size.
- Prevent concurrent requests from both observing the same remaining quota and overspending it. A transaction conflict must retry safely or fail closed.
- Apply retention to quota event records and ensure ledger cleanup cannot erase active reservations or recent rate-limit evidence.

### Rolling-window semantics

The current local helper models a rolling 60-minute lookback. A production adapter must preserve that meaning; a fixed UTC-hour counter is not equivalent and permits boundary bursts. Use a transactionally serialized per-user/per-surface ledger with bounded recent grant events, or a separately approved atomic rate-limit service. If the selected datastore cannot provide the required atomicity under concurrency, do not enable grants.

The exact reservation/refund rules, event retention and concurrency strategy must be tested with emulator or provider integration tests before staging enablement.

## Capability security

- One capability authorizes one opaque object only; no list, overwrite, read or delete permissions.
- Expiry should be short (the current model uses 120 seconds) and must be enforced by the selected provider.
- Capability must be bound to a fixed quarantine key and maximum content length where provider support permits.
- Never place credentials, signed URLs or capability tokens in logs, analytics, browser local storage or Firestore public documents.
- A successful capability response is not proof that the object passed content validation or moderation.
- Revoke or invalidate grants on account suspension, ownership loss, chat participant removal or parent deletion where supported.

## Cleanup and quota reconciliation

A trusted scheduled worker may select candidates but must re-read authoritative metadata and object state immediately before deletion. It must use bounded batches, a grace period, idempotent deletion, audit events and bounded retries. Never delete by prefix alone.

Quota reconciliation must be a separate audited operation. It may not silently reset counters or release reservations merely because an object is temporarily unavailable. Reconcile against authoritative grant and object records; preserve a reviewable outcome for each adjustment.

## Required verification before any implementation is enabled

- Concurrent grant test: simultaneous requests cannot exceed a user's quota.
- Idempotency test: retrying the same request reserves once.
- Rolling-window boundary test: requests straddling an hour boundary still obey a true 60-minute window.
- Reservation expiry/release test: abandoned grants do not permanently consume quota after trusted expiry.
- Actual-size mismatch test: uploaded object larger than declared is rejected and quarantined.
- Cross-user/parent/surface replay tests.
- Revoked owner/removed chat participant tests.
- Cleanup race test: an object referenced after candidate selection is not deleted.
- Emulator integration test for the chosen transactional ledger and provider capability restrictions.

## Approval and release gates

Before implementation, the owner must approve backend platform/region, provider, expected traffic and costs, quota values, retention, service identity, minimum IAM, secret management and rollback. Follow `functions/admin-backend/STAGING_BACKEND_PREFLIGHT.md`.

No runtime implementation is authorized by this contract. Staging Firestore rules remain deny-all; no Storage rules deployment, Storage billing upgrade, provider account configuration, data migration or production change is permitted by this work.
