# Agent Hooks Setup

The only automatic lifecycle action is formatting edited JavaScript and TypeScript files. Each harness has a thin `format.sh` wrapper that calls `scripts/agent-hooks/format.mjs`. Finishing a response does not install packages, run verification, inject review reminders, or mutate Git state.

## Entry points

| Harness | Entry point | Event |
|---|---|---|
| Claude Code | `hooks` in `.claude/settings.json` | `PostToolUse`, matcher `Edit\|Write\|MultiEdit` |
| Codex | `.codex/hooks.json` | `PostToolUse`, matcher `apply_patch` |

Keep these application-specific schemas separate. Codex hooks also need to be trusted in the contributor's Codex settings before they run; a committed configuration does not establish that trust.

## Formatting behavior

- Claude sends `tool_input.file_path`.
- Codex sends `apply_patch` text in `tool_input.command`. The formatter collects added and updated files, uses the destination of a move, and ignores deleted files.
- Relative paths use the payload's working directory when supplied, falling back to the repository root.
- Known read-only tool calls, non-edit events, reported tool failures, malformed input, missing paths, and unsupported extensions are skipped.
- Both lexical paths and resolved real paths must remain inside this checkout. This includes the final file and any symlinked parent directories.
- Formatting runs once per payload through `corepack yarn exec oxfmt --write`, only when the repository's formatter is installed. Corepack network access is disabled. Missing dependencies are not installed by the hook.
- Node command launches use the declared `cross-spawn` dependency to handle Windows command shims and argument escaping. Shell hook entry points still require the harness's Bash support on Windows.
- Formatter failures are reported on stderr and remain advisory. Hooks do not inject additional instructions into the model.

Run `corepack yarn install` explicitly when setting up a worktree or changing dependencies. The worktree creation helper already performs installation.

## Explicit verification

Use `corepack yarn agent:verify` when the change needs the full pass described in [verification.md](verification.md). `scripts/agent-verify.mjs` runs `build`, `lint`, and `type-check` sequentially, prints the commands and working directory, and reports every failed check. It completes the remaining checks after a command fails and exits with the first failure's status. A missing executable returns 127; a terminated command reports its signal and returns the conventional signal exit status.

The command does not remove, restore, or stage generated artifacts. The build itself can update output and generated files; inspect the resulting diff and clean up only output created by your own run. Tests, React Doctor, and browser verification remain explicit checks selected for the change.

Bitsocial checkouts, including Seedit and 5chan, share an atomic lock directory named `5chan-agent-verify.lock` in the operating system's temporary directory. Keep that existing shared name so verification across the two repositories cannot overlap. A busy slot exits immediately with status 75 and owner details. Wait for the owning run to finish before retrying. Normal completion and handled SIGINT/SIGTERM release the lock; on Unix, interruption is forwarded to the active command's process group, and on Windows it terminates the command tree through `taskkill /T /F`. A force-killed process can leave a lock behind. Inspect `owner.json` and verify that the recorded run and its child workloads have stopped before manually removing that stale lock. Unreadable metadata is never treated as permission to steal the slot.

The lock coordinates invocations of this command. Other heavyweight work, such as installs, tests, browsers, and builds launched directly, still needs the repository's workload coordination rules.

## Maintaining the workflow

- Change shared formatter behavior in `scripts/agent-hooks/format.mjs`; keep harness wrappers thin.
- Wire only the formatter in each hook configuration. Dependency installation, Git housekeeping, reviews, and full verification belong to explicit workflows.
- Run `corepack yarn ai-workflow:check` after changing hook scripts or configuration.
- Run `yarn ai-workflow:test` for payload, path-containment, and verification behavior. These tests use fake commands and never run real builds.
