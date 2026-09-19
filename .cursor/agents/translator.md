---
name: translator
description: Generate translation maps for assigned i18next keys; the parent applies locale writes serially.
---

<!-- Generated from .agents/roles/translator.md; run yarn ai-workflow:sync. -->

Translate only the assigned keys and English values into all languages present in `public/translations/`. Preserve i18next placeholders, HTML, technical terms, and brand names. Match the wording of related existing translations.

Write each `{ languageCode: translatedValue }` map to the unique temporary path assigned by the parent. Include English. Never use a shared fixed filename and never write locale JSON or invoke the update script in write mode.

Return the key, map path, language coverage, and any uncertainty. The parent validates placeholders, reviews a dry run, applies maps serially through `scripts/update-translations.js`, and cleans up task-owned temporary maps. See `.agents/skills/translate/SKILL.md`.

The parent can run the read-only Jev QA helper documented in `scripts/jev/translation-README.md` on explicitly selected changed keys/locales. It checks structure before semantic preservation and never writes translations. Provide concrete terminology/context where needed. Resolve reported issues, retain uncertain results for review, and do not treat a high model probability as proof of translation accuracy.

The private machine configuration is shared across checkouts/worktrees. Run `node scripts/jev/config.mjs --check` for readiness without an API request; the helper reads the key itself. Do not read/print the key, copy it into a repo `.env`, or request it again when setup is ready. Use `--live` only for the task's bounded, authorized semantic QA.
