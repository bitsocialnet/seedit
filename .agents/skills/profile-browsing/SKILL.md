---
name: profile-browsing
description: Measure seedit loading, navigation, interaction timing, and committed React updates using repeatable scenarios.
---

# Browsing performance

Define the affected route/interaction and observable completion. Use `scripts/react-perf/config.mjs` for covered deterministic flows; do not treat passing settings scenarios as proof about an unvisited feed.

Run `corepack yarn perf:check --scenario <name>` after a relevant React state/effect/subscription/rendering change. Use `corepack yarn perf:record --scenario <name>` for JSON and native Chrome traces, optionally `--url <origin>` to reuse a compatible instrumented server. The approved runner manages its isolated browser, resource lock, and owned server; a delegated profiler may use it directly. Keep browser work and heavy checks serialized and leave preexisting servers untouched. Install the pinned browser with `yarn perf:install` when absent. `perf:check` also runs compatibility fixtures; use `yarn perf:test` to run those alone after React/Bippy/collector upgrades.

Run `corepack yarn doctor:check` for source diagnostics on the task diff (`--base <base>` when the default base is unsuitable). Doctor findings guide investigation; its runtime summary is not a complete rerender counter. Runtime counts come from the bounded `window.__REACT_PERF__` Bippy collector, and actual subtree render timing comes from React's Profiler.

Read [measurement guidance](references/measurement.md) for covered scenarios, collector limits, profiling builds, and the evidence to return. If a new interaction is needed, the task owner can add an authorized scenario; a read-only profiling child reports the missing coverage without changing product code. Manual browser investigations still use `playwright-cli` through `./scripts/pw-session.sh`.

Compare the same flow with equivalent content, viewport, throttle, build mode, and capture settings. Return measured costs and counts with evidence, separating observed symptoms from suspected causes. Cheap expected updates alone do not justify an optimization.
