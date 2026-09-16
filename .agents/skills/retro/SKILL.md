---
name: retro
description: Review a coding session, bug fix, or substantive review correction for evidence-backed ways to prevent recurrence, using existing checks and focused guidance.
---

# Retro

Turn a demonstrated mistake or repeated obstacle into the smallest useful improvement to this repository's development workflow. A finding that existing checks already cover, or that needs no additional prevention, is a valid outcome.

## Establish the evidence

Use the current task's conversation, diff, review feedback, and available failure output. For another session or PR, use the evidence the user identifies; state missing context rather than inventing a history or searching unrelated sessions. Routine successful edits do not need a retrospective.

Read applicable `AGENTS.md` guidance and the relevant package/build scripts, check configuration, hooks, and CI jobs before proposing a check. Distinguish a missing check from one that exists but is unwired, skipped, or unable to fail its caller. During an explicit repository-wide retrospective, absent automated lint, type, or test enforcement is itself worth reporting. Inspect configuration first; do not launch a full build or test suite just to inventory it.

## Choose useful prevention

- For a mechanical issue, prefer a deterministic check over another prose rule: an existing linter option, a focused regression test, or a small extension to the repository's checker. Reuse the normal check commands and CI; use a commit hook only for checks that are fast and suitable for staged changes.
- For behavior bugs, cover the failing behavior or invariant. For syntax, imports, or module placement, prefer the existing parser/linter or architecture checker. Avoid broad text matches that confuse valid code with the defect.
- For a judgment call that cannot be checked reliably, clarify the relevant existing review guidance or playbook. Do not create a new standards document merely to restate existing instructions.
- For repeated navigation or information gaps, add a focused pointer or repair the existing tool/documentation path when the session demonstrates why it is needed.

Weigh impact and recurrence against maintenance cost and false positives. Do not invent a rule from a one-off preference, duplicate existing coverage, weaken checks to make a run pass, or expand into unrelated cleanup. Keep repository policy in committed repository files; do not modify global instructions or other repositories.

## Complete within scope

A review-only or ideas-only request returns recommendations without edits. During authorized implementation, apply the smallest relevant prevention within the task's scope; report broader workflow or policy changes as follow-ups. Existing authorization continues to apply, and this skill adds no approval gate or publishing permission.

When adding a check, verify that it detects the demonstrated failure and accepts the corrected behavior, using the repository's affected-check guidance. Reuse valid verification evidence; do not repeat unrelated checks. Keep retrospective reasoning in the agent workflow rather than adding an AI call to every commit or a new scheduled job.

Report only worthwhile findings, with the evidence, the prevention applied or proposed, and any verification limits. If no additional prevention is justified, say so briefly.

Inspired by [mattpocock/skills retro PR #1083](https://github.com/mattpocock/skills/pull/1083).
