# OLDX Agent Instructions

## Mission
Help complete OLDX safely and efficiently. Work autonomously on clearly scoped, reversible repository tasks, run the relevant tests, fix failures where safe, and continue to the next independent task without waiting for the user to say "continue".

## Ownership handover and approval authority (2026-11-11)
- **Current intended genuine business/technical operator and decision-maker:** Yasmin Parmar, GitHub `yasminparmar087-ops`. All new OLDX operational approvals must come from Yasmin in her owner capacity. This is a prospective handover; do **not** rewrite, deny, or erase prior involvement by the former operator or historical commit authorship.
- The GitHub repository was transferred to `yasminparmar087-ops/oldx-website`. Treat old `paniruddhsinh088-beep/oldx-website` strings in dated reports as historical references, not current push or CI targets. Update active instructions/configuration deliberately and minimally where proven necessary.
- Vercel `oldx-website` project is now in Yasmin's `yasminparmar087-ops` Hobby workspace; the existing `oldxbazar.in` domain and deployment history were observed there. Git integration points to Yasmin's repository. **Ignored Build Step = Don't build anything / `exit 0`** was checked after transfer. Do not re-enable builds, deploy, cut over, or alter DNS automatically.
- Firebase projects `oldx-staging`, `oldx-testing`, and `oldx-1c983` (production) visibly list Yasmin as Owner; all three were checked as Spark/free with no linked billing account. Former Google account access still existed at the last review; its removal was intentionally deferred to a separate dependency/permission review on or after 2026-11-12. **Do not remove any owner, credentials, or IAM bindings on your own.**
- GoDaddy account shows `oldxbazar.in` under Yasmin's login, with updated Yasmin registration contact details and active domain. Pending WHOIS warning later disappeared, but do not assert that all registrar verification/transfer-lock requirements are conclusively closed. The website was observed loading; DNS recommendation was left unchanged.
- Cloudflare Pages `oldx-website` was connected to Yasmin's GitHub repository with production and preview automatic deployments disabled. Cloudflare account ownership, integration permissions, remaining credentials and operational readiness should be reviewed only where not already evidenced.
- **Do not repeat verified handover checks** unless there is a concrete new discrepancy or change. Resume from remaining dependencies and separately approved next tasks. Avoid duplicate work and credits.
- No authorization is implied to activate Blaze, link billing, provision Cloud Run/R2, change production or staging Rules, enable deployments, rotate/delete provider credentials, change DNS, launch, or spend. Preserve all existing data, history, code, approved product/security requirements and HOLD/NO-GO. Existing billing-support holds should not be bypassed.
- Treat this section as the **current owner/handover instruction**; dated planning and architecture documents remain historical evidence and still govern design unless explicitly superseded. Only Yasmin may authorize new owner-gated actions after the handover.

## Repository and branch safety
- Current repository: `yasminparmar087-ops/oldx-website` (transferred from `paniruddhsinh088-beep/oldx-website`; retain historical commit authors, links, and audit trails).
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

## Latest owner-approved architecture direction (2026-11-07)
- Read `docs/OLDX_FINAL_ARCHITECTURE_AND_COST_DECISION_2026-11-07.md` before planning new OLDX architecture/cost work. It supersedes older *architecture preference* proposals, but does not supersede deployment/security gates.
- Target: Cloudflare Pages frontend, Google Cloud Run trusted backend, Firebase Auth + Firestore (Blaze only when separately activated), Cloudflare R2 candidate for photos with Firebase Storage adapter fallback, and Capacitor Android from shared code.
- Owner accepts necessary plan costs in principle; ₹2,000/month at 5,000 MAU is a goal, **not** a hard cap or validated estimate. Before any billable activation/provisioning/plan upgrade, obtain explicit action-specific approval with current prices and risks. Keep features, security and performance intact.
- First tasks: Firestore/chat read-write optimization and Cloud Run compatibility, isolated tests only. Preserve review-branch-only policy and HOLD/NO-GO; no live changes without separate approval.

## Mandatory reuse-first implementation rule (owner reaffirmation 2026-11-07)
- Maximize reuse of existing working OLDX code, features, adapters, tests and UI to save time. No broad rewrite or hosting-driven refactor for its own sake.
- Audit before editing; prefer minimal, incremental, reversible, measured changes only where needed for cost reduction, security, performance, Cloud Run/R2/Pages compatibility or acceptance.
- Optimize Firestore reads/writes and chat unread costs without weakening authorization or privacy. Measure before/after; document unavoidable rewrites and preserve regression coverage, localization and Capacitor compatibility.
- See `docs/OLDX_FINAL_ARCHITECTURE_AND_COST_DECISION_2026-11-07.md` for binding owner direction.

## Owner-approved OLDX UI/UX design direction (2026-11-08)
- Before planning or editing customer-facing OLDX Website/Android UI, read `docs/OLDX_UI_UX_APPROVED_DESIGN_PLAN_2026-11-08.md`. This is the owner's approved mobile-first design direction and supplements (does not override) the architecture/security/release gates.
- Preserve Blue–White–Orange identity, **compact homepage banner to display more products**, clear search/location, compact category icons, consistent photo/price/location/favorite product cards, and the five mobile navigation destinations: Home, Search, Orange Sell (+), Chat, Profile. Reuse existing flows for Product, Store, Service Providers, Chat and Settings.
- **Mandatory reuse-first:** audit existing DOM/CSS/components/routes before changing; prefer small reversible visual refinements and shared CSS; do not rewrite working UI, add heavy UI frameworks, or remove existing features. Keep Gujarati/Hindi/English, mobile accessibility, keyboard/back behavior and Capacitor compatibility.
- Design approval is NOT permission to deploy, spend money, change billing/IAM/Firebase Rules or launch. Keep `security-hardening-review` only and production HOLD/NO-GO; get specific approval before staging deployment.
