# OLDX Staging Backend Foundation — Preflight Decision Record

**Branch:** `security-hardening-review`  
**Status:** Architecture gate; no backend code or cloud resource created.  
**Scope:** Staging only. Production V13, `main`, Firebase `oldx-1c983` and live Rules remain untouched.

## Current repository facts

- The repository has no approved Admin backend implementation.
- The current Admin page performs direct Firestore reads and has a browser-side UID gate; this is not server authorization.
- The local Firestore Emulator is loopback-only and uses an intentionally deny-all Rules file.
- The Vercel preview frontend is configured for the Firebase staging project `oldx-staging`.
- No evidence in this repository establishes an approved staging backend runtime, region, billing plan, service identity, IAM scope, secrets manager or existing external backend.

## Recommended architecture (conditional)

Prefer Firebase Cloud Functions 2nd gen **if** the owner confirms that the `oldx-staging` project has the required billing/region support and approves the runtime. It keeps token verification and Firestore access close to Firebase Auth/Firestore and avoids putting Admin SDK credentials in the browser. If billing or project policy makes that unsuitable, evaluate an owner-approved trusted server runtime separately; do not silently substitute Vercel Functions or another platform.

No choice is final until the preflight fields below are confirmed. Do not initialize Functions, add deploy scripts, create service accounts, alter IAM, enable billing, create secrets, or deploy resources as part of this record.

## Required owner-approved preflight

| Decision | Required evidence | Current state |
|---|---|---|
| Backend runtime | Explicit choice: Cloud Functions 2nd gen or named alternative | Not confirmed |
| Firebase project binding | Exact staging project ID `oldx-staging`; startup rejects `oldx-1c983` | Target known; backend binding not created |
| Region | Owner-approved region matching data residency/latency needs | Not confirmed |
| Billing | Confirmation that required staging services are enabled and cost impact accepted | Not confirmed |
| Service identity | Dedicated least-privilege staging identity; no downloaded key in repo | Not confirmed |
| IAM | Explicit minimum roles for required Firestore/Auth operations only | Not confirmed |
| Secrets | Managed secret store; no secrets in Git, browser bundle or logs | Not confirmed |
| Role source | Owner-controlled Admin role registry or verified custom claims, with revocation plan | Not confirmed |
| Audit store | Append-only server-written events and retention policy | Design only |
| Monitoring | Error, rate-limit and privileged-action alerts with privacy-aware retention | Not confirmed |

## Fail-closed implementation requirements

When the runtime is approved, the first code slice must:
1. Validate the configured project ID at process startup and refuse Production project IDs.
2. Require a verified Firebase ID token for every endpoint.
3. Resolve active roles from a server-controlled source; never trust client-supplied roles/UIDs.
4. Expose only a health/readiness response that contains no configuration values or secrets.
5. Have no deploy command in CI and no Production fallback.
6. Use synthetic fixtures and Emulator tests; do not read or write real users.
7. Keep destructive operations disabled until audit, idempotency, retention and recovery are proven.

## Go / no-go

**GO for code implementation** only after runtime, staging project binding, region, billing, service identity, IAM and secret storage are approved and documented.

**NO-GO** if any configuration could target `oldx-1c983`, if service credentials would be stored in Git/browser, or if role authorization is based only on the Admin HTML gate.

This document is not authorization to provision or deploy any cloud resource.
