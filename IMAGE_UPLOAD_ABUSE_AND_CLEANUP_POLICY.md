# Image Upload Abuse Prevention and Cleanup Policy (Draft)

Status: review-branch policy model only. No runtime enforcement, provider configuration, Firebase access, Storage access, billing, migration or deployment is included.

## Guardrails represented by the local model

| Surface | Files per request | Max bytes per file | Rolling one-hour bytes | Grants per hour |
|---|---:|---:|---:|---:|
| Product | 6 | 5 MiB | 30 MiB | 12 |
| Store | 1 | 5 MiB | 5 MiB | 4 |
| Profile | 1 | 2 MiB | 2 MiB | 4 |
| Chat | 1 | 3 MiB | 9 MiB | 12 |

These are draft engineering limits aligned with the existing upload-policy proposal, not approved product or billing limits. The backend must count the aggregate bytes for every file in a request, scope quotas by authenticated UID and surface, and use a trusted clock. A caller must never choose its own UID, quota, surface policy or creation timestamp.

## Upload grant requirements

- Authenticate the user and derive UID from the verified session/token.
- Verify ownership/participation of the target product, store, profile or chat before issuing a grant.
- Issue a short-lived, single-object capability (model uses 120 seconds); bind it to one opaque object ID, one surface and one parent.
- Enforce per-file bytes, file count, rolling byte quota and grant-rate quota server-side and atomically.
- Re-check actual uploaded bytes, decoded dimensions, file signature and content before approval; client metadata is advisory only.
- Do not log signed URLs, capability tokens, image payloads, private coordinates or phone numbers.
- Rate-limit grant creation and reject replay or cross-user/cross-parent object substitution.

## Quarantine cleanup

The local selector considers only objects in `quarantined`, `orphaned` or `rejected` states older than a 24-hour grace period. It excludes approved, referenced and published objects and emits at most 100 candidates per batch.

A real cleanup worker must, immediately before deletion:
1. Re-read authoritative metadata and storage object state.
2. Confirm the object is still eligible, unreferenced, unpublished and outside the grace period.
3. Use an idempotent delete operation; treat already-missing objects as completed.
4. Record an audit event containing opaque object ID, reason and outcome, never signed URLs or payloads.
5. Retry transient failures with bounded backoff and dead-letter repeated failures.

Never delete by broad prefix alone. Never infer that an object is orphaned solely because a client omitted a reference. Protect published derivatives and all objects referenced by live records. Retain an audit trail for policy decisions.

## Important limitation

The JavaScript module and tests are pure policy models. They do not authenticate users, maintain an atomic distributed quota ledger, inspect actual file bytes, query a database, find real orphans, or delete objects. Those controls require a trusted backend and provider-specific implementation, which remain out of scope pending explicit approval and provider/budget decisions.
