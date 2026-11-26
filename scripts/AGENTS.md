# scripts/AGENTS.md

These rules apply to `scripts/**`. Follow the repo-root `AGENTS.md` first, then use this file for automation and workflow helpers.

- Keep scripts non-interactive and idempotent. Print the command, URL, branch, or path being acted on so failures are diagnosable.
- Use repo-relative paths and environment variables instead of user-specific absolute paths.
- For dev-server helpers, default to `https://seedit.localhost`, but allow a branch-scoped `*.seedit.localhost` route when the launcher is avoiding a Portless name collision. Respect the existing `PORTLESS=0` fallback instead of hard-coding alternate ports. If a flow intentionally bypasses Portless, override `AGENT_APP_URL` explicitly.
- Keep browser-performance helpers explicit about their limits. CDP throttling is Chromium-only; Firefox and WebKit verification stays unthrottled.
- `scripts/pw-session.sh` owns the machine-wide Playwright resource lock shared by every worktree and checkout, so its default lock path must stay repository-independent. Keep acquisition atomic, treat `playwright-cli list --all` as the only browser liveness oracle and leave the lock alone when it cannot be read, count a lock whose acquirer is still launching its browser as held for a bounded time, reclaim only the lock that was judged stale, require exact-owner release, and close the named browser before normal release; never broaden cleanup to unrelated sessions.
- Keep shell helpers thin. When logic becomes stateful or cross-platform, prefer a Node script.
- Git and worktree helpers must validate input and default to safe operations.
- If a helper deletes local branches automatically, document the exact eligibility checks and keep the behavior conservative.
