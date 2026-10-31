# OldX Staging Firebase — Read-only Audit Checklist

**Status:** Preparation checklist only. No Firebase project was accessed or changed while preparing this document.
**Target:** Staging project only (`oldx-staging`).
**Explicit exclusions:** Production project `oldx-1c983`; all writes, deployments, migrations, billing changes, IAM changes and user-data access.

## 1. Purpose

Before connecting the Service feature to Firebase, establish what is actually deployed in Staging. Repository fixtures and emulator tests are not evidence of deployed project configuration.

## 2. Safe access method

Use a Firebase Console account with the minimum read-only permissions needed to view project configuration, Firestore Rules, Storage Rules and indexes. Do not grant Owner, Editor or deployment permissions for this audit.

If console access cannot be granted, an authorized project owner can provide the specific non-secret exports listed below. Do not share service-account JSON, private keys, access tokens, passwords, recovery codes or unrestricted user-data exports.

## 3. Required read-only evidence

Record the observation date and confirm the project ID shown in the Console is exactly `oldx-staging`.

### Project and environment
- Project ID and display name.
- Firebase products currently enabled (Auth, Firestore, Storage, Functions, Hosting).
- Firestore database location and mode, if visible.
- Storage bucket name and location, if visible.
- Existing Functions regions/runtime and deployment status, if any.
- Whether billing is enabled and the current plan label; do not change it.

### Firestore
- Exact currently published Firestore Rules text and last-published timestamp, if available.
- Database location and any named databases.
- Existing composite indexes and their states.
- Authentication providers enabled (provider names/status only; no user list).
- Whether App Check is configured and enforcement status by product.
- Any existing Functions that appear to mediate writes to protected collections.

### Storage
- Exact currently published Storage Rules text and last-published timestamp, if available.
- Bucket location and current security configuration.
- Whether App Check enforcement is enabled for Storage.
- Existing upload-related Functions or lifecycle policies, if any.

### Runtime and operations
- Existing Functions runtime generation, region, memory/timeout settings and deployment state.
- Existing logs/monitoring/alerts configuration at a high level only.
- Existing Hosting targets/sites and whether Staging is isolated from Production.

## 4. Do not collect

- Customer/provider personal records or document contents.
- Phone numbers, email addresses, chat messages or enquiry bodies.
- Authentication user exports.
- Service-account keys, API secrets, OAuth tokens or credentials.
- Billing payment details.
- Production configuration or screenshots containing Production data.

## 5. Review output

The audit report should classify each finding as:
- **Confirmed safe for proposed test** — backed by current deployed evidence and tests.
- **Needs correction** — a specific risk is evidenced.
- **Unknown** — not visible or not supplied; never assume safe.

The report must distinguish deployed configuration from repository files and emulator fixtures. It must not recommend deployment until a separate change plan, test evidence and explicit approval exist.

## 6. Change boundary

This checklist authorizes no changes. During the audit:
- Do not edit or publish Firestore/Storage Rules.
- Do not create or deploy Functions, indexes, buckets or Hosting targets.
- Do not alter IAM, App Check, Authentication providers or billing.
- Do not read, create, edit or delete user records or files.
- Do not access the Production project.

## 7. Audit completion gate

Service backend implementation remains blocked until the actual Staging evidence has been reviewed, the proposed data boundaries and authorization model have been mapped to deployed configuration, and a separate implementation plan is explicitly approved.
