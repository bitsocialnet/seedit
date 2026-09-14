---
name: profile-browsing
description: Measure seedit loading, navigation, or interaction performance and investigate observed bottlenecks.
---

# Browsing performance

Define the affected route/interaction and the symptom or comparison to establish. Use current routes in `src/app.tsx`, hash URLs from `src/index.tsx`, and real populated content; do not assume example boards or community addresses are available.

Reuse a compatible server in this worktree. If one is needed, the task owner starts it in an owned terminal, records its process/session, and stops only that server afterward. A profiling child does not manage servers. Other tasks may have valid Vite processes.

Keep one browser active machine-wide through `./scripts/pw-session.sh`. Use the `playwright-cli` skill for session lifecycle and affected-flow coverage. Browser work and other heavy checks remain serialized. Profile a small flow directly; delegate a substantial independent route set to `profiler` only when useful, with a supplied URL, unique session name, criteria, and evidence to return. Wait for its browser cleanup before another browser task starts.

Run `yarn doctor:verbose` for source diagnostics; use `yarn doctor:scan <url> --format json` when a measured React runtime trace is needed. React Doctor runs outside the app and does not expose a browser report global. Follow the measurement reference for browser ownership and capture limits.

Read [measurement guidance](references/measurement.md) for browser observers, document-versus-hash timing, and this checkout's React evidence. Capture only what resolves the performance question; do not add instrumentation or new app tooling to satisfy a reporting template.

Compare the same narrow flow before/after with equivalent throttle, viewport, content, and capture settings. Report URLs, methods, observed cost, evidence paths, and unavailable metrics. Separate symptoms from inferred causes; cheap rerenders alone do not justify an optimization. Close the exact session on every exit path and leave preexisting servers/profiles untouched.
