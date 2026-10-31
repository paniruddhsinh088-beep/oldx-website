# Admin Collection Readiness Audit Plan

Status: read-only audit design only. No Firebase connection or collection scan has been performed.

## Purpose

Determine whether each collection can safely support deterministic Admin pagination ordered by `createdAt DESC, documentId DESC`. This audit must not read or export unnecessary personal data and must not modify documents, indexes, Rules, or project configuration.

## Collections and current evidence

| Collection | Required cursor field | Current source evidence | Readiness |
|---|---|---|---|
| `users` | `createdAt` | No universal creation timestamp was found in reviewed client write paths | Blocked |
| `products` | `createdAt` | New product creation writes server timestamp; legacy coverage unverified | Blocked pending scan |
| `stores` | `createdAt` | New store creation writes server timestamp; legacy coverage unverified | Blocked pending scan |

A source-code search is not proof of the contents of existing documents. Do not infer missing timestamps from `lastSeen`, `updatedAt`, document IDs, or client clocks.

## Audit prerequisites

Before any scan:
- Obtain explicit owner approval for a read-only scan of exactly `oldx-staging`.
- Use a dedicated staging identity with read-only access to only the three named collections.
- Verify the active project ID in the trusted process and abort unless it is exactly `oldx-staging`.
- Do not use Production credentials or fallback configuration.
- Confirm scan limits, cost ceiling, and time window with the owner.
- Do not write, backfill, repair, delete, or export documents during this audit.

## Required aggregate checks per collection

For each collection, record only:
- total documents examined;
- count with `createdAt` present;
- count with a valid Firestore Timestamp type;
- count with missing, null, wrong-type, or malformed values;
- count whose timestamp is outside acceptable bounds, if policy defines bounds;
- scan completion status and whether pagination covered the full collection.

Do not log document bodies, emails, names, phone numbers, IP addresses, addresses, or other user fields. If exceptions require sample inspection, stop and obtain separate approval; do not put personal data in CI logs.

## Index and query verification

- Confirm the exact composite ordering required by the query: `createdAt DESC` followed by document ID descending.
- Verify required index state using metadata/read-only tooling.
- Run a bounded staging-only query with synthetic or approved test fixtures after timestamp coverage is known.
- Test equal timestamps, cursor continuity, no duplicates, no omissions, and the maximum page size.
- Do not create or change indexes without separate approval.

## Decision rules

- Any missing or invalid timestamp blocks enabling that collection.
- Partial scans, permission errors, uncertain project identity, or index uncertainty are not a pass.
- Users remains disabled until an owner-approved trusted timestamp strategy is defined for legacy records. Never backfill from client-controlled values.
- Products and Stores remain disabled until full staging coverage and index verification pass.
- Passing the audit is necessary but not sufficient: explicit owner approval and a trusted runtime readiness allowlist are still required.

## Output template

Record aggregate counts, scan timestamp, verified project ID, tool/version, query/index evidence, errors, and reviewer. Do not include document contents or secret values.

## Current result

Not run. No staging data has been read, changed, or migrated.
