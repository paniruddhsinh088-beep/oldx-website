# Mutation Validator Contract

Status: required dependency contract; no operation schemas or live mutation runtime are enabled.

## Required handler boundary

For every mutation request, the handler must:

1. Require an injected `validateMutationInput` function before attempting a commit.
2. Call it with the server-selected operation and the untrusted request body.
3. Accept only a plain record result (ordinary or null prototype), with `ok === true` and an own, data-property `value`.
4. Require the normalized payload itself to be a plain record; reject null, primitives, arrays, class instances, dates, and proxy values whose inspection throws.
5. Pass only the accepted normalized value to the atomic commit adapter.
6. Return a generic error and never invoke commit for missing, rejected, malformed, incomplete, or hostile validation results.

A validator result such as `{ ok: true }` is incomplete. An inherited or accessor-backed `value` is not acceptable. Accessor-backed status fields and hostile proxies must not escape as internal errors.

## Requirements for future operation-specific schemas

The handler boundary is not a substitute for operation schemas. Each approved validator must:

- validate every field against an explicit operation-specific allowlist, type, length, and enum;
- construct a fresh normalized payload containing only approved fields;
- avoid forwarding nested objects or arrays directly from the untrusted request;
- validate nested structures recursively and reject unexpected keys;
- never treat client-supplied actor identity, role, audit metadata, timestamps, event IDs, or audit paths as trusted;
- return a stable validation failure without exposing internal details.

A plain top-level object check does not establish that nested data is safe. The operation-specific validator must create and validate the complete payload before the commit adapter is wired.

## Required tests

- validator dependency absent: 503 and commit not called;
- validator rejects: 400 and commit not called;
- validator returns null, primitive, array, class instance, incomplete success, inherited/accessor-backed value, or hostile proxy: commit not called;
- validator throws: generic error and commit not called;
- validator returns a fresh allowlisted normalized payload: only that payload reaches commit;
- nested unexpected fields and forged audit fields never become trusted commit context;
- atomic commit failure returns a generic error without internal details.

## Current implementation note

The framework-neutral handler now rejects malformed validator result shapes, accessor-backed values, non-record payloads, and hostile inspection cases. These are boundary checks only. No concrete operation-specific schemas, trusted atomic commit adapter, Firebase Admin SDK runtime, or deployed endpoint exists yet.

Do not wire mutation endpoints or the legacy Admin UI until owner-approved operation contracts, complete schemas, and the trusted atomic commit adapter are implemented and tested.

This document does not authorize any mutation operation. No Firebase, Vercel, staging, or Production resources are changed.
