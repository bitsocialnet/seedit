# Advisory semantic diff review

Use this optional development tool for rules that ordinary linters cannot establish: accurate completion states, actionable error copy, and evidence-backed claims. It never edits files, runs from a hook, or approves a release. Ordinary linting, tests, exact browser assertions, and reviewer judgment remain required.

```sh
# Explicit tracked files only; no credentials or network unless --live is added.
node scripts/jev/review.mjs --base HEAD --files src/example.ts,docs/example.md
node scripts/jev/review.mjs --base HEAD --files src/example.ts --live

# A task-owned JSON patch bundle also supports deleted/new files and explicit context.
node scripts/jev/review.mjs --input /private/path/selected-patches.json --live --max-requests 10 --max-cost-usd 0.01

# Synthetic labeled pilot; omit --live for offline validation.
node scripts/jev/review.mjs --input scripts/jev/fixtures/review.json --live --max-requests 12 --max-cost-usd 0.01
```

Paths are repository-relative and literal, including names containing Git pathspec metacharacters. `--base` compares a verified commit to the working tree, including staged and unstaged changes. The explicit file list is never widened. Git collection refuses symlinks, untracked/missing files, credential paths, unsupported extensions, and excessive input. For patch input, use `{ "version": 1, "items": [{ "id": "example", "path": "src/example.ts", "diff": "+changed code", "context": "Relevant surrounding behavior" }] }`. Optional per-item `rules` limits rule IDs. Optional `expected` labels stay local and produce evaluation metrics; do not include private content or secrets in patches/context. Common credential patterns are rejected, but this is not a comprehensive secret scanner.

All applicable rules for one patch share a bounded Choice request through the existing private machine configuration. `review-rules.json` has three narrow rules; `--rules` can select an explicitly reviewed JSON rubric with at most five rules. Rule IDs use letters, numbers, and underscores. Rule definitions are trusted configuration; code, comments, and context are evidence rather than instructions. If the selected patch alone cannot establish a judgment, provide explicit context or leave the result unverified.

Results contain only item/rule IDs, bounded choices, probabilities, latency, and usage, without patch text or raw provider output. Probability below 0.9, uncertain choices, provider errors, missing rules, and exhausted budgets are `unverified`. Exit codes: `0` all clear, `1` at least one issue, `2` incomplete/unverified (including offline mode). These codes describe advisory results, not a CI approval gate. No real API requests run in CI.

The 12 fixtures are synthetic and agent-authored, not independent historical review evidence. Metrics retain unavailable positive cases in recall, count definite answers on intentionally insufficient evidence as unsupported judgments, and show abstention on good patches. A small initial Jev pilot detected all five synthetic issues but also made one unsupported flag and abstained on two good patches. That is insufficient evidence for an automatic hook or a production quality claim. Evaluate representative independently labeled changes before changing the threshold or scope.

A separate two-case replay of the [5chan cached-board refresh fix](https://github.com/bitsocialnet/5chan/commit/4de1a890cbf982e299164de1ee149cf2d5d6e9d7) cleared the actual fix but left its reversed regression unverified. Those labels were agent-authored from source and regression tests, not independent human gold. The missed flag further supports advisory use and retaining deterministic regression tests.
