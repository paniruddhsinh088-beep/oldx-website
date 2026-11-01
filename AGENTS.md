# OLDX Agent Instructions

## Mission
Help complete OLDX safely and efficiently. Work autonomously on clearly scoped, reversible repository tasks, run the relevant tests, fix failures where safe, and continue to the next independent task without waiting for the user to say "continue".

## Repository and branch safety
- Repository: paniruddhsinh088-beep/oldx-website.
- The authorized development line is `security-hardening-review` only.
- Never modify `main`, production branches, release tags, or deployment targets.
- If the coding-agent platform requires a task branch/worktree, create it from `security-hardening-review` and propose changes back to `security-hardening-review` only. Never target `main`.
- Do not merge pull requests. Leave changes for review.
- Before editing, inspect the current branch, working tree, recent commits, relevant docs, and existing tests. Do not overwrite unrelated work.

## Explicit approval gates — stop and ask the owner
Do not perform any of the following without explicit, specific owner approval:
- Deploy or publish anything to Firebase, Vercel, production, staging, or any live environment.
- Change live Firestore or Storage rules, run migrations, access/read live staging or production data, or modify live Firebase resources.
- Create/provision cloud resources, backend runtimes, databases, buckets, or provider accounts.
- Enable billing, purchase credits/services, upgrade plans, incur usage-based costs, or use paid APIs.
- Create/change secrets, credentials, service accounts, IAM roles/policies, access tokens, or security settings in provider accounts.
- Perform destructive data operations, bulk deletion, irreversible migrations, or release/launch actions.
- Relax security controls or change product/privacy policy decisions.

## Known Firebase safety baseline
- Firebase Staging project: `oldx-staging`.
- Firebase Production project: `oldx-1c983`.
- Firestore rules in Staging are intentionally deny-all. Preserve this state.
- Storage plan upgrade was previously required; do not attempt Storage deployment or enablement.
- No upload/runtime backend is approved or deployed.
- Do not claim a feature is live merely because code, a design, or a synthetic test exists.

## Work style and autonomy
- First inspect the repository's roadmap, security/release readiness docs, operation matrices, and existing code/tests. Prefer existing documented decisions over assumptions.
- Maintain a prioritized task list. Work through safe, independent tasks in order.
- For each task: state objective, inspect relevant code, make the smallest coherent change, add/update tests, run targeted tests and broader checks where practical, inspect the diff, and record evidence.
- When tests fail, diagnose and fix if the fix is within the approved scope. Do not hide, skip, weaken, or relabel failing tests to claim success.
- After a task passes, continue to the next safe task without asking the user to say "continue".
- Batch related changes to reduce repeated setup and context overhead, but keep changes reviewable.
- If blocked by missing product decisions, credentials, provider setup, unavailable paid services, or approval gates, document the blocker and move to another safe task.
- Ask the owner only one concise, decision-focused question when an approval gate or essential product choice blocks progress. Do not ask for routine preferences already documented.
- Never claim to work continuously in the background beyond the actual agent task/session and usage limits. Report when a task is complete or blocked.

## Testing and evidence
- Distinguish pure Node policy-model tests from actual Firebase Rules Emulator tests.
- A test with "emulator" in its path/name is not automatically an emulator test; inspect its runner/configuration.
- Emulator tests are isolated test evidence only. They do not prove anything has been deployed to Staging or Production.
- Preserve the deny-all baseline and candidate rules separation.
- Run available repository checks relevant to each change. Report exact commands and pass/fail results.
- Do not invent test results, coverage, deployment status, or release readiness.

## Product/security principles
- Default to least privilege, deny-by-default, strict schemas, ownership checks, server-trusted identity, bounded inputs, safe pagination, and privacy-preserving data access.
- Do not trust client-provided sender IDs, ownership, MIME types, quotas, moderation status, or deletion claims without an appropriate trusted boundary.
- Do not expose private user/product fields through public read paths.
- Preserve existing user data and backward compatibility unless an approved migration plan exists.
- For image uploads, chat attachments, account deletion, blocking, read receipts, and moderation, follow the repository's current contracts and approval register. Treat proposals/drafts as inactive until approved and implemented safely.
- Initial UI languages are Gujarati (`gu`), English (`en`), and Hindi (`hi`). Do not silently translate user-generated content.

## User experience and cost
- Prefer simple, accessible, mobile-friendly UX and low-resource implementation.
- Aim for zero additional operating cost. Do not introduce paid dependencies, hosted APIs, or usage-based services without owner approval.
- Avoid heavy local tooling requirements where a lightweight CI or isolated test is sufficient.

## Completion report
At the end of each task batch, provide:
1. What changed (files and purpose).
2. Tests/checks run with exact results.
3. Commit/PR reference and target branch.
4. Remaining risks, assumptions, and approval blockers.
5. The next safe task that will be picked up automatically.

## Default decision
When uncertain, preserve existing security restrictions, do not deploy, do not spend, document the uncertainty, and continue with another safe repository-only task.
