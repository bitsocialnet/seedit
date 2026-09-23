# AGENTS.md

## Purpose and priority

These are the shared instructions for agents working on seedit. Explicit user instructions take precedence over repository workflow guidance. MUST rules are mandatory; SHOULD rules are defaults. Read linked playbooks only when the task needs them.

Use judgment for routine implementation choices and continue authorized work. Ask only when missing information materially changes the outcome or an action needs authorization that has not already been given. Do not turn a skill's suggested procedure into an extra approval gate.

## Product and source of truth

Seedit is a static, serverless, adminless, decentralized old.reddit-style client built on the Bitsocial protocol. Community content comes from peers, not the app origin. Preserve hash routing and static deployment unless the user requests an architectural change.

Code, tests, manifests, source docs, and runtime evidence establish behavior. This file, skills, playbooks, task logs, and generated `llms*.txt` are orientation and policy; verify their technical claims against source before editing. Check the installed dependency version before assuming a nearby repository supplies its code.

For an unexpected repo-specific issue, tell the contributor and continue independent work. After confirmation, record only recurring issues with a concrete mitigation in [known-surprises.md](docs/agent-playbooks/known-surprises.md).

## Working principles

- Define completion for non-trivial work. Continue through implementation, relevant verification, and fixes until the requested outcome is complete; stop at the user’s requested boundary.
- Understand the flow before editing. Prefer skipping unnecessary work, reusing repository code, standard-library/native features, then installed dependencies, before writing new code.
- Keep diffs scoped. Preserve unrelated edits; do not reformat, rename, or refactor adjacent code without a task-related reason.
- Simplicity must preserve correctness, clarity, accessibility, validation, security, and useful tests.
- For a bug, reproduce the reported behavior or establish the defect and correct fix from conclusive source/runtime evidence before editing. Do not guess when evidence is inconclusive; report what was checked and request the missing reproduction details when necessary.
- For a bug tied to a file or line, inspect `git log`/`git blame`, then relevant `git show`, before fixing it. See [bug-investigation.md](docs/agent-playbooks/bug-investigation.md).
- Use existing evidence or a focused test before adding instrumentation. Add runtime logging when it resolves uncertainty; remove task-owned instrumentation after verification.

## Task router

| Task | Required guidance/check |
|---|---|
| Visual design, layout, CSS, or themes | Read the relevant guidance in [DESIGN.md](DESIGN.md); review against its Do/Don't list |
| Files under `src/` or `scripts/` | Read the directory's `AGENTS.md` |
| Code or automation changed | Select affected checks using [verification.md](docs/agent-playbooks/verification.md); use `agent:verify` for integration/build changes or an explicitly requested full pass |
| React state, effects, data flow, or rendering performance changed | Review relevant React guidance; run `yarn doctor:check` and affected `yarn perf:check` scenarios |
| UI behavior/layout changed | Verify the affected flow; select browsers/viewports using [verification.md](docs/agent-playbooks/verification.md) |
| Loading/navigation/performance work | Add a throttled Chromium pass; see [low-spec-verification.md](docs/agent-playbooks/low-spec-verification.md) |
| Translation keys/values | Use the `translate` skill; one process applies locale changes at a time |
| `package.json` changed | Run `corepack yarn install` to synchronize `yarn.lock` |
| Dependencies, moved files, or imports changed | `yarn boundaries` (part of `yarn lint`) must pass; see module boundaries in [src/AGENTS.md](src/AGENTS.md). Run advisory `yarn knip`; resolve relevant new findings |
| AI workflow files changed | Edit shared sources, run `yarn ai-workflow:sync`, then `yarn ai-workflow:check` and `yarn ai-workflow:test` |
| Bug fix or substantive review correction exposes a preventable mistake | Use [retro](.agents/skills/retro/SKILL.md) for the smallest worthwhile prevention |
| Public English docs or AI context changed | Run `yarn llms:generate` and include resulting `public/llms*.txt` changes |
| Version, changelog, or release body changed | During release work, follow `release` and run `yarn changelog` when notes need regeneration |
| Open PR feedback or merge readiness | Use `review-and-merge-pr` within the user's requested scope |
| Work needs a durable handoff/resumption, or one run is long enough to hit context compaction | Use [long-running-agent-workflow.md](docs/agent-playbooks/long-running-agent-workflow.md) |

## Code and design

- Use Corepack-managed Yarn 4, never npm for project dependency changes. Pin exact versions and keep the lockfile synchronized.
- Stack: React 19, TypeScript, Zustand, React Router v6, Vite, `@bitsocial/bitsocial-react-hooks`, i18next, oxlint, oxfmt.
- Keep page composition in `src/views/`, reusable UI in `src/components/`, hooks in `src/hooks/`, shared state in `src/stores/`, helpers in `src/lib/`, static data in `src/data/`. Dependencies flow one way between those layers; see module boundaries in [src/AGENTS.md](src/AGENTS.md).
- Use Zustand for shared/global state; local component state may use `useState`.
- Use Bitsocial hooks for React UI data access. Do not fetch data in effects or synchronize derived state with effects; derive values during render. Electron's RPC bootstrap intentionally imports `@pkcprotocol/pkc-js` directly.
- Reuse hooks for repeated logic. Model complex flows clearly instead of accumulating boolean flags.
- Use React Router for navigation, not manual history manipulation.
- Add comments for non-obvious constraints or logic, not for obvious code.
- Preserve Seedit's compact old.reddit-inspired interaction language: dense feed rows, familiar voting and metadata order, square legacy controls, small browser-native typography, and the existing light/dark theme variables.
- Use existing variables in `src/themes.css` before literal colors. New semantic tokens must work in both light and dark themes.
- Do not introduce generic dashboard cards, rounded pills, decorative gradients, glass effects, soft elevation, oversized empty layouts, or crypto-first styling on routine browsing surfaces.
- Keep community identity and user ownership inspectable: make clear which address, subscription, or moderation boundary an action affects.

## Git and ownership

- Keep `master` releasable. Start new changes on short-lived `codex/feature/*`, `codex/fix/*`, `codex/docs/*`, or `codex/chore/*` branches unless the user requests otherwise.
- For an unrelated task while another branch is active, create a separate descriptive worktree from `master`. Prefer `./scripts/create-task-worktree.sh <type> <descriptive-slug>`; it installs dependencies.
- Related delegated slices may share the task worktree with non-overlapping file ownership. Never switch branches underneath another agent.
- Stage only task-owned changes, using a selective index patch when files contain mixed edits. Do not use `git add -A` as a default.
- Never commit secrets or generated build output. Preserve preexisting artifacts and unrelated changes during cleanup.
- Only commit, push, publish, or merge when authorized. Permission already given for the action persists through its necessary steps.
- When opening a requested PR, target `master` and make it ready for review so review bots run.
- After an authorized merge, clean up only the verified merged branch/worktree; preserve any later or unrelated work. Do not run Git cleanup from lifecycle hooks.
- Use `gh` for GitHub operations. Commit/issue formatting lives in [commit-issue-format.md](docs/agent-playbooks/commit-issue-format.md); provide suggestions when requested, not on every answer.

## Verification and resource ownership

- Verify the affected behavior with the narrowest reliable checks. Add regression tests for non-trivial, testable bugs; do not add tests that merely restate a reversible wording or formatting edit.
- Run applicable checks for the final change once. Repeat or broaden them only after relevant edits, failures, or unresolved concerns. Preserve explicit user, CI, and release requirements. Documentation-only changes need document/workflow checks.
- Before heavy work, inspect existing processes. Stop only stale processes owned by this task; never stop a process of unclear ownership.
- Serialize installs, builds, full tests/coverage, React Doctor, Android/Electron work, and browser profiling across the task. One agent owns heavy verification.
- Use `corepack yarn exec vitest run --passWithNoTests --maxWorkers=2 [paths]` for agent-run tests. Do not use watch mode for verification.
- Treat React Doctor as guidance for issues introduced or affected by the change; validate findings against source behavior instead of chasing an aggregate score. Knip and coverage are advisory; do not invent new repository-wide gates.
- Default to fresh isolated Playwright sessions. Reuse a contributor's current browser only when explicitly authorized; do not ask again after session mode is established.
- Use `./scripts/pw-session.sh open <session> ...` and `close <session>` for every browser session. One browser may be active machine-wide. Exit 75 means busy; defer or use the wrapper's bounded wait.
- Run browser engines sequentially. Reuse each session for desktop/mobile and close the exact session in cleanup even after failure. Never use `close-all` or `kill-all`.
- Reuse a compatible dev server in the same worktree when safe. Otherwise record and clean up the server/process you start. Never start a server for a documentation-only task.
- Review the final task-owned diff. Use `code-quality-review` for non-trivial changes or an explicit review request; apply high-confidence findings within existing authorization.

## Skills and delegation

- Shared skills live in `.agents/skills/`; shared roles in `.agents/roles/`. `.claude/skills/` and harness agent files are generated compatibility outputs. See [skills-and-tools.md](docs/agent-playbooks/skills-and-tools.md).
- Keep harness-specific hooks, permissions, and metadata explicit; byte-identical files do not establish equivalent runtime behavior.
- Keep model and reasoning choices out of committed skills and custom agents. Use the app’s runtime defaults, parent inheritance, and supported invocation-time choices; do not invent a `latest` alias or require model research for ordinary tasks.
- Delegate substantial independent work when it improves speed, context isolation, or independent review. Small or tightly coupled tasks can stay with the parent.
- Give each child its scope, acceptance criteria, context, file ownership, and evidence to return. Check that evidence before accepting a child's result. For an independent review, omit the parent's verdict.
- Parallelize read-heavy work and non-overlapping edits; use at most four active workers by default. Children do not each run full builds. Browser work always remains serialized.
- Use built-in worker/explorer roles where available; custom roles cover browser checks, profiling, Android, translation, and review. Avoid a compulsory chain of specialist agents.
- Use relevant React skill guidance for state/effect/data-flow or performance work. Load only rules that fit this Vite client; use `you-might-not-need-an-effect` for a focused effect review when the reason is unclear.
- Prefer existing tools and local CLIs. Use external documentation when versions matter. Do not search for or install additional skills merely because a normal coding task mentions their domain.
- Keep tool catalogs relevant. Deferred MCP loading can reduce context overhead, but unnecessary integrations still add choices; disable unused tools when their overhead is observable. Playwright CLI remains the project browser verification path.

## Local commands and playbooks

Canonical dev URL: `https://seedit.localhost`; other worktrees may use branch-scoped `*.seedit.localhost`. Preserve the launcher's HTTPS proxy on port 443. Direct Vite fallback: `PORTLESS=0 yarn start`.

Common checks: `yarn agent:verify`, `yarn doctor`, `yarn knip`, `yarn ai-workflow:sync`, `yarn ai-workflow:check`, `yarn ai-workflow:test`, `yarn llms:generate`, `./scripts/pw-session.sh status`.

Load details on demand: [hooks](docs/agent-playbooks/hooks-setup.md), [verification](docs/agent-playbooks/verification.md), [translations](docs/agent-playbooks/translations.md), [skills/tools](docs/agent-playbooks/skills-and-tools.md), [long-running work](docs/agent-playbooks/long-running-agent-workflow.md), [known surprises](docs/agent-playbooks/known-surprises.md).

## React diagnostics and runtime performance

`yarn agent:verify` and Linux CI run advisory task-diff source diagnostics with `yarn doctor:check` and deterministic runtime scenarios with `yarn perf:check`. The runtime command includes collector compatibility fixtures; use `yarn perf:test` to run those alone after React/Bippy/collector upgrades. Run affected scenarios after React state/effect/subscription/rendering changes. `yarn perf:install` installs the pinned browser once; per-edit hooks still only format files.

Development builds initialize the bounded Bippy collector before ReactDOM and expose `window.__REACT_PERF__.reset()` / `.snapshot()`. It counts committed component work by instance; root React Profiler callbacks supply measured subtree render duration. Missing instrumentation, dropped evidence, and exceeded scenario budgets fail checks. Counts do not identify waste or count aborted work. `yarn perf:record --scenario <name>` saves JSON and native Chrome traces under `.react-perf/`; use `profile-browsing` for interpretation and coverage.

Covered flows are unsaved display-name editing, theme changes, and the built-in populated mock feed's expansion/scrolling. These do not prove performance of live peer transport or unvisited routes. Ordinary production excludes profiling instrumentation. `yarn build:profile` and `yarn preview:profile` use a separate `build-profile/` with `react-dom/profiling`; a normal production preview lacks React component timing.

The runner owns its browser/server lifecycle through the shared resource lock; serialize captures and heavy checks, preserving existing sessions. Agentation and the independent element-source helper remain development-only; the runner suppresses the toolbar during capture.
