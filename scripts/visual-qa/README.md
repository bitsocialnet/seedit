# Optional screenshot checks

Use this developer helper after Playwright captures a task-approved screenshot. It asks narrow visual questions and reports advisory observations. Playwright still executes actions and checks DOM state; Bippy and React Profiler still measure rendering. A screenshot cannot establish hidden behavior, accessibility, persistence, or performance.

The current provider is OpenAI Decisions. The manifest and report describe the screenshot and criteria independently of its wire format; `decisions.mjs` owns the provider request and response mapping. Jev currently accepts text only. A future image provider needs an adapter and a new evaluation of its outputs and thresholds, not just a model-name change.

## Capture and run

Use the existing `playwright-cli` skill and `scripts/pw-session.sh` to manage the task's isolated browser. Capture only public or synthetic test content without credentials or private user data. Model calls are optional and never run from hooks, builds, or ordinary tests.

```sh
# While your task-owned Playwright session is open:
playwright-cli -s=check-task screenshot --filename=/absolute/task-artifacts/screenshot.png

# Save the manifest alongside that screenshot, then validate without network or credentials:
node scripts/visual-qa/check.mjs --input /absolute/task-artifacts/check.json

# Explicitly upload the selected screenshot and criteria for one bounded request:
node scripts/visual-qa/check.mjs --input /absolute/task-artifacts/check.json --live
```

Example `check.json`:

```json
{
  "version": 1,
  "screenshot": "screenshot.png",
  "checks": [
    { "id": "empty_state", "criterion": "The page visibly explains that there are no subscriptions." },
    { "id": "no_overlap", "criterion": "The main notice is readable and does not overlap the page controls." }
  ],
  "context": "A fresh test account viewing its subscriptions. Assess only what is visible."
}
```

Paths resolve relative to the manifest. Use an explicit local PNG or JPEG, at most 2 MiB and four million pixels. The helper accepts at most eight checks, reads the bounded image, records its SHA-256, and rejects symlinks, non-regular files, and changes during reading. All questions share the same captured image. It does not navigate, fetch remote images, execute commands, edit code, or approve changes.

## Private machine configuration

All checkouts use `$XDG_CONFIG_HOME/bitsocial/decisions.json`, or `~/.config/bitsocial/decisions.json` by default. Store a pointer to a private key file:

```json
{
  "apiKeyFile": "/absolute/path/to/private/openai-key.txt",
  "model": "gpt-6-luna"
}
```

Keep the config/key outside Git with owner-only permissions (`chmod 600`); the helper rejects group/other access. The key file may contain the raw key or one unambiguous `sk-` token in labeled text. Never put it in a repository `.env`, `VITE_*` variable, screenshot, manifest, CLI argument, or browser environment.

`OPENAI_API_KEY` overrides the private config; `OPENAI_API_KEY_FILE` selects an absolute key-file path when no key is supplied. Offline mode does not read either credential source. Explicit empty or invalid overrides fail rather than falling back silently. Live requests go only to `https://api.openai.com/v1/decisions`; redirects are rejected.

## Interpret the report

The choices are `satisfies`, `issue`, and `uncertain`. Low-confidence results, refusals, invalid responses, and provider failures require review. A successful helper exit means its requested advisory observations were satisfied; it never means the application passed its tests. Preserve failed Playwright assertions even when the screenshot looks correct, and inspect the image before acting on a flagged issue.

Default mode validates locally with zero requests. Live mode sends exactly one request, with no retries and a 30-second deadline. It reports provider usage and estimated input cost at the documented $0.10 per million input tokens. This is an estimate, not an invoice or a guaranteed dollar cap: image tokenization is provider-dependent. Missing metered usage stays unknown. Count/pixel/byte bounds limit the request; use provider billing controls for a hard account spending limit.

Keep manifests, screenshots, and reports in task artifacts outside Git when they contain private content. The report omits image bytes, raw provider bodies, credentials, and full local credential paths. Screenshot hashes identify captured bytes; they cannot prove that a screenshot reflects a later page state.

## Verification and comparison

```sh
node --test scripts/visual-qa/tests/*.test.mjs
node scripts/visual-qa/check.mjs --help
```

The tests use local images and mocked provider responses. A separate real screenshot smoke test establishes endpoint interoperability, not visual-regression accuracy. See the [Jev and Decisions comparison](comparison-2026-10-06.md) for the measured text-workflow results and why Jev remains the current text helper.

API contract: [Decisions guide](https://developers.openai.com/api/docs/guides/decisions), [request and response reference](https://developers.openai.com/api/reference/resources/decisions/methods/create). Provider capabilities and pricing were checked on 7 October 2026.
