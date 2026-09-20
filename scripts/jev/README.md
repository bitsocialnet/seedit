# Optional Jev development helpers

These Node 22 scripts run outside the shipped application. They do not replace Playwright assertions, visual review, translation review, or Bippy/React Profiler measurements. No helper installs dependencies, starts an application server, or sends a model request by default.

## One-time local credentials

All Jev helpers share the developer-machine file `$XDG_CONFIG_HOME/bitsocial/jev.json`, or `~/.config/bitsocial/jev.json` when `XDG_CONFIG_HOME` is unset. Configure it once outside your repositories; new checkouts and worktrees use it automatically. Store a pointer to your existing key file, not a copy of the key:

```json
{
  "apiKeyFile": "/absolute/path/to/private/typesafe-key.txt",
  "model": "jev-X.Y.Z"
}
```

Replace the path and model with your private key file and an available pinned version. The key file contains only the API key. On macOS/Linux, keep its permissions and the config file at `600` and the config directory at `700`. No user-specific path or model default belongs in the repository. `.env` files are not automatically loaded, and no shell startup changes are needed.

Check setup from any checkout without making a provider request:

```sh
node scripts/jev/config.mjs --check
```

The result reports only readiness, pinned model, and a safe error code if unavailable. Live browser and translation commands then work without exporting the key. Helpers read configuration only for a live Jev run or this explicit check; offline validation and `--live --baseline` do not read credentials.

Runtime overrides are supported: explicit client options/`--model`, then `TYPESAFE_API_KEY` (or `TYPESAFE_API_KEY_FILE` when no key is set) and `JEV_MODEL`, then machine defaults. `JEV_CONFIG_FILE` selects another absolute config path. Empty overrides fail instead of silently using another credential. Config and key-file paths must be absolute; `~` inside JSON or environment variables is not expanded. Complete key/model overrides work without reading a machine config. Invalid explicit configuration fails before the browser opens or an API request runs.

For CI, supply `TYPESAFE_API_KEY` from the CI secret store and `JEV_MODEL` from workflow configuration only in an explicitly requested live job. The included Jev CI workflow stays offline. Never use `VITE_*` variables, commit credentials, add them to plans or CLI arguments, or expose them to page JavaScript. The helper sends credentials only to `https://api.typesafe.ai/v1/systemone` and rejects redirects. It strips the key and credential-location overrides from the browser subprocess environment; it never exports a file-loaded key into the parent environment.

## Browser plans

Start with the repository's `playwright-cli` skill and inspect the actual page. Write a task-owned JSON plan with the exact allowed roles, accessible names, values, and completion assertions. Keep the plan outside tracked files if it contains private test content. The plan author, not page text or Jev, authorizes actions. Use an isolated local test server first.

```sh
# No browser or network: validate a plan.
node scripts/jev/browser.mjs --plan /path/to/plan.json

# Same plan, no model: choose the first available unused action in plan order.
node scripts/jev/browser.mjs --plan /path/to/plan.json --live --baseline

# Uses the private machine config, or runtime key/model overrides.
node scripts/jev/browser.mjs --plan /path/to/plan.json --live

# Runtime model override, if needed; no default or latest alias is committed.
node scripts/jev/browser.mjs --plan /path/to/plan.json --live --model jev-X.Y.Z
```

Browser and translation helpers use the shared credential configuration above. Keep the key outside the repository and application bundle.

The helper opens and closes its own isolated session through `scripts/pw-session.sh`. A busy shared browser slot returns `incomplete/browser_slot_busy`; retry after its owner finishes. It finds an installed `playwright-cli` in the root, `webui/`, or `packages/admin/`, then PATH. `PLAYWRIGHT_CLI_BIN` can select an existing executable; relative paths resolve from the invocation directory before the session changes directories. It never invokes `npx` or bypasses the lock. `--baseline` requires `--live`; the incomplete result rejects that flag combination when execution was not explicitly enabled.

This illustrative plan must be adapted to controls actually observed on the target page:

```json
{
  "version": 1,
  "url": "http://127.0.0.1:4173/",
  "goal": "Open Settings, select Dark, then close Settings.",
  "actions": [
    { "id": "open", "op": "click", "role": "button", "name": "Settings" },
    {
      "id": "theme",
      "op": "select",
      "role": "combobox",
      "name": "Theme",
      "value": "Dark",
      "within": { "role": "dialog", "name": "Settings" }
    },
    {
      "id": "close",
      "op": "click",
      "role": "button",
      "name": "Close",
      "within": { "role": "dialog", "name": "Settings" }
    }
  ],
  "requiredActions": ["open", "theme", "close"],
  "assertions": [
    { "type": "bodyClass", "value": "dark", "present": true },
    { "type": "role", "role": "dialog", "name": "Settings", "state": "hidden" }
  ],
  "reloadBeforeFinal": true,
  "limits": { "maxSteps": 8, "deadlineMs": 120000, "maxSnapshotBytes": 40000, "maxCostUsd": 0.01, "minProbability": 0.8 }
}
```

- Actions support `click` (button/link/tab/menuitem), `fill` (textbox/searchbox), `select` (combobox by exact option label), `check`, and `uncheck`. Values come only from the plan. Each action runs at most once unless `maxUses` explicitly allows up to three attempts. `nth` is a zero-based index for an intentionally duplicated role/name; otherwise duplicates are unavailable. `within` restricts a target to an exact named role.
- `requiredActions` must be present; use `[]` only when no action is required. Completion always requires every exact assertion, regardless of what the model predicts. Assertions support full URL equality; a body class present/absent; and a role's `visible`, `hidden`, `checked`, `unchecked`, `value`, or exact `text` state. Value/text assertions use `equals`.
- `reloadBeforeFinal` proves those assertions again after reload. It is useful for persistence checks; it should be off for deliberately transient states.
- `allowRemote: true` explicitly permits an HTTPS non-local starting URL. All subsequent top-level navigation stays on that exact origin. Popups are closed; service workers are blocked. This is a scope guard, not a network sandbox: applications can still make their normal requests.
- Common login/publication/payment/destructive labels are blocked unless the plan explicitly sets `allowSensitiveActions: true`. Label matching is not proof of safety: inspect the allowlist and expected effects yourself. Do not use real credentials, public posting, or payment flows without task authorization.
- Plan/schema errors, absent/ambiguous controls, uncertain choices, API failures, step/time/budget limits, assertion failures, and cleanup failures return `incomplete`. If a selected control disappears or its ref changes during a decision, the helper discards that decision and makes up to two fresh plans within the existing step/request/time budgets. Continued target churn returns `incomplete/stale_target`; stale actions are never executed. Unsupported snapshot serialization is unavailable, never guessed. The coding agent can inspect the page and continue with ordinary Playwright.

Each decision uses a fresh snapshot, only currently observed approved controls, a strictly validated typed response, and a pinned returned model. After Jev answers, the helper refreshes the snapshot again and checks the same ref; fixed Playwright code checks the exact role/name locator, element identity, visibility, enabled state, and origin immediately before acting. The model cannot supply JavaScript, selectors, shell commands, arbitrary URLs, or a passing result.

JSON stdout includes a bounded, key-redacted plan path relative to the invocation directory, status, action IDs, exact assertion booleans, advisory results, the `staleReplans` count, elapsed time, and sanitized usage totals. Exit `0` means offline validation succeeded or the exact assertions and all requested semantic checks were satisfied; exit `2` means incomplete/invalid or semantic review is needed. A wrapper warning that its browser close failed returns `incomplete/cleanup_failed`, even when the wrapper exits zero. The plan reference distinguishes route-specific runs without repeating full URLs that may contain query or hash secrets. Private temporary browser output is removed during cleanup. A failed close or forced termination can leave the owned session behind; identify the exact session through the shared wrapper before cleanup.

## Semantic text checks

Optionally add checks to a browser plan:

```json
{
  "semanticChecks": [
    {
      "id": "posting_error_help",
      "role": "alert",
      "name": "",
      "criterion": "Explains why this attempted operation failed and gives an actionable next step."
    }
  ]
}
```

After exact completion assertions pass, the helper freshly reads text from that unique visible target and asks one narrow question. Results are `satisfies`, `issue`, `uncertain`, or `unavailable`, always advisory. An issue, uncertainty, or unavailable answer requires human/agent review: the overall result is `incomplete`/exit `2`, with `flowCompleted: true` preserving the separate exact completion evidence. Baseline runs report `not_run`, require review for those requested checks, and make no Jev calls. Semantic checks cannot validate layout/screenshots, diagnose wasted React renders, or overrule a failed deterministic assertion.

Use only task-approved test content: relevant page text is sent to TypeSafe. The helper does not use personal profiles or persist prompts, raw model responses, or page snapshots in its final report. A full snapshot may contain peer content; keep fixtures/public test data small and intentionally scoped.

## Budgets and evidence

The shared client enforces request count, per-request UTF-8 bytes, a cumulative conservative input-token reservation, spend reservation, and time limits. It never retries automatically. Failed calls consume reservation too. Cost estimates use $0.042 per million input tokens and free output, the documented rate when introduced; confirm current provider pricing before treating estimates as bills. `usageMissing` counts requests with unknown billed input, including errors; when nonzero, `estimatedCostUsd` is `null` and `knownCostSubtotalUsd` is only the known subtotal. Actual metered tokens and the conservative reservation are reported separately; the latter is not a billing guarantee.

The default browser bounds are eight actions, 120 seconds, 40 KB snapshots, a $0.01 reservation, and a minimum selected-choice probability of 0.8. This probability is a routing threshold, not a calibrated probability that the test is correct. A pinned model is chosen through runtime environment/arguments so upgrades remain intentional.

Compare the same plan in baseline and Jev modes, across multiple representative flows. Count full-loop time, incomplete runs, cleanup, and API usage as well as model latency. Jev only accelerates the agent's decision layer; an already deterministic Playwright script is often faster and should stay deterministic. Keep the existing profilers and measured performance budgets unchanged.

## Offline verification

```sh
node --test scripts/jev/tests/*.test.mjs
node scripts/jev/browser.mjs --help
```

These fixtures cover multiple actions in one invocation, strict provider validation, bounded requests, injection-resistant action scope, changed targets, origin drift, persistence, uncertainty, and failure cleanup. They never open browsers or call an API. Real installed-CLI and application smoke checks remain necessary before relying on a new plan.

For changed-locale semantic review and its labeled evaluation fixtures, see [translation QA](translation-README.md).

For explicitly selected code and documentation changes, use [advisory semantic diff review](review-README.md). It is opt-in and never runs as an automatic repair or approval hook.

For transport modes and an explicit paired measurement runner, see [browser transport measurement](browser-benchmark-README.md).
