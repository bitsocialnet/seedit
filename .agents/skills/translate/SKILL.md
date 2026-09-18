---
name: translate
description: Add, update, or remove seedit i18next translations when locale changes are requested.
---

# Translate

1. Determine the requested keys and English values from the user or `public/translations/en/default.json`. Discover supported languages from `public/translations/`; do not rely on a stale language count.
2. Translate each value naturally, preserving placeholders, brand names, technical terms, and HTML. Keep terminology consistent across related keys.
3. For a small change, prepare the maps directly. For substantial batches, delegate independent translation generation to at most four `translator` agents. Give each child its keys and a unique temporary map path. Children generate maps only; they never update locale files.
4. One writer validates and applies the maps, one key at a time. Include all supported languages and English. Review the dry-run diff before writing:

```bash
node scripts/update-translations.js --key <key> --map <unique-map.json> --include-en --dry
node scripts/update-translations.js --key <key> --map <unique-map.json> --include-en --write
```

5. The update script rejects a concurrent writer. Wait for the owner to finish and rerun against current files; never remove a live lock or bypass it. See `docs/agent-playbooks/translations.md` for interrupted-lock recovery.
6. Verify every requested key/language and placeholder after applying all maps. Remove only this task's temporary maps and report any uncertain translation.

Do not manually rewrite individual locale files. English fallback is allowed only for technical terms, brand names, or placeholders. Use `--delete` for an authorized key removal; use `--audit --dry` to inspect unused keys before an authorized `--audit --write`.

## Optional semantic QA

After deterministic coverage and placeholder checks, use `scripts/jev/translation-README.md` for read-only QA of explicitly selected changed keys/locales. It checks meaning, negation, conditions, scope, and terminology; it does not apply translations. Start with offline validation. Live calls require the task's authorization, runtime credentials, a pinned model, and a budget. Evaluate the labeled sample corpus before relying on a model/language combination; inspect false alarms and unverified results as well as detected errors. A model pass supplements review and does not replace the one-writer workflow or deterministic checks.
