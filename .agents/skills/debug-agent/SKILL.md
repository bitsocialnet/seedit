---
name: debug-agent
description: Investigate a reported bug using source, tests, or runtime evidence to establish its cause.
---

# Debug a Bug

1. Establish the expected behavior, reproduction, affected environment, and success criteria. Inspect file history when the report identifies a file or line.
2. Trace the real execution path. Use existing tests, stack traces, logs, and runtime evidence before creating more instrumentation.
3. State the plausible causes and choose the cheapest check that distinguishes them. A failing regression test or deterministic source-level error can be sufficient; not every bug needs a logging server.
4. Reproduce autonomously using available tools when possible. Ask for a user-only reproduction step only when access or missing information prevents progress; reuse the agreed method in later iterations.
5. Apply the smallest fix supported by a reproduction or conclusive source/runtime evidence identifying both the defect and correct behavior. If neither is available, report what was checked and request the missing reproduction detail; do not guess. Preserve unrelated changes.
6. Verify the original failure and relevant edge cases. Follow the repository's verification requirements once for the final state.
7. Remove temporary instrumentation and files owned by this task after verification, and report the cause, fix, and evidence. Do not require another confirmation when the authorized automated check proves success.

## When instrumentation is needed

- Add a small number of logs tied to specific hypotheses; avoid credentials, personal data, and arbitrary content dumps.
- Prefer the application's existing logger or test harness. Use an existing local debug service if useful; do not install or require a new daemon by default.
- Use a task-specific log file and mark temporary code clearly. Never clear another session's logs.
- Collect before/after evidence. If a hypothesis fails, remove its speculative fix and revise the investigation.
- If user-only verification remains pending, state the limitation and retain only the instrumentation needed for that verification, unless the user requests cleanup.

## Optional file discovery

If ordinary search leaves a large but explicit source shortlist, [Jev file questions](../../../scripts/jev/ask-README.md) can help prioritize direct inspection. Supply task-specific bounded questions and only task-authorized files; live calls require explicit `--live` and a budget. Keep negative and uncertain results visible, inspect their source/dependencies when needed, and read source before editing. This is optional evidence selection, not a command runner or proof of a diagnosis. The initial pilot did not establish workflow savings; do not run it routinely or treat low API cost as justification. Prefer direct reading when it is cheaper.
