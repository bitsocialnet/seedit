# src/AGENTS.md

These rules apply to `src/**`. Follow the repo-root `AGENTS.md` first, then use this file for code inside the application source tree.

- Before adding new state, decide whether it belongs in render, a reusable hook, or a Zustand store. Do not duplicate the same state logic across views.
- Use `@bitsocial/bitsocial-react-hooks` for data access. Do not add data-fetching `useEffect` calls or effects that only synchronize derived state.
- Read `DESIGN.md` before visual, layout, or theme work. Preserve Seedit's compact old.reddit-inspired hierarchy and verify both light and dark themes.
- For state/effect/data-flow or rendering-performance changes, review relevant React guidance. Choose checks and browser/viewports using `docs/agent-playbooks/verification.md`; a copy edit alone does not require React Doctor or a full build.
- Prefer extending the colocated `*.test.ts(x)` file next to already-covered behavior.

## Module boundaries

`yarn boundaries` (run by `yarn lint` and `yarn agent:verify`) checks these rules; test files are skipped. Fix a reported violation by moving code, not by widening the import. There is no allowlist: if a rule conflicts with the requested change, restructure within scope or raise it with the user rather than editing the checker.

- Dependencies flow one way: `constants`/`data` → `lib`/`plugins` → `stores` → `hooks` → `components` → `views` → `app.tsx`. A lower layer never imports a higher one; when a `lib` helper needs a type or function that lives in a hook or component, the shared part belongs in `lib`.
- `views`, `components`, `hooks`, `lib`, `lib/utils`, and `stores` are category folders, not modules. A folder inside one (`components/post`) is a module, and its subfolders are private to it.
- Import a module only through its `index.ts` (`../../components/post`), never its inner files, subfolders, or stylesheets. Anything used by more than one module lives at category level (`components/<name>`).
- Views never import other views. Shared page layout or styles go in a `components/` module such as `feed-layout` or `static-page`.
- Every route target is a top-level view at `views/<name>`, named without a `-page` suffix; a view's index may also export a guarded variant of that same view. A subfolder of a view is a private section of that view, not a route.
- Keep the import graph acyclic. When two modules need each other, pass the dependency in as a prop or move the shared part down a layer.
