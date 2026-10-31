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
