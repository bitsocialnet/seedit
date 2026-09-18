# Optional Jev translation QA

This development-only helper flags translation meaning changes for a human or the existing translator agent. It never edits locale files, proposes replacement text, publishes content, or runs as part of the client application. It is advisory, not a release gate or a substitute for a fluent reviewer.

Use the Node version in `.nvmrc`. No new package is required. The shared `client.mjs` sends requests only to the official TypeSafe endpoint. Credentials come from `TYPESAFE_API_KEY` in the process environment; never put a key in a command argument, locale, task plan, or tracked file. Pin the model with `JEV_MODEL` or `--model`; model aliases are intentionally rejected.

## Scope before requesting inference

Locale mode requires both explicit target locales and either selected keys or Git filtering. It never defaults to scanning every language. Explicitly blank or comma-only `--keys`, `--locales`, `--changed-files`, and evaluation `--cases` filters are rejected; they never widen the selection. The root defaults to `public/translations`; `--translations-root about/public/translations` supports a nested app. English is read from `en/default.json`; flat and nested JSON keys are supported.

```sh
# Structural-only preview: no API request, no semantic pass claimed.
node scripts/jev/translations.mjs --locales it,fr --keys about_bitsocial

# Working tree versus a named commit/branch, including added untracked locale files.
node scripts/jev/translations.mjs --locales it,fr --base master

# Optional key intersection. Only changed keys in these locales are selected.
node scripts/jev/translations.mjs --locales it --base master --keys about_bitsocial

# Exact file selection: all keys in the named target files, or only their changed
# keys when --base is also supplied. English-file changes affect selected locales.
node scripts/jev/translations.mjs --locales it --changed-files public/translations/it/default.json

# Run only after the selected text is appropriate to send to TypeSafe.
node scripts/jev/translations.mjs --locales it --keys about_bitsocial \
  --live --model jev-1.13.0 --max-requests 5 --max-cost-usd 0.01
```

No matching pairs is an error, not a successful empty audit. Default selection is capped at 30 pairs; use a smaller scope or explicitly set `--max-pairs` (maximum 500). Requests are sequential, capped at 20 by default, and stop reaching the API after the request, input, time, or estimated cost budget is exhausted. Remaining pairs are reported `unverified`. The request cap counts actual requests, excluding structural failures and valid cache hits. The cost budget reserves a conservative input estimate; actual reported usage remains separate. Missing usage or failed requests are not evidence of zero cost.

## What it checks

Deterministic checks run first and do not call Jev for failing pairs:

- Missing/non-string English or target values, and empty translations.
- Changed or missing i18next `{{...}}`, `${...}`, and printf placeholders, including multiplicity.
- Changed markup tags/attributes, or unbalanced tag nesting.
- Changed HTTP(S) URLs, backtick code spans, Ethereum-style addresses, and common `Qm` content identifiers.

These checks cover common formats rather than every Markdown or localization grammar. Retain existing repository structural validators, especially for documentation links, code fences, front matter, and file alignment. Preserving a technical term exactly may still require an explicit existing validator or glossary.

For each structurally valid pair, one request asks three independent narrow questions: core meaning and negation; conditions, qualifications, and scope; technical terminology. Only the selected English text, translation, locale, and explicitly provided context are sent. Key names, paths, expected fixture labels, and unrelated repository text are excluded. Embedded instructions in the pair are treated as material to assess, not commands.

Each question returns `preserve`, `issue`, or `uncertain`. An `issue` flags the pair. All three must select `preserve` with probability at least 0.95 for an advisory pass; otherwise the result is `unverified`. This threshold is a conservative routing heuristic, not a measured 95% accuracy guarantee. Errors, timeouts, throttling, exhausted budgets, model mismatches, and invalid answers never become passes. Reports name affected locale/key/path and issue categories without echoing the source or translation.

Exit codes: `0` means every selected pair passed; `1` means at least one pair was flagged (the JSON may also contain unverified pairs); `2` means no flags but incomplete verification, or invalid input. A normal structural-only preview exits `2` when semantic checks remain pending. Keep this optional tool outside mandatory CI unless language quality is independently validated.

## Selected documentation paragraphs

Supply explicit pairs instead of rewriting or automatically aligning Markdown. `key` is a stable identifier, `path` helps the reviewer locate the text, and `context` optionally explains terminology. `--context '...'` adds shared domain context. Larger inputs are bounded by the shared client's per-request limit.

```json
{
  "pairs": [
    {
      "key": "privacy.private-key-warning",
      "path": "docs/it/privacy.md",
      "locale": "it",
      "source": "Do not share your private key.",
      "translation": "Non condividere la tua chiave privata.",
      "context": "A private key authorizes account actions."
    }
  ]
}
```

```sh
node scripts/jev/translations.mjs --pairs /path/to/selected-pairs.json
node scripts/jev/translations.mjs --pairs /path/to/selected-pairs.json \
  --live --model jev-1.13.0 --max-requests 5 --max-cost-usd 0.01
```

Optional `--keys` and `--locales` narrow a pairs file. Duplicate locale/key identifiers are rejected. Existing docs structural checks should run before extracting paragraphs for semantic review.

## Cache and privacy

Live review caches only a content hash, pinned model, timestamp, and validated choice/probability results. Cache files contain no source, translation, context, key, path, credential, or invented correction. Hash identity includes source, translation, locale, model, context, and the exact rubric; entries expire after seven days. Storage defaults to `$XDG_CACHE_HOME/bitsocial-jev/translations` or `~/.cache/bitsocial-jev/translations` with directory mode 0700 and file mode 0600. Use `--cache-dir` to choose a private directory or `--no-cache` to disable it. Offline previews do not consume cached semantic approvals. Cached results are clearly identified and do not claim new provider usage.

## Evaluate before relying on a language

The shipped 17-case pilot contains good and deliberately corrupted translations in Italian, French, German, Spanish, Portuguese, and Japanese, including a reversed prohibition whose placeholders still match. It also covers changed qualifiers, terminology, injection-like translated text, and deterministic failures. It is small and hand-labeled, not representative multilingual accuracy.

```sh
# Offline mechanics and structural checks only; accuracy metrics remain null.
node scripts/jev/translations-eval.mjs

# Fresh, budgeted semantic evaluation: no cache, expected labels withheld.
node scripts/jev/translations-eval.mjs --live --model jev-1.13.0 \
  --max-requests 20 --max-cost-usd 0.01

# Small sample or a separately reviewed expanded corpus.
node scripts/jev/translations-eval.mjs --cases it-negation-good,it-negation-bad \
  --live --model jev-1.13.0 --max-requests 2
node scripts/jev/translations-eval.mjs --corpus /path/to/labeled-pairs.json --live --model jev-1.13.0

node --test scripts/jev/tests/translation.test.mjs
```

An evaluation corpus uses the pairs schema plus `expected: "pass" | "flagged"` and a descriptive `category` (`structural` for deterministic-only cases). The report separates all checks from semantic cases, reports recall, false alarms, misses, unverified results, and actual provider usage with estimated cost. Unverified issue cases stay in the recall denominator. Offline tests prove scoping, privacy, and failure handling; they do not prove that Jev can assess a language correctly. Add independently reviewed examples from the languages and product copy being changed before making it a routine quality gate.
