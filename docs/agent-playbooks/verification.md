# Agent Verification

Choose checks that establish the requested behavior. Finish the authorized implementation and fix failures caused by it; report unrelated failures with evidence. Reuse successful checks for unchanged code instead of starting the same pass again.

## Select checks by impact

| Change | Default verification |
|---|---|
| Prose, comments, or formatting | Inspect the diff and relevant links/output; run required generators. No application build for documentation alone |
| Isolated logic or automation | Affected behavior tests or a focused invocation; lint/type-check when the edited language or interface warrants it |
| Shared runtime behavior, dependencies, build/package configuration, or substantial integration | Focused behavior tests plus `corepack yarn agent:verify` for build, lint, and type-check |
| CSS, themes, or layout only | Affected browser/viewport/theme checks below; add a build for CSS processing, assets/import wiring, or integration uncertainty. Styling alone does not require React Doctor |
| React state/effects/data flow or rendering performance | Inspect the relevant architecture; run `yarn doctor` when diagnostics would resolve a concern or a check explicitly requires it |
| Dependencies or import graph | `yarn boundaries` (part of `yarn lint`) must pass when `src/` files move or imports change; advisory `yarn knip`; resolve relevant new findings |
| Release, CI, or explicitly requested full verification | Run that workflow's required checks even when a smaller local edit would normally need less |

For a small edit, name the behavior being checked and why the chosen evidence is enough. Broaden checks when the impact crosses a shared boundary, a failure appears, or uncertainty remains. Do not add tests that only mirror wording or formatting. An existing reliable test is preferable to new instrumentation.

For focused Vitest runs use `corepack yarn exec vitest run --passWithNoTests --maxWorkers=2 [paths]`. Add or extend nearby regression tests for non-trivial, testable bugs. The AI workflow Node tests use disposable fixtures and fake commands without production access; run and repair them within the requested task without another approval pause.

## Browser coverage

Verify the affected flow in Chrome/Blink for a small browser change. Also cover Firefox/Gecko and WebKit/Safari for shared CSS/layout/responsiveness changes, browser-sensitive behavior or APIs, broad interaction changes, releases, or an explicit cross-browser requirement. Include desktop/mobile when layout, responsiveness, or touch behavior is affected. Check changed theme behavior in relevant themes.

Use the `playwright-cli` skill and `./scripts/pw-session.sh` for every session. Run selected engines sequentially and close the exact session in cleanup even if a check fails. Reuse a compatible server in the same worktree or record and stop only the one this task starts. Use a fresh profile unless current-session access is already authorized and required.

For loading, navigation, or interaction performance, add a Chromium low-spec pass with `./scripts/pw-throttle.sh <session> mid`; see [low-spec verification](low-spec-verification.md). Firefox and WebKit remain unthrottled.

## Full verification and ownership

Before heavy work, inspect existing workloads; never stop an unfamiliar process. One owner runs `corepack yarn agent:verify` when a full pass is needed. It serializes build, lint, and type-check behind a machine-wide lock and reports contention. Installs, tests, browser work, and directly launched builds still require coordination.

Builds may refresh generated assets and create `build/`. Inspect status before and after, preserve preexisting artifacts and changes, and remove only output created by this task. The verifier never restores or deletes output for you. No lifecycle hook runs builds, installs, audits, or Git cleanup.

Review the final task-owned diff. For non-trivial changes or an explicit quality review, use `code-quality-review` once and apply high-confidence findings within existing authorization. Passing a check or review does not authorize publication.

## Workflow and document changes

For shared skills, roles, or hooks run `yarn ai-workflow:sync`, `yarn ai-workflow:check`, and `yarn ai-workflow:test`. Run `yarn llms:generate` after public English docs or AI context changes. These checks do not require an app server or browser. When only prose changed, skip the application build; changing executable workflow code may need the focused or full checks above.

After substantial prompt changes, try representative requests for skill selection, scope, completion, and check choice. Use isolated fixtures for actions where possible; a read-only scenario review is useful evidence but does not prove live execution behavior.

Record commands, outcomes, and limits in the task report. Use the [long-running workflow](long-running-agent-workflow.md) only when a durable handoff is needed.
