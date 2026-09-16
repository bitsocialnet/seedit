# Known Surprises

This file tracks repository-specific confusion points that caused agent mistakes.

## Entry Criteria

Add an entry only if all are true:

- It is specific to this repository (not generic advice).
- It is likely to recur for future agents.
- It has a concrete mitigation that can be followed.

If uncertain, ask the developer before adding an entry.

## Entry Template

```md
### [Short title]

- **Date:** YYYY-MM-DD
- **Observed by:** agent name or contributor
- **Context:** where/when it happened
- **What was surprising:** concrete unexpected behavior
- **Impact:** what went wrong or could go wrong
- **Mitigation:** exact step future agents should take
- **Status:** confirmed | superseded
```

## Entries

### PR review/merge workflow is independent of GitHub issues and Projects

- **Date:** 2026-07-23
- **Observed by:** Tommaso + Claude
- **Context:** porting the `review-and-merge-pr` skill fix from `bitsocial-react-hooks`, where a merged PR was finalized against workflow state the repo no longer uses
- **What was surprising:** the `review-and-merge-pr` skill still closed and re-assigned linked issues after merge, even though the review/merge workflow should stay independent of issue management.
- **Impact:** agents can spend time mutating issue state nobody asked for, or report a successful merge as incomplete when issue finalization fails.
- **Mitigation:** keep pull-request review and merge workflows independent of GitHub issues and Projects; only create or manage an issue when the user explicitly requests one (for example via `make-closed-issue`).
- **Status:** confirmed

### Portless 0.11 reuses legacy proxy state unless the launcher forces HTTPS

- **Date:** 2026-04-28
- **Observed by:** Tommaso + Codex
- **Context:** Upgrading the normal `yarn start` flow from the old `http://seedit.localhost:1355` proxy URL to `https://seedit.localhost`.
- **What was surprising:** Even with `portless@0.11.1` installed, Portless reused the existing `~/.portless/proxy.port = 1355` HTTP proxy and printed the legacy `:1355` URL.
- **Impact:** Updating package versions and docs is not enough; `yarn start` can still advertise and use the old URL when a contributor has legacy Portless state running.
- **Mitigation:** Keep `scripts/start-dev.js` explicitly starting the Portless HTTPS proxy on port `443` before registering the app route, so the runtime flow migrates away from persisted `1355` state instead of inheriting it.
- **Status:** confirmed

### `.vercel` output is local-only

- **Date:** 2026-03-19
- **Observed by:** Codex
- **Context:** Local Vercel inspection created a large `.vercel/output/` tree in the repo.
- **What was surprising:** The generated Vercel output can look like meaningful project files, but it is purely local build/deploy state and should not be committed.
- **Impact:** Agents may accidentally stage large generated artifacts or mistake them for source changes.
- **Mitigation:** Keep `.vercel` ignored and clean it before committing if Vercel tooling was used locally.
- **Status:** confirmed

### Electron RPC uses direct `pkc-js` imports

- **Date:** 2026-03-19
- **Observed by:** Codex
- **Context:** The desktop bootstrap imports `@pkcprotocol/pkc-js/rpc` directly from `electron/start-pkc-rpc.js`.
- **What was surprising:** Most app data access goes through `@bitsocial/bitsocial-react-hooks`, but the Electron-local RPC bootstrap is intentionally a direct `pkc-js` integration.
- **Impact:** Agents may try to route Electron RPC through hooks or remove the direct dependency while resolving tooling warnings.
- **Mitigation:** Keep Electron RPC on the direct `@pkcprotocol/pkc-js` import and audit the runtime dependency before changing its manifest entry.
- **Status:** confirmed

### Electron packaging can ship a broken `better-sqlite3` binary

- **Date:** 2026-03-19
- **Observed by:** Codex
- **Context:** Investigating desktop packaging failures where the app launched but the local RPC never became healthy.
- **What was surprising:** The packaged app can appear to start normally while `better-sqlite3` was built for plain Node instead of the Electron runtime, which prevents the local RPC path from starting correctly.
- **Impact:** The desktop app may open but fail to load comments, communities, or other RPC-backed data.
- **Mitigation:** Before Electron packaging or release verification, rebuild `better-sqlite3` for the target Electron version, for example with `npx electron-rebuild -f -o better-sqlite3`, then verify the rebuilt native module under the Electron runtime.
- **Status:** confirmed

### Portless is now the canonical web dev URL

- **Date:** 2026-03-30
- **Observed by:** Codex
- **Context:** Normal `yarn start` runs alongside other local Bitsocial projects
- **What was surprising:** The repo historically assumed `http://localhost:3000`, but the normal web dev flow now runs through Portless at `https://seedit.localhost` so multiple Bitsocial apps can coexist without raw-port collisions.
- **Impact:** Agents can point browser automation, health checks, or local smoke scripts at the wrong URL and conclude the app is down when it is healthy.
- **Mitigation:** Use `https://seedit.localhost` for standard web dev and agent smoke flows. Only rely on `http://localhost:3000` when a script intentionally forces both `PORTLESS=0` and `PORT=3000`, such as the combined Electron dev commands.
- **Status:** confirmed

### Fixed Portless app names collide across seedit worktrees

- **Date:** 2026-03-30
- **Observed by:** Codex
- **Context:** Starting `yarn start` in one seedit worktree while another seedit worktree was already serving through Portless
- **What was surprising:** Using the literal Portless app name `seedit` in every worktree makes the route itself collide, even when the backing ports are different, so the second process fails because `seedit.localhost` is already registered.
- **Impact:** Parallel seedit branches can block each other even though Portless is meant to let them coexist safely.
- **Mitigation:** Keep Portless startup behind `scripts/start-dev.js`, which now uses a branch-scoped `*.seedit.localhost` route outside the canonical case, suffixes repeated branch routes (`-2`, `-3`, ...) until it finds a free Portless name, and falls back to the next free direct-Vite port when `PORTLESS=0` is used without an explicit `PORT`.
- **Status:** confirmed

### Toolchain model names are not interchangeable or automatically current

- **Date:** 2026-04-08
- **Updated:** 2026-07-10
- **Observed by:** contributor + Codex
- **Context:** Reviewing repo-managed agent configs under `.codex/agents`, `.cursor/agents`, and `.claude/agents`
- **What was surprising:** Model names are harness-specific, and Codex does not document a `latest` alias that automatically tracks the current parent session.
- **Impact:** Pinned Codex agent models or reasoning levels silently become stale and can diverge from the parent session a contributor intentionally selected.
- **Mitigation:** Keep Cursor and Claude model controls harness-specific. In every committed Codex custom-agent TOML under `.codex/**/agents/*.toml`, omit both `model` and `model_reasoning_effort` so the agent inherits the current parent session settings.
- **Status:** confirmed

### Regenerating the whole changelog reverts the rebrand

- **Date:** 2026-09-16
- **Observed by:** Tommaso + Claude
- **Context:** preparing the 0.6.0 release, where `yarn changelog` was the documented step for regenerating `CHANGELOG.md`
- **What was surprising:** the script passed `--release-count 0`, which rebuilds every historical section from raw commit subjects. `CHANGELOG.md` is not purely generated: `chore(rebrand)!` (36fd5f39) hand-rewrote its prose to remove plebbit naming, so regenerating everything reintroduced 151 plebbit/subplebbit references and deleted 136 rebranded lines. `scripts/release-body.js` regenerated its own section the same way, so the published GitHub notes disagreed with the committed file.
- **Impact:** a routine release step silently reverts the rebrand in a file the app ships at `/changelog`, and publishes old-brand wording in the release notes.
- **Mitigation:** keep the `changelog` script on `--release-count 1` so it only prepends the new section, and keep `scripts/release-body.js` reading the top section of the committed `CHANGELOG.md` rather than regenerating it. After running `yarn changelog`, confirm the diff is insertions only and apply the established mapping to new entries: subplebbit(s) to community/communities, plebbit options to pkc options, plebbit rpc to pkc rpc, plebbit-react-hooks to bitsocial-react-hooks. Breaking-change notes that name what is no longer migrated (`.plebbit` data dirs, `plebbitOptions`) keep the old name on purpose.
- **Status:** confirmed
