# OLDX interruption-safe Codex checkpoint and resume policy — 3 November 2026

**Owner requirement:** If Codex stops, times out, exhausts quota, loses connectivity or its environment is interrupted, retain completed work and resume from the last durable checkpoint instead of starting again.

## Mandatory checkpoint workflow
1. At the start of every run, inspect remote `security-hardening-review` HEAD, local branch/status/log, AGENTS.md and latest checkpoint. Preserve concurrent commits and any recoverable uncommitted work.
2. Break implementation into coherent, reviewable milestones. After a safe milestone, run relevant focused tests, **commit and push to `security-hardening-review`**, and record exact source SHA, tests, completed work, unfinished tasks and next command/step in a concise repo checkpoint.
3. Only claim a milestone is remotely durable after successful push and verification. A local-only commit is not guaranteed to survive environment loss; uncommitted changes are at higher risk.
4. If a milestone is incomplete, do not claim it is working or tested. Keep incomplete code disabled/fail-closed, and label the checkpoint accurately; never push known-unsafe active behavior.
5. On restart, first compare latest remote HEAD and checkpoint, inspect surviving local changes, and continue only the outstanding tasks. Never redo completed batches or overwrite newer work. Do not reset/force-push, merge main, or touch live resources.
6. If tests, network or GitHub push are blocked, report the exact failure and which work is **not** remotely saved. Do not imply the work is safe until it is pushed.

## Limits
GitHub commits pushed to the authorized branch are durable handoffs. This policy cannot guarantee recovery of unsaved ephemeral edits if a Codex workspace is destroyed before a push. Scheduled ChatGPT automations cannot directly guarantee real-time Codex execution, quota reset detection or uninterrupted operation. All existing security and owner approval gates remain in effect.
