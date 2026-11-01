# OLDX Zero-Cost-First Development Automation Plan

Status: operating plan for the review branch. This document does not enable paid services, grant new permissions, deploy code, or authorize Production/Staging changes.

## Owner priorities

All work on OLDX must prioritize, in order:

1. Security and protection of user/admin data.
2. Fast, smooth, responsive and accessible user experience.
3. Simple, predictable user journeys and clear error/recovery states.
4. Admin-friendly workflows with safe defaults, clear permissions and auditability.
5. Maintainable, modular code and centralized configuration so future edits are easy.
6. Bug prevention, regression coverage and performance checks.
7. Required features from the previously agreed OLDX roadmap, without silently dropping scope.
8. Zero additional cost wherever technically practical.

No cost saving may weaken security, data integrity, accessibility or release quality.

## Automation that is already present

The review branch has a GitHub Actions workflow at `.github/workflows/oldx-review-safety.yml`.

It runs on:
- Pushes to `security-hardening-review`.
- Pull requests targeting `main`.
- Manual `workflow_dispatch`.

The workflow uses read-only repository permissions and runs local policy/source checks plus Firebase Emulator authorization suites. It does not deploy Firebase rules or application code. It uses GitHub-hosted runners, so execution is subject to the repository/account's included Actions allowance and current GitHub terms.

The chat block policy model test is included in the workflow so that the new security test cannot be accidentally omitted from routine CI.

## What automation can and cannot do

### Safe to automate

- Run dependency-free unit/policy tests after each relevant commit.
- Run Firebase Emulator tests against demo project IDs only.
- Check formatting, static source invariants, dependency/security advisories and build output when a verified local build command is available.
- Produce CI pass/fail evidence and stop progression when a required check fails.
- Keep architecture decisions, migration plans and release checklists version-controlled.
- Use bounded, non-destructive checks and deterministic scripts.

### Not automatically authorized

- Deploying to Staging or Production.
- Changing Firebase Rules, Auth settings, Storage settings or live data.
- Running data migrations or deleting legacy records.
- Creating paid resources, enabling billing or exceeding free quotas.
- Creating service accounts, IAM grants, secrets, tokens or privileged backend identities.
- Publishing an Android app or submitting a Play Store release.
- Merging to `main` or changing the live website.
- Enabling an AI coding agent with repository write permissions unless its access, cost and scope have been explicitly reviewed.

GitHub Actions is a CI/test runner, not an autonomous software engineer. It can validate code and run scripts, but it does not independently design and safely implement the entire app. Any AI coding agent is a separate capability and may have plan limits or paid usage.

## Zero-additional-cost operating rules

- Prefer tools and allowances already available to the owner.
- Do not add a new paid dependency, hosting service, database, queue, monitoring product or AI subscription just to automate a task.
- Do not add frequent scheduled CI runs without a concrete security or maintenance benefit; meaningful commits, pull requests and manual runs are the default triggers.
- Avoid unnecessary full rebuilds and repeated dependency installation where safe caching can reduce minutes.
- Keep workflows bounded with timeouts and least-privilege permissions.
- If a free allowance is exhausted, pause automation and report it. Never silently switch to paid usage.
- Before adding a service that may incur cost, verify its current free limits and account eligibility; do not assume a free tier is permanent or suitable for commercial production.

## Work intake and progression

For each work item:

1. Link it to an agreed roadmap feature, bug, performance issue or security finding.
2. Define acceptance criteria and user/admin impact before implementation.
3. Prefer small, reviewable changes on `security-hardening-review`.
4. Add or update automated tests for the behavior and its security boundary.
5. Run relevant local checks and the GitHub Actions workflow.
6. If a check fails, stop dependent work until the failure is understood and corrected.
7. Record the commit, test evidence, known limitations and next dependency.
8. Do not call a design-only policy test a Firestore Rules Emulator test.
9. Do not mark a feature complete until runtime behavior, security enforcement, accessibility and regression tests are verified.

## User assistance should be limited to genuine blockers

Do not ask the owner to approve routine documentation, dependency-free tests or safe changes confined to the review branch. Ask only when an input or action is genuinely necessary, such as:
- An account-specific setting or permission only the owner can access.
- A product, moderation, retention or legal policy decision.
- A cost, billing, provider, IAM, secret or deployment decision.
- A destructive or live-data action.
- An ambiguous requirement that could materially change user experience or security.

When asking, explain the exact decision, why it is needed, the safe default and whether work can continue without it.

## Quality gates for OLDX

### Performance and smoothness
- Avoid unbounded database reads and N+1 request patterns.
- Paginate lists and chat history with bounded page sizes.
- Lazy-load non-critical screens, images and locale bundles.
- Avoid unnecessary listeners, duplicate fetches and repeated rendering.
- Measure before/after on representative low-end Android devices and slower networks.
- Treat performance budgets as acceptance criteria, not optional polish.

### User friendliness
- Keep primary actions clear and consistent.
- Provide loading, empty, offline, validation, success and recoverable error states.
- Preserve user input after recoverable errors.
- Use Gujarati, English and Hindi for the initial release, with centralized translation keys.
- Keep user-generated content unchanged unless the user explicitly requests translation.

### Admin friendliness
- Use role-based least privilege and server-side authorization.
- Require confirmation for destructive actions.
- Record privileged mutations in a tamper-resistant audit trail.
- Provide safe search/filter/pagination and clear action outcomes.
- Do not expose private user fields to broad admin screens without a documented need.

### Maintainability
- Prefer small modules, explicit contracts and shared design tokens.
- Centralize feature flags, translations, validation rules and API contracts.
- Avoid duplicating business logic between user and admin interfaces.
- Document schema versions, migrations, rollback and ownership.
- Add regression tests before changing legacy behavior.

## Current boundaries

- Work only on `security-hardening-review`.
- Keep Production, `main` and the live site untouched.
- Keep Staging Firestore rules deny-all.
- Do not deploy Storage rules; the Storage plan upgrade prompt remains an unresolved owner-side constraint.
- No live data access or migration without explicit approval.
- No new billing, paid services, secrets, IAM or privileged backend deployment without explicit approval.

## Honest operating expectation

The workflow runs when one of its configured GitHub events occurs, or when an authorized person manually starts it. It does not continuously write code while the owner is away. A separate background coding agent would need its own availability, repository permissions, task controls and cost review. The zero-cost-first plan must never promise unlimited autonomous coding or 24/7 execution.

## Current next engineering priorities

1. Complete the private chat user-state/read-receipt policy and migration design.
2. Continue auditing canonical chat/product authorization before writing deployable Firestore Rules.
3. Keep synthetic policy tests distinct from emulator Rules tests.
4. Verify the complete CI workflow after each grouped change.
5. Continue the security release checklist before feature runtime rollout.
6. Then move through the agreed feature roadmap in small tested increments, including performance, UX, admin workflows and localization.
