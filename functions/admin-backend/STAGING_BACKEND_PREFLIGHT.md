# Staging Backend Preflight (Approval Gate)

Status: planning only. No staging resources have been accessed or changed.

## Non-production boundary

- Target project, if later approved: `oldx-staging` only.
- Production project `oldx-1c983`, production branch `main`, and `oldxbazar.in` are explicitly out of scope.
- This document does not authorize deployment, billing changes, IAM/service-account changes, secret creation, Rules publication, data migration, or writes.

## Required owner decisions before runtime work

The owner must explicitly approve each item before implementation or provisioning:

1. Backend platform and exact staging region.
2. Expected usage and any billing/egress/storage implications.
3. Dedicated staging service identity and minimum required IAM roles.
4. Secret storage mechanism and rotation/incident process.
5. Allowed staging Firebase project ID, verified at runtime as exactly `oldx-staging`.
6. Data access scope and retention requirements.
7. Rollback and incident contacts.

Do not request or paste secret values, private keys, service-account JSON, access tokens, or passwords into chat or GitHub. Use the approved secret manager directly.

## Mandatory technical gates

- Verify the deployed project ID from trusted server configuration; fail closed unless it is exactly `oldx-staging`.
- Use a dedicated least-privilege identity; never reuse a Production service identity.
- Keep all credentials server-side; no browser bundle or repository secrets in source.
- Keep Firestore Rules, IAM, and data unchanged during a read-only audit.
- Start with metadata and aggregate-only audit output; never export user records or personal fields.
- Add explicit operation allowlist only after collection-specific audit and owner approval.
- Prove authentication, role revocation, query scope, field projection, pagination, and audit behavior in staging before any rollout.
- Maintain a tested rollback path and verify Production isolation.

## Current status

No runtime adapter, endpoint, service identity, IAM grant, secret, deployment, or staging data scan is present or authorized by this plan.
