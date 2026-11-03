# OLDX mandatory progress monitoring and plan alignment rule — 3 November 2026

**Owner-approved ongoing operating rule.** Applies to ChatGPT reviews, Codex handoffs and scheduled OLDX development/monitoring. Canonical branch: `security-hardening-review`.

## Every review must answer six questions with verifiable evidence
1. **How much is complete?** Report Product, Store, Service Providers, Chat, Admin, media, localization, security, UI, staging and Android separately. Distinguish design/contract, implemented source, isolated tests, existing UI integration, real staging acceptance, and live. Never infer percentage complete from test totals. If quantifying completion, first define weighted launch milestones and evidence.
2. **What is underway now?** Read latest remote HEAD, commits, PRs, progress notes and exact-source GitHub CI. If Codex's unpushed local work cannot be inspected, explicitly say activity is not observable; never invent real-time status.
3. **What remains?** Maintain an ordered list of P0 launch blockers, failures/flaky tests, real user journeys, and approval dependencies. Distinguish optional P1/P2 from launch-blocking P0.
4. **How to finish fastest safely?** Propose the next highest-impact non-conflicting executable batch, prioritizing complete Product owner/buyer flow and recovery, Store/Provider existing UI, critical Chat/Admin, photo trust and real staging acceptance. Prefer reuse, small coherent commits, targeted tests and reduced repeated documentation.
5. **Is the work aligned with the plan?** Verify security, privacy, low/zero recurring cost, speed/mobile UX, preservation of features, Android/Capacitor compatibility, approved blue/orange/white visual design, gu/hi/en app-owned UI, and the owner decision that Product title/description always remain in seller's original language. No initial automatic translation or Translate button.
6. **What evidence and owner action are needed?** Provide verified SHAs, CI status, isolated vs Emulator vs real staging distinction, risk severity, exact blocker and a specific approval question when required.

## Targets and launch gates
- Website readiness target: **7 November 2026**, conditional on genuine security and end-to-end acceptance.
- Android Play Store submission target: **14–19 November 2026**, conditional on website completion and separate app checks.
- Keep **HOLD/NO-GO** until real acceptance and explicit owner launch approval. No main merge, live/staging deployment, Rules/index/IAM/secrets/billing changes, provider activation, real data access, paid services or migrations without separate explicit owner approval.

## Monitoring cadence and boundaries
Existing OLDX Autonomous Development automation runs on an hourly schedule and OLDX Development Monitoring on a daily 09:00 schedule; both were updated to follow this rule. Scheduled runs do not guarantee uninterrupted coding or real-time visibility of Codex usage, local changes or reset events. The monitoring automation is read-only. Avoid conflicting with concurrent Codex work. GitHub commits, CI and durable checkpoints are the source of truth.

## Report format (Gujarati)
**પૂર્ણ થયું** (evidence) | **અત્યારે ચાલી રહ્યું છે** (observable or unknown) | **બાકી P0** (ranked) | **ઝડપી આગામી Batch** (ready-to-send handoff) | **જોખમ/મંજૂરી** | **7 Nov GO/NO-GO**.

Read AGENTS.md, latest progress reports, docs/launch-decision-register-2026-11-07.md, docs/oldx-approved-website-app-design-2026-11-03.md, and docs/oldx-product-language-display-decision-2026-11-03.md before recommending changes. Preserve newer owner decisions.
