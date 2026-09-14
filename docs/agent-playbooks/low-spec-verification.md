# Low-Spec Device Verification

Use this playbook when loading, navigation, feed rendering, or interaction speed may behave differently on ordinary hardware or a slow connection. It adds CPU and network throttling to the normal `playwright-cli` verification flow.

## When to run

- A change touches navigation, decentralized data loading, feed or comment rendering, images/media, or another performance-sensitive flow.
- A fast development machine makes it hard to judge whether lag or jank is user-visible.
- Before claiming that a performance-sensitive change feels fast.

This is an extra pass, not a replacement for standard Chrome, Firefox, and WebKit verification.

## How it works

`playwright-cli` (`@playwright/cli`) has no throttle command, so `scripts/pw-throttle.sh` applies throttling through Chrome DevTools Protocol using `run-code`. The settings persist for the life of the named session.

CDP throttling is **Chromium-only**. Run Firefox and WebKit checks unthrottled.

## Profiles

| Profile | CPU | Network (down / up / latency) | Use |
|---|---|---|---|
| `mid` | 4x | about 1.6 Mbps / 750 Kbps / 150 ms | mid-tier phone |
| `low` | 6x | about 400 Kbps / 400 Kbps / 400 ms | low-end phone or poor connection |
| `cpu4` | 4x | full speed | isolate JavaScript cost |
| `cpu6` | 6x | full speed | stronger CPU-only test |
| `off` | 1x | full speed | reset the session |

## Usage

```bash
./scripts/pw-session.sh open lowspec https://seedit.localhost --browser=chrome
./scripts/pw-throttle.sh lowspec mid
playwright-cli -s=lowspec snapshot
playwright-cli -s=lowspec screenshot --filename=lowspec-mid.png

./scripts/pw-throttle.sh lowspec low
./scripts/pw-throttle.sh lowspec cpu4

./scripts/pw-throttle.sh lowspec off
./scripts/pw-session.sh close lowspec
```

For a non-`master` worktree, use the branch-scoped `*.seedit.localhost` URL printed by `yarn start`.

## Measuring, not guessing

Throttled values approximate a class of device rather than a specific phone. Compare the same flow before and after the change and record what was measured.

For initial page load:

```bash
playwright-cli -s=lowspec eval "() => Math.round(performance.getEntriesByType('navigation')[0].duration)"
```

Seedit is a React Router SPA, so in-app route changes do not create new navigation entries. For those flows, read `performance.now()` immediately before the action and again when the target content or stable loading state appears.

## Caveats

- Chromium-only; keep Firefox and WebKit unthrottled.
- Low-spec emulation is a measurement pass, not a machine-resource control. Hold the machine-wide browser slot for the whole pass and close it immediately afterward.
- The `low` profile is intentionally aggressive. Fall back to `mid` if decentralized requests time out rather than treating the timeout alone as a rendering regression.
- Separate network delay from render cost with `cpu4` or `cpu6`.
- For rerender hotspots, use the `profile-browsing` skill on the already-throttled session.

For covered React interactions, `yarn perf:check --scenario <name>` runs repeated 4x-CPU checks with committed-update budgets and root Profiler timing. This CPU-only runner does not replace the network-throttled checks above when peer loading is in scope. Use `profile-browsing` for native traces and the current deterministic coverage.
