# Staging Collection Pagination Readiness Audit

**Branch:** `security-hardening-review`  
**Status:** Read-only audit plan; not executed.  
**Target:** Firebase staging project `oldx-staging` only.  
**Production:** `oldx-1c983`, Production V13, `main`, and `oldxbazar.in` are explicitly out of scope.

## Purpose

Determine whether every existing document in `products`, `stores`, and (only after an ordering-field decision) `users` has a valid, consistently typed, immutable ordering value suitable for deterministic Admin pagination. Static source review is insufficient to prove legacy-record coverage.

## Preconditions — all required

- Owner explicitly approves a read-only audit against `oldx-staging`.
- The operator independently verifies the active Firebase project ID is exactly `oldx-staging`; abort on any other value.
- Use a dedicated read-only identity with only the minimum collection read permission. No service-account key is committed, pasted into chat, or written to logs.
- Use an approved region/runtime and managed credentials. Do not enable billing, change IAM, create identities, or provision resources as part of the audit.
- Record the audit request, operator, approved scope, time window, code revision, and result location in the approved audit log.
- Confirm the audit does not read or export user profile fields or document contents beyond the timestamp field and document ID needed for classification.

## Audit method

1. Start with a dry-run that reports the intended project, collection names, field name, page size, and read-only mode; it must perform zero reads.
2. For each approved collection, iterate documents in bounded pages using document ID ordering. Read only the document ID and `createdAt` field; do not export full documents.
3. Classify each document in memory as:
   - timestamp present and valid Firestore Timestamp;
   - missing;
   - present but null;
   - wrong type;
   - invalid/unreadable.
4. Maintain aggregate counters only. Do not log IDs, emails, IPs, names, raw document data, or sample user records.
5. Verify the scan reached end-of-collection and that read counts reconcile with the collection count captured at the start/end. If concurrent writes make reconciliation uncertain, mark the audit inconclusive and repeat in an approved quiet window.
6. Verify the exact composite index/query shape required by the adapter using synthetic Emulator fixtures first. A production-like index requirement is not proven by a source-code declaration alone.
7. Emit a signed or otherwise integrity-protected report containing project ID, collection, total scanned, counts by classification, timestamp type, query/index result, start/end times, tool revision, and whether concurrent changes affected confidence.

## Collection-specific policy

| Collection | Field under review | Current state | Decision |
|---|---|---|---|
| `products` | `createdAt` | New create path writes server timestamp; legacy coverage unknown | Keep disabled until full staging audit and index test pass |
| `stores` | `createdAt` | New store path writes server timestamp; legacy coverage unknown | Keep disabled until full staging audit and index test pass |
| `users` | No approved universal field yet | Reviewed profile writes do not establish `createdAt` | Do not scan or enable until owner-approved ordering strategy exists |

## Stop conditions

Abort without changing data if the project ID is not exactly `oldx-staging`, read-only permissions cannot be proven, any write permission is required, the scan would expose personal fields, rate/cost limits are unclear, or the audit cannot guarantee bounded reads. Never run this plan against Production.

## Acceptance criteria

- 100% of documents in the approved collection were accounted for.
- Every ordering value is a Firestore Timestamp with valid seconds/nanoseconds.
- The field is immutable by the application write contract.
- Query ordering and required index behavior pass synthetic Emulator tests.
- Any missing/invalid records have a separately approved remediation plan; do not silently skip them or substitute `lastSeen`, `updatedAt`, client time, or document ID as a creation timestamp.
- Owner reviews the report before the corresponding operation is added to a real runtime allowlist.

## Explicit non-authorization

This document does not authorize a scan, data migration, Rules publication, index deployment, IAM change, billing change, backend provisioning, or deployment. Until separate approval and successful evidence exist, all real Admin collection list operations remain disabled by the executor's default-deny readiness allowlist.
