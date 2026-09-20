# Browser transport measurement

The helper uses the installed Playwright CLI's public `page.ariaSnapshot({mode: 'ai'})` when available. One command returns the ref-bearing snapshot, current URL and exact completion assertions. It still takes a separate fresh observation after each model choice and checks the same ref, exact locator, element identity, visibility, enabled state and origin before acting. This reduces CLI calls, not application loading or model inference time. Runtime `adapterMode` distinguishes `combined-aria` from the older `snapshot-command` fallback. A present method returning role snapshots without refs also falls back; other API failures remain incomplete.

The explicit benchmark runner compares against a trusted, retained pre-change repository tree containing `scripts/jev` and `scripts/pw-session.sh`. Keep that tree and results outside Git. Both versions use the same installed CLI, isolated profiles, machine-wide browser lock, plan, actions and assertions. The runner never starts an application server or installs packages.

```sh
# Validate only; no browser, credential discovery, or inference.
node scripts/jev/browser-benchmark.mjs --plan /task/theme.json --baseline-root /task/old-repo

# Actual browsers, zero model calls. Reuse an explicitly started local server.
node scripts/jev/browser-benchmark.mjs --plan /task/theme.json --plan /task/search.json \
  --baseline-root /task/old-repo --live --samples 3 --warmups 1 --evidence real-app

# Separately measure the budgeted model path using the same plans.
node scripts/jev/browser-benchmark.mjs --plan /task/theme.json \
  --baseline-root /task/old-repo --live --jev --samples 1 --warmups 0 \
  --evidence real-app --max-requests 20 --max-cost-usd 0.005
```

The shared private machine configuration supplies Jev credentials and the pinned model. `--live` explicitly authorizes browser execution; adding `--jev` enables model calls. The model budget applies across the entire invocation, including warmups. Each separate invocation has its own budget. Use `--evidence fixture` for synthetic pages; fixtures do not establish application correctness.

JSON stdout retains every run, including warmups and failures. Progress goes to stderr. Alternating pairs reduce order effects. Timing summaries exclude warmups and require both runs to complete with identical action histories and exact assertion booleans. A failed pair is never counted as a speedup. `combinedAdapterModes` identifies whether measured runs actually used the optimized API. Full lifecycle time includes setup, navigation, assertions and owned-session cleanup. Component durations and model latency are separate; control time overlaps component durations and must not be added to them. Control calls count helper subprocess invocations, with wrapper open/close each counted once; they are not CDP message counts. No thresholds, profiles or production settings are changed. Busy sessions and failed cleanup stop the benchmark.

These are small local measurements. State the tested plans, sample counts, browser/CLI version, fallbacks, failures and workload conditions before making a speed claim. Fixed flows should normally use ordinary deterministic Playwright checks.
