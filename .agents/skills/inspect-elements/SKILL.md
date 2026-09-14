---
name: inspect-elements
description: Map a visible seedit DOM node to its React source when file or component attribution is needed.
---

# Inspect Elements

For contributor-supplied visual feedback, use the development-only Agentation toolbar: select the element, annotate it, and copy its structured context into the task. Verify the supplied selector and nearby source before editing. The toolbar is hidden when `__NO_DEV_TOOLBAR__`, `__VISUAL_TESTING__`, or `__PROFILING__` is set; source inspection remains available independently. Agentation is not a render profiler.

Map the requested live DOM node to source using the dev-only `window.__ELEMENT_SOURCE__` helper. Use an existing compatible dev server in this worktree or record ownership of one started for the task; production does not expose the helper.

Reuse a compatible session supplied by the calling task when it already owns the browser slot; use its exact name and leave its lifecycle with that caller. Otherwise open an owned session through `./scripts/pw-session.sh`. Use `-s=<session>` on every command. The examples use `inspect`; substitute the actual name and URL, and skip `open` when reusing a session:

```bash
./scripts/pw-session.sh open inspect https://seedit.localhost/#/s/all
playwright-cli -s=inspect eval "window.__ELEMENT_SOURCE__?.ready ?? false"
playwright-cli -s=inspect snapshot
playwright-cli -s=inspect eval "async el => JSON.stringify(await window.__ELEMENT_SOURCE__.resolve(el))" e7
```

Choose `e7` from the current snapshot; do not reuse a stale ref. If the helper is not ready, check `window.__ELEMENT_SOURCE__?.error` and allow its dev import to complete. Report persistent errors or missing helpers instead of guessing an attribution.

The result's `source`, `componentName`, and `stack` identify the node's file/line and React ownership. Inspect the source before editing; an attributed file is a starting point, not proof that it causes the reported behavior. For a compact trace, use `window.__ELEMENT_SOURCE__.formatStack(info.stack, 5)` on a resolved result.

When a snapshot ref is impractical, use `resolveBySelector(selector)` for a precise selector or `resolveAtPoint(x, y)` for viewport coordinates. If `source` is null, inspect useful stack frames or a nearby parent. Report an unresolved node when both are empty.

Close the exact session in cleanup only when this inspection opened it, including on resolution failure. Leave a caller-owned session open for the caller to continue and close:

```bash
./scripts/pw-session.sh close inspect
```

For a new session, a slot owned by another task is a reason to wait or use the wrapper's bounded wait, never to bypass the lock. Do not wait on the calling task's own session; reuse it as described above. Stop only a server this task started. Use the `playwright-cli` skill for session operations and `profile-browsing` only when performance measurement is part of the request.
