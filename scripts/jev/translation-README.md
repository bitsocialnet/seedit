# Optional Jev translation QA

This development-only helper flags translation meaning changes for a human or the existing translator agent. It never edits locale files, proposes replacement text, publishes content, or runs as part of the client application. It is advisory, not a release gate or a substitute for a fluent reviewer.

Use the Node version in `.nvmrc`. No new package is required. The shared `client.mjs` sends requests only to the official TypeSafe endpoint. Live commands use the private machine configuration described in [shared setup](README.md): `$XDG_CONFIG_HOME/bitsocial/jev.json` or `~/.config/bitsocial/jev.json` points to one existing key file and selects a pinned model. `TYPESAFE_API_KEY` or `TYPESAFE_API_KEY_FILE` can override the credential source; `--model` or `JEV_MODEL` can override the configured model. Never put a key in a command argument, locale, task plan, tracked file, or per-repo copy. Model aliases are rejected. Offline commands read neither the machine configuration nor its key file.

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
  --live --max-requests 5 --max-cost-usd 0.01
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
  --live --max-requests 5 --max-cost-usd 0.01
```

Optional `--keys` and `--locales` narrow a pairs file. Duplicate locale/key identifiers are rejected. Existing docs structural checks should run before extracting paragraphs for semantic review.

## Cache and privacy

Live review resolves the configured pinned model before reading or writing a cache entry; changing that model selects a different cache identity. It caches only a content hash, pinned model, timestamp, and validated choice/probability results. Cache files contain no source, translation, context, key, path, credential, or invented correction. Hash identity includes source, translation, locale, model, context, and the exact rubric; entries expire after seven days. Storage defaults to `$XDG_CACHE_HOME/bitsocial-jev/translations` or `~/.cache/bitsocial-jev/translations` with directory mode 0700 and file mode 0600. Use `--cache-dir` to choose a private directory or `--no-cache` to disable it. Offline previews do not consume cached semantic approvals. Cached results are clearly identified and do not claim new provider usage.

## Evaluate before relying on a language

The shipped 25-case corpus contains **model-authored synthetic** good/corrupt translations in Italian, French, German, Spanish, Portuguese, and Japanese. It is not human-reviewed gold or a representative multilingual benchmark. Contrast groups cover polarity, placeholders, qualification, terminology, publication state, actors, exceptions, scope, and injected instructions. Nineteen cases belong to calibration and six to a separate illustrative holdout. Those six were already present in the earlier pilot: they demonstrate split mechanics, not a newly unseen or independent test set. Their labels remain excluded from provider state.

```sh
# Offline mechanics and structural checks: metrics remain null, zero requests.
node scripts/jev/translations-eval.mjs

# Fresh calibration only; no cache. Compare routing thresholds without applying one.
node scripts/jev/translations-eval.mjs --live --split calibration \
  --thresholds 0.8,0.9,0.95,0.99 --max-requests 20 --max-cost-usd 0.01

# Final holdout after fixing the threshold and corpus; copy SHA256 from the report.
node scripts/jev/translations-eval.mjs --corpus /path/to/reviewed-pairs.json \
  --split holdout --expected-corpus-sha256 CORPUS_SHA256 --pass-threshold 0.95 --live

# Human-review queue: uncertain examples plus a reproducible random complement.
node scripts/jev/translations-eval.mjs --split calibration --live \
  --audit-uncertain 5 --audit-random 5 --seed september-review

node --test scripts/jev/tests/translation.test.mjs scripts/jev/tests/translation-evaluation.test.mjs
```

`--cases` further narrows one selected split. A holdout case requested from calibration is an error. Holdout never participates in threshold sweeps or the audit queue; there is no mixed/all-splits mode. `--pass-threshold` changes this evaluation only, never the translation helper's existing 0.95 routing heuristic. Labels, groups, review metadata and split names are withheld from Jev. The CLI always bypasses cache and reports actual usage separately from estimated cost. Exit `1` means observed false pass/alarm, `2` means unverified or offline results, and `0` means no observed error or abstention on the selected cases; none establishes general accuracy.

Metrics separate deterministic and semantic checks. They include issue recall (unverified issues remain in its denominator), false alarms, false passes among accepted pairs, pass coverage, abstention, and error among verified decisions. The Wilson 95% upper bound on false-pass risk is intentionally nonzero even after a small zero-error run; its sampling assumptions do not turn synthetic or targeted cases into representative data. Calibration score bands show empirical defect frequency versus the **minimum preservation probability across dimensions**, a routing score rather than calibrated pair correctness. Sweeps are descriptive and do not recommend or install a threshold.

Audit output contains locale/key identifiers and selection reasons, never source/translation text. Resolve those identifiers in the private local corpus for human labeling. The random sample is reproducible for a seed and comes from the remaining selected cases after uncertain selection; it is not a population estimate. Reviewers should inspect source and target language independently of the model's verdict. Human review and approved corpus updates remain manual. New examples may omit `expected` only in an explicit `audit` split with `unreviewed` provenance. They enter the review queue, never the accuracy denominators; fully unlabeled runs report null accuracy metrics and exit `2`.

### Bring an independently reviewed corpus

Use the same paragraph-pairs fields, plus a versioned envelope and explicit per-pair assignments:

```json
{
  "schemaVersion": 1,
  "corpusId": "product-copy-review-2026-09-v1",
  "provenance": { "kind": "independently-reviewed", "authoredBy": "human" },
  "pairs": [
    {
      "key": "private_key_warning",
      "locale": "it",
      "source": "Do not share your private key.",
      "translation": "Non condividere la tua chiave privata.",
      "expected": "pass",
      "category": "negation",
      "group": "private-key-warning",
      "split": "calibration",
      "review": { "labelSource": "human", "reviewer": "reviewer-local-id" }
    }
  ]
}
```

Provenance kinds are `synthetic`, `unreviewed`, or `independently-reviewed`; the last requires human reviewer metadata for each label. Metadata is an assertion by the corpus author, not authentication of a review. Assign whole contrast/paraphrase families to `calibration`, `holdout`, or `audit` **before** experimenting. Reused group IDs or normalized identical English source+locale across splits are rejected; semantic paraphrase leakage still requires human care. Keep the holdout fixed and use its corpus hash to detect any content/label/split change. Do not repeatedly tune from holdout results; reserve a new independent holdout after doing so.

Legacy arrays and unversioned `{ "pairs": [...] }` files remain supported as **unreviewed calibration-only** input. They provide no independent holdout or accuracy claim. Inputs are capped at 4 MiB/5,000 records and each run selects at most 100 pairs. Add representative, independently reviewed examples from the actual locales and product copy before adopting any quality gate.

## Blind human review

Use `prepareTranslationReview` from `translations-review.mjs` and `reviewHtml` from `review-handoff.mjs` to turn explicitly selected, sanitized public repository pairs into a local blind queue. Supply the original English/translated text, repository-relative paths and full Git SHA, normalized source groups, and a frozen calibration/holdout assignment before labeling. Identical normalized English strings in the same locale cannot cross splits, including across repositories. The queue includes exact rubric/content/source identities but no expected labels or model answers. The HTML makes no external requests and has no submission or auto-save; download answers explicitly and resume the downloaded draft if needed.

```sh
node scripts/jev/translations-review.mjs --queue translations-queue.json --review bitsocial-human-review.json --out human-review-v1
node scripts/jev/translations-eval.mjs --corpus human-review-v1.corpus.json --split calibration
```

Import requires a reviewer ID, valid date, and an explicit independent-human attestation. Duplicate/conflicting labels, changed identities, unknown items, and reused output paths are rejected. Source provenance stays separate from label provenance: actual repository strings may receive human labels, but reviewed synthetic examples stay synthetic. Reviewer identity is self-attested, not independently authenticated. A model field of null means no model was run for the handoff.

Blank and uncertain / needs context labels remain pending in the complete manifest with their original group and split. Only decided labels enter the native evaluator corpus; if none are decided, no corpus is written. Deterministic structural failures keep their structural category and are excluded from semantic-only calibration metrics. Do not claim complete holdout accuracy while any holdout item remains pending, retune using holdout labels, or treat a small curated sample as representative multilingual accuracy. The second command above is offline validation only. Retain the original queue JSON unchanged; its hash binds returned reviews. These tools do not read credentials, call providers, ingest private traffic, or alter runtime thresholds. Inputs must already be sanitized; the common-secret guard is not a privacy guarantee.

## Contrastive rubric trial

The evaluation runner accepts `--rubric baseline|contrastive` (default: `baseline`).
The trial adds illustrative boundaries for actor/action, permission, scope and technical concepts.
These are authored examples, not learned human labels or a measured accuracy improvement.
Normal `translations.mjs` QA, its cache and all thresholds remain unchanged.
Each evaluation reports its rubric variant and exact question hash; evaluations never use the QA cache.

```sh
# Dry runs: no provider calls; metrics stay null (exit 2).
node scripts/jev/translations-eval.mjs --corpus reviewed-pairs.json --split calibration --rubric baseline
node scripts/jev/translations-eval.mjs --corpus reviewed-pairs.json --split calibration --rubric contrastive
# Add --live with the existing request/cost limits for an explicit API evaluation.
```

Compare the same corpus hash, cases, pinned model, split and threshold, changing only the rubric.
Review and revise examples on human-labeled calibration data before freezing the candidate rubric.
Then evaluate the untouched holdout with `--expected-corpus-sha256 HASH --split holdout`.
Do not copy holdout text or answers into examples; if inspected for tuning, replace that holdout.
The current synthetic fixtures can check plumbing but cannot establish production accuracy.
