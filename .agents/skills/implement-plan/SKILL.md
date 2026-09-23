---
name: implement-plan
description: Implement an approved plan, keeping small or coupled work local and delegating substantial independent slices when useful.
---

# Implement a Plan

1. Read the plan and relevant source. Identify acceptance criteria, dependencies, and task boundaries. Resolve routine choices from context; ask only about ambiguity that materially changes the result.
2. Execute small or tightly coupled changes directly. Delegate independent, substantial slices when parallel work or context isolation adds value. Use the harness's built-in worker/general-purpose role rather than requiring a custom implementation agent.
3. Give each child the exact task, worktree, files it owns, constraints, acceptance criteria, and evidence to return. Tell children they share the checkout and must preserve others' edits. Never delegate overlapping writes concurrently.
4. Use at most four workers by default. Continue useful independent work locally while they run. Queue dependencies until their inputs are ready.
5. Assign one owner for heavyweight verification. Children may run focused lightweight checks; they do not each build, install dependencies, run a full suite, or start browsers.
6. Integrate the changes, inspect the final diff, and run the required checks once for the final state. Browser checks, when relevant, use the shared session lock and sequential engines.
7. Report completed work, verification, and any unresolved limitation. Retry failed slices with new evidence or a clearer assignment, not the same prompt indefinitely.

Create persistent task state only when resumption, a handoff, or a run long enough to hit context compaction needs it; a short delegated task does not require a feature board or app server.
