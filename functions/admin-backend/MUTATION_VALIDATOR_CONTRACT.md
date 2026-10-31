# Mutation Validator Contract

Status: required dependency contract; not an operation schema and not enabled runtime behavior.

## Required handler boundary

For every mutation request, the handler must:

1. Require an injected `validateMutationInput` function before attempting a commit.
2. Call it with the server-selected operation and the untrusted request body.
3. Accept only an object result with `ok === true` and an own `value` property whose value is not `undefined`.
4. Pass only that normalized `value` to the atomic commit adapter.
5. Return a generic client error and never invoke commit for missing, rejected, malformed, or incomplete validation results.

A validator result such as `{ ok: true }` is incomplete: it does not prove that a normalized payload exists. A truthy inherited `value` property is also not an acceptable substitute for an own property.

## Required tests

- validator dependency absent: 503 and commit not called;
- validator rejects: 400 and commit not called;
- validator returns null, a primitive, or an incomplete success object: 400 and commit not called;
- validator returns an own normalized value: only that value reaches commit;
- forged client audit fields never become trusted commit context;
- commit failure returns a generic error without internal details.

## Current implementation note

The handler currently checks `validated.ok === true` and passes `validated.value` to commit. It has a test proving normalized values are forwarded, but the incomplete-success-result case is not yet guarded. Do not wire mutation endpoints or the legacy Admin UI until this contract, operation-specific schemas, and the trusted atomic commit adapter are implemented and tested.

This document does not authorize any mutation operation. No Firebase, Vercel, staging, or Production resources are changed.
