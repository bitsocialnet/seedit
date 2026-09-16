# Skills and Tools

Shared skills live in `.agents/skills/`. Edit these sources, then run `yarn ai-workflow:sync` to generate `.claude/skills/` for Claude Code. Codex and Cursor discover `.agents/skills/` directly; do not restore the duplicate `.codex/skills/` or `.cursor/skills/` roots.

Shared role prompts live in `.agents/roles/*.md`. This is a repository-specific source format, not a native agent discovery path. `scripts/ai-workflow-files.mjs` converts these sources into the app-specific files below; `yarn ai-workflow:sync` writes them. Commit the generated files alongside their sources so a fresh checkout has the native configuration without running a generator first. After removing a source, remove its obsolete generated outputs explicitly; the validator reports them rather than silently deleting files.

## Native discovery paths

Verified against official documentation on 2026-09-12:

| App | Project instructions | Skills used by this repository | Custom agents used by this repository |
|---|---|---|---|
| Codex | `AGENTS.md` | `.agents/skills/<name>/SKILL.md` | Generated `.codex/agents/<name>.toml` |
| Cursor | `AGENTS.md`; `.cursor/rules/*.mdc` remains available for Cursor-specific conditional rules | `.agents/skills/<name>/SKILL.md` | Generated `.cursor/agents/<name>.md` |
| Claude Code | `CLAUDE.md` imports `@AGENTS.md` | Generated `.claude/skills/<name>/SKILL.md` | Generated `.claude/agents/<name>.md` |

Sources: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Cursor rules](https://cursor.com/docs/rules), [Cursor skills](https://cursor.com/docs/skills), [Cursor subagents](https://cursor.com/docs/subagents), [Claude memory](https://code.claude.com/docs/en/memory), [Claude skills](https://code.claude.com/docs/en/skills), [Claude subagents](https://code.claude.com/docs/en/sub-agents).

Do not replace the native agent directories with `.agents/roles` or assume Claude discovers `.agents/skills`. Claude can still read a referenced file there as ordinary project context. Cursor also discovers `.claude/skills` for compatibility; copies remain synchronized, but its published skills guide does not specify deduplication across these roots. Check the installed app's skill catalog rather than promising that duplicate entries cannot appear.

The AI directories use LF line endings through `.gitattributes` so generated text stays identical across platforms. Supporting skill assets are copied as bytes.

## Skills

| Skill | Purpose |
|---|---|
| `commit` | Create authorized, scoped local commits |
| `commit-format`, `issue-format` | Format suggestions when requested |
| `make-closed-issue` | Create an authorized issue, scoped commit and PR |
| `review-and-merge-pr` | Triage PR feedback; fix/publish/merge only within the requested scope |
| `fix-merge-conflicts` | Resolve conflicts and verify the merged result |
| `release`, `release-description` | Prepare changelog/release wording and perform authorized release steps |
| `code-quality-review` | Review non-trivial diffs or an explicitly requested quality concern |
| [retro](../../.agents/skills/retro/SKILL.md) | Turn demonstrated mistakes into focused checks or guidance that prevent recurrence |
| `refactor-pass`, `deslop` | Requested cleanup of existing changes |
| `debug-agent` | Evidence-based debugging, with instrumentation when needed |
| `you-might-not-need-an-effect` | Focused effect/memo review |
| `vercel-react-best-practices` | Applicable React performance guidance; skip Next.js/server-only rules for this Vite client |
| `translate` | Generate translations, then apply maps through a single writer |
| `playwright-cli`, `inspect-elements` | Browser verification and DOM-to-source mapping |
| `profile-browsing` | Scoped browser and React profiling |
| `test-apk` | Local Android emulator procedures |
| `implement-plan` | Execute a plan with optional bounded delegation |
| `readme` | Maintain verified project documentation |
| `context7` | Retrieve version-appropriate library documentation |
| `find-skills` | Find additional skills when explicitly requested |

## Roles and models

Keep custom roles for `browser-check`, `profiler`, `test-apk`, `translator`, and `reviewer`. Use the harness's built-in worker/general-purpose or explorer role for ordinary implementation and code discovery. The parent assigns acceptance criteria and ownership; one owner runs heavyweight checks.

Codex agent files include `name`, `description`, and `developer_instructions`. `.codex/config.toml` caps concurrent children at four using `max_concurrent_threads_per_session`. Shared role metadata contains the name, description, and optional sandbox mode; it deliberately has no model fields.

Leave model and reasoning fields out of committed skills and custom agents in all three apps. This allows runtime invocation choices, user defaults, and parent inheritance according to each app’s documented precedence. Claude family aliases reduce version maintenance but still choose a family; a versioned Cursor model requires future updates. Keep such choices in user/session settings when needed. Inheritance does not promise an automatic choice of the best current model. Do not invent a `latest` alias or add model-catalog research to routine tasks. See [Codex selection](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Claude selection](https://code.claude.com/docs/en/sub-agents#choose-a-model), and [Cursor selection](https://cursor.com/docs/subagents#model-configuration).

`sandbox-mode: read-only` maps to Codex’s sandbox and Cursor’s `readonly`; Claude’s tool list and the role instructions restrict its review workflow, but Bash access is not an OS-level sandbox.

Shared skill frontmatter uses `disable-model-invocation: true` for user-invoked workflows where applicable. Codex's corresponding setting lives in `agents/openai.yaml` as `policy.allow_implicit_invocation: false`; the validator requires both. Invocation metadata supplements explicit authorization rules; a review request never authorizes publication merely because a skill includes publishing steps.

## Checks and discovery

- `yarn ai-workflow:sync` regenerates compatibility outputs using installed `js-yaml` and `smol-toml`.
- `yarn ai-workflow:check` parses source/frontmatter/configs, checks generated outputs, invocation metadata, model-field placement, and the formatter-only hook wiring. It does not resolve model identifiers against a provider catalog.
- `yarn ai-workflow:test` runs isolated Node fixtures for hook payloads, verification ownership, translation writers, and workflow generation/validation.
- After upgrading an agent application, verify skill/role discovery in that application. Syntax/parity checks do not replace a loader check. Reload the application if an existing session retains an old catalog.
- Hooks require the harness's project trust and hook review; do not bypass trust to make a check pass. See [hooks-setup.md](hooks-setup.md).

## Maintaining useful instructions

Follow [OpenAI’s skills and prompts guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) (reviewed 2026-09-12): keep descriptions precise, load details only when relevant, and preserve the user’s requested scope. Shared skills serve different models; retain project-specific invariants while allowing routine implementation choices.

Keep a skill’s purpose, decision boundaries, and essential constraints in `SKILL.md`. Link substantial mode-specific commands or examples as optional references. Put trigger conditions early in short descriptions; a matching keyword alone should not expand the task. Preserve existing invocation metadata unless its behavior is intentionally being changed.

After a substantial instruction change, exercise a few representative small and large requests. Check which skills/references were selected, whether actions stayed within scope, whether verification matched the change, and whether authorized work completed. Schema and fixture tests establish tooling correctness, not agent decision quality.

## Tools and browser ownership

Prefer the existing skill/tool catalog and installed project CLIs. Use `gh` for GitHub, `playwright-cli` for browser verification, and official/version-specific documentation when library behavior matters. Avoid installing duplicate skills or fetching an unpinned package merely to run an existing formatter.

MCP overhead depends on the harness: deferred tool loading can avoid loading every schema upfront. Keep integrations relevant rather than treating MCP itself as obsolete. Existing CLI choices remain useful for reproducibility and resource control.

All browser sessions use `./scripts/pw-session.sh`, which enforces one active browser machine-wide. Default to a fresh isolated session. Current personal-browser access needs explicit authorization; reuse that authorization in subsequent steps. Choose browsers/viewports for the affected behavior, run selected engines sequentially, close the exact named session in cleanup, and never use `close-all`/`kill-all`. See the `playwright-cli` skill and [verification.md](verification.md).
