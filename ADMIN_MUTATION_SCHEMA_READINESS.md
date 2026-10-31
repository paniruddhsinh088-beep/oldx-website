# Admin Mutation Schema Readiness

Status: source inventory only. No mutation schemas are enabled by this document.

## Why operation schemas are not being invented

A strict validator must be derived from an approved operation contract and actual product data model. Guessing operation names, target fields, status enums, reason codes, or deletion semantics could authorize an unintended privileged action.

The reviewed legacy `admin.html` currently establishes one concrete Admin mutation: `deleteAdminAd(docId)`, which directly deletes a document from `products`. It does not establish a safe replacement contract, retention policy, soft-delete semantics, or an approved reason-code vocabulary. The browser UID constant in that file is not valid authorization.

The current backend handler and client starter define read operations, but do not define an approved mutation operation registry. The repository's mutation tests use synthetic `users.suspend` inputs solely to test the handler boundary; that test fixture is not evidence that user suspension is a supported product feature.

## Required owner/product decisions per mutation

Before adding a schema, record and approve:

- stable operation identifier and intended Admin role/permission;
- target collection and immutable target ID format;
- allowed writable fields and explicit forbidden fields;
- exact field types, maximum lengths, normalization rules, and enum values;
- reason-code vocabulary and whether a human-entered reason is required;
- soft-delete, archive, restore, or permanent-delete semantics;
- user-visible confirmation and impact summary;
- idempotency behavior and conflict handling;
- atomic domain-write + append-only audit event fields;
- recovery, retention, and legal-hold behavior where relevant.

## Current disposition

- `products.delete`: legacy direct-delete behavior found, but replacement schema and deletion policy are not approved. Do not implement or enable.
- `users.suspend`: appears only in synthetic handler tests; not established as a supported operation. Do not expose or enable.
- Other user/store/report moderation operations: no verified operation contracts in the reviewed Admin page. Do not invent.
- `validateMutationInput` remains a required injected dependency. Runtime and Admin UI stay disconnected until approved schemas exist.

## Safety boundary

This is documentation and source review only. No Firestore data, Rules, IAM, secrets, billing, staging runtime, or Production resources were changed.
