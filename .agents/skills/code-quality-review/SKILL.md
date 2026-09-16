---
name: code-quality-review
description: Review a task-owned diff for correctness, regression risk, and unnecessary complexity when a quality review is requested or called for by repository policy.
---

# Code Quality Review

Review against the user's base, or the task's base branch plus its relevant staged, unstaged, and untracked changes. Preserve unrelated work. Read nearby source, changed tests, and applicable repository guidance before judging a hunk.

Focus on evidence-backed bugs, error paths, races, state consistency, trust boundaries, and concrete verification gaps. Challenge each finding against the implementation and intended behavior. Apply architecture and performance guidance only where the changed flow makes it relevant; when files or imports moved, run `yarn boundaries` instead of judging the module boundaries in `src/AGENTS.md` by eye.

For simplification, use the repository's solution ladder: remove unnecessary work, reuse existing code or platform facilities, and only then introduce new code. Do not trade away correctness, accessibility, validation, error handling, or useful tests. Preserve an unfamiliar guard or workaround until its purpose is understood.

When a bug fix or substantive review correction exposes a preventable mistake, use [retro](../retro/SKILL.md) to identify the smallest worthwhile prevention. Preserve review-only scope: recommend changes without editing unless implementation is authorized.

Return actionable findings with file/line evidence, impact, and a practical correction, prioritized by risk. Skip tooling-handled style nits and speculative cleanup; if none remain, say so without a canned approval or publishing instruction.

A review-only request returns findings without edits. During an authorized implementation, apply high-confidence in-scope fixes without asking again for that authorization. This is an advisory pass, not an extra approval gate. Reuse verification evidence for the same final state; consult `docs/agent-playbooks/verification.md` only when a change or concrete uncertainty calls for more checks.
