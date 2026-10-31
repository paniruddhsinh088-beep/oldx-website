# OLDX Admin Backend Starter (Review Only)

This directory contains framework-neutral, dependency-injected security primitives. It is **not** a deployed API and is not yet connected to Firebase Admin SDK, Firestore, Vercel Functions, or Cloud Functions.

## Local checks

Run `npm run test:admin-backend` with Node.js 20 or newer. Tests use synthetic identities and do not access a network.

## Safety contract

- Configuration guard accepts only `OLDX_BACKEND_ENV=staging` and `OLDX_FIREBASE_PROJECT_ID=oldx-staging`.
- No Production fallback is provided.
- Token verification and role resolution are injected dependencies; missing dependencies fail closed.
- Caller-supplied UID/role fields are never used for authorization.
- The authorization helper only grants an explicitly allowlisted operation to a server-resolved active Admin.
- This is not a complete HTTP server, Firebase Admin integration, audit implementation, or permission grant.

## Not implemented

No cloud resources, billing, service accounts, IAM roles, secrets, endpoints, Firestore Rules, deployment scripts, or real Admin roles are created. Before a runtime adapter is written, the owner must approve backend platform, region, billing, service identity, IAM and secret storage in `STAGING_BACKEND_PREFLIGHT.md`.

Do not import service credentials into browser code or commit credentials to this repository.

## Mutation and audit atomicity

The HTTP adapter separates read handlers from mutation handlers. Mutations require a `commitMutation` adapter that must commit the domain change and append-only audit event atomically in one trusted database transaction/batch. A separate audit write after a successful mutation is deliberately not supported because it can leave an unlogged privileged change. If atomic commit support is absent or fails, the handler returns an error and does not report success.

The adapter still does not provide transaction semantics itself. The eventual Firebase Admin/Firestore implementation must prove atomicity with Emulator integration tests before any staging rollout.

The HTTP handler passes mutation input as a nested `body` value alongside server-derived `actorUid`, `actorRole`, `operation`, and `requestId`. The nested body is untrusted and must never be spread into or merged over the server context or audit envelope. In particular, fields such as `uid`, `role`, `actorUid`, `actorRole`, `occurredAt`, `eventId`, and `outcome` are not authoritative when supplied by a client. Before implementation, each mutation operation needs a strict operation-specific schema that validates target identifiers, allowed fields, field types, lengths, and enumerated reason codes; unknown fields must be rejected. The handler now requires an injected `validateMutationInput` dependency and fails closed if it is absent; invalid input is rejected before `commitMutation` is called. This is a validation boundary, not a schema implementation: the repository does not yet define approved per-operation mutation schemas. The current handler must not be connected to a runtime or Admin UI until those schemas are reviewed and supplied. See `ADMIN_MUTATION_AUDIT_EVENT_CONTRACT.md` for the proposed event envelope and required integration tests.


## Collection readiness gate

The Firestore read executor requires an explicit `enabledOperations` allowlist from trusted server composition. It defaults to an empty list and rejects a list operation before any Firestore query unless that exact operation is enabled. This is an additional fail-closed guard, not proof that an operation is safe to enable.

Do not enable `users.list`, `products.list`, or `stores.list` in a real runtime until the matching staging collection has passed a read-only audit for complete, valid immutable `createdAt` timestamps and the required composite ordering/index behavior. Users currently has no verified universal creation timestamp; Products and Stores legacy coverage remains unproven. The integration test explicitly enables a synthetic Users fixture only to exercise cursor mechanics; it is not authorization to enable the real collection.

## Staging approval and collection audit

Before any trusted runtime or staging resource work, review `STAGING_BACKEND_PREFLIGHT.md`. It is an owner-approval gate, not authorization to provision or deploy.

Before enabling any collection read operation, review and complete `ADMIN_COLLECTION_READINESS_AUDIT.md` using an explicitly approved, read-only process against `oldx-staging` only. No scan has been run. Users, Products, and Stores remain disabled until their individual evidence and approvals are complete.

The integrated source-level findings and release blockers are tracked in `ADMIN_BACKEND_SECURITY_REVIEW.md`. These documents do not authorize Production changes, Rules publication, IAM/secret changes, migrations, or deployment.
