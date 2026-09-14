# Measure the affected flow

Use the task's URL, selected browser, real routes/content, and owned session. For a loading or interaction performance issue, include a Chromium low-spec pass with `./scripts/pw-throttle.sh <session> mid` (or the assigned profile). Apply it before measurement; Firefox/WebKit do not support this CDP helper. Record viewport, browser, throttle, cache state, dev/production build, and capture overhead so before/after samples are comparable.

## Browser evidence

Use existing evidence first. When timings alone cannot identify the affected phase, this small observer can be loaded before the app. Open `about:blank` with the wrapper, then run the function below through `playwright-cli -s=<session> run-code --filename=<task-owned-file>`. It needs a new document load to take effect; a hash-only transition does not run init scripts again.

```javascript
async page => {
  await page.addInitScript(() => {
    window.__PROFILING__ = true;
    window.__PROFILE__ = { longTasks: [], shifts: [], lcp: null, supported: [] };
    const observe = (type, collect) => {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
      window.__PROFILE__.supported.push(type);
      new PerformanceObserver(list => list.getEntries().forEach(collect)).observe({ type, buffered: true });
    };
    observe("longtask", e => window.__PROFILE__.longTasks.push({ start: e.startTime, duration: e.duration }));
    observe("layout-shift", e => {
      if (!e.hadRecentInput) window.__PROFILE__.shifts.push({ start: e.startTime, value: e.value });
    });
    observe("largest-contentful-paint", e => { window.__PROFILE__.lcp = e.startTime; });
  });
}
```

`__PROFILING__` suppresses the app's Agentation toolbar. Preserve the installed React DevTools hook; do not replace or wrap it merely to count commits. Unsupported observer types are unavailable measurements, not zero values.

- **Document load:** navigate to the full hash URL, explicitly reloading if the preceding navigation changed only the hash. Read `performance.getEntriesByType("navigation")` and measure when the actual feed/control becomes ready. The document load event can finish before peer content arrives; a reload is not automatically a cold-cache test.
- **Hash transition or interaction:** mark phase start, perform the action, wait for its observable completion, then mark phase end in the same document. Put those operations in one `run-code` invocation to avoid including idle time between CLI calls. Do not compare marks across reloads.
- **Scroll or repeated interaction:** capture phase start/end timestamps and filter long tasks/shifts to that interval. Hash routing retains counters; do not sum cumulative data again for each route. Collect results before a document reload discards them.

```bash
playwright-cli -s=profile-task eval '() => performance.getEntriesByType("navigation").map(n => ({ loadMs: n.loadEventEnd, domMs: n.domContentLoadedEventEnd }))'
playwright-cli -s=profile-task eval '() => window.__PROFILE__'
playwright-cli -s=profile-task console error
```

Raw layout-shift events, even with recent-input events excluded, are not the complete CLS session-window calculation. LCP describes a document load, not each hash navigation. Long tasks show main-thread stalls without identifying their cause. Treat all counts and thresholds as triage evidence; establish measured cost before recommending memoization or refactoring.

Use a [Playwright trace](../../playwright-cli/references/tracing.md) to correlate actions with requests/DOM state when useful; it is not a CPU sampling profile. Record missing peer content, dynamic tooling readiness, background activity, and instrumentation overhead as limitations.

## Automated React evidence

`yarn perf:check` runs compatibility fixtures, then the configured app scenarios with three samples at 4x CPU. `yarn perf:record` replays scenarios and saves JSON plus native Chrome traces, defaulting to one sample at normal CPU. Pass `--cpu 4 --samples 3` for comparable recordings. `--scenario`, `--target`, `--url`, and `--output` select coverage, reuse a compatible instrumented server, or choose artifact storage. `--actions <file>` loads a trusted local scenario module for an explicitly scoped new interaction.

```bash
corepack yarn perf:check --scenario display-name-draft
corepack yarn perf:record --scenario populated-feed --cpu 4 --samples 3
corepack yarn doctor:check --base HEAD
```

The runner owns its temporary browser/server lifecycle through the shared browser resource lock. Defer on contention and preserve preexisting sessions and servers. `yarn perf:install` installs its pinned browser; CI adds `--with-deps` for Linux system dependencies. `yarn perf:test` runs compatibility fixtures alone, including missing-instrumentation and deliberate-regression cases.

### Collector and timing semantics

Development and explicit profiling builds load the bounded Bippy collector before ReactDOM. `window.__REACT_PERF__.reset()` begins a new measurement epoch; `.snapshot()` returns schema-versioned component-instance/type/root/renderer/commit identities, mount/update/unmount events, source locations where available, root Profiler callbacks, and dropped-event/error counters. Preserve React DevTools' hook. Counts describe committed work, excluding aborted attempts and StrictMode function replays. The runner treats missing or dropped evidence as a failure, never as zero renders.

The root React `<Profiler>` supplies actual subtree render duration. This is not each component's self time; do not add overlapping ancestor and descendant spans to claim total CPU cost. Use the native trace to investigate effects, cascading updates, and main-thread work. Doctor remains an advisory source diagnostic; its runtime summary is not a complete rerender counter, and no count alone proves waste.

Normal production excludes the collector and Profiler boundary. For optimized React timing, use `yarn build:profile`, `yarn preview:profile`, then `--url <origin>`. The separate `build-profile/` uses `react-dom/profiling` with sourcemaps and preserves component names. A normal production preview only supplies page-level timing. Record build/capture overhead and compare equivalent content, viewport, throttle, and actions.

### Coverage and budgets

`scripts/react-perf/config.mjs` covers unsaved display-name typing/clearing, a local theme toggle, and the built-in mock community feed at `/#/s/memes.eth`. The feed scenario requires populated content, expands a post, and scrolls it. Mock protocol data and blocked external media isolate rendering from peer/CDN availability; this is not live transport performance or coverage of every pagination/comment path. No scenario saves the display-name draft or publishes content.

Exact update limits model local state changes (five keystrokes, one clear, one theme change). Feed limits bound the exercised expansion/scroll work. Timing limits are generous smoke ceilings, not product latency targets. Diagnose any failing sample from its JSON/trace before changing a budget; derive tighter limits from repeated baselines with fixed inputs. The runner waits for readiness and measures explicit action windows, so startup work must not be attributed to typing.

Return scenario/action, URL, build mode, browser/viewport/CPU, sample count, per-instance lifecycle counts and commits, root render duration, action latency, dropped/unavailable evidence, budget results, and JSON/trace paths. For visible-node attribution, use `inspect-elements` and the development-only `__ELEMENT_SOURCE__` helper. Agentation provides visual feedback, not performance evidence.
