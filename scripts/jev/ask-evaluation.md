# File-question pilot — 29 September 2026

**Decision: retain this as an opt-in experiment in 5chan, seedit, and bitsocial-web. Do not make it a routine search step or expand it to diagnostic automation or the other repositories on these results.**

## Measured results

The frozen helper used `jev-1.13.0`, the existing private machine configuration, a 0.9 probability/confidence threshold, and an independent optional evidence selector. One request was sent per historical source file, with at most three in flight. Labels and patches were withheld from the model. No application or moderation behavior changed.

| Measurement | Result |
|---|---:|
| Historical fixes / selected file instances | 12 / 52 |
| Fix-derived minimum relevant-file labels | 28 |
| Advisory judgments | 7: 6 relevant, 1 unrelated |
| Unverified results | 45: 40 uncertain, 5 response-validation failures |
| Known relevant files marked advisory relevant | 5 of 28 |
| Known relevant files marked advisory unrelated | 0 of 28 |
| Full selected source bytes | 717,856 |
| Direct-read bytes retained by a cautious simulated policy | 709,863 |
| Simulated full-file reading reduction | 1.1% |
| Compact report bytes / actual rg snippet bytes | 46,031 / 36,565 |
| Median Jev case wall time / rg snippet command wall time | 595 ms / 7.42 ms |
| Metered input tokens from validated responses | 247,818 |
| Known estimated input-cost subtotal | $0.010408356 |
| Requests with unavailable validated usage | 5 |

The total billed cost is unknown because five responses failed validation. The subtotal uses the client's explicit $0.042/million input-token assumption. The conservative reservation was $0.040431762; this is not billed usage. A separate one-request diagnostic cost an estimated $0.000484722 and is excluded from the pilot table. That diagnostic returned a valid but uncertain response; it did not reproduce the original validation failure, whose exact cause remains unresolved. Strict response validation remains intact.

All 28 minimum positives remained available for direct inspection, largely because uncertain/error results are retained. This is not a 100% accuracy or recall claim. Only five earned advisory relevance plus evidence under the strict policy. The report did not beat rg's output size, and one hypothetical skipped file barely reduced total reading. No actual coding-agent token consumption, bill, cache behavior, repair correctness, or end-to-end productivity improvement was measured.

Evidence-choice ambiguity contributed to abstentions: multiple blocks may support a file-level answer. The pilot did not lower thresholds or remove difficult examples to produce a better headline. The optional evidence selector and full probability distributions remain inspectable for future, separately evaluated policies.

## Case provenance

Each case used the historical parent source of a reviewed fix, an ordinary-language task, and a bounded shortlist from explicit source scopes and recorded rg expressions. Candidate pools were retrospectively scoped, not a blind whole-repository benchmark. Labels are minimum positives inferred from the inspected fix; other files are unlabeled, not ground-truth negatives. Added files absent from the parent are not counted in pre-fix recall.

| Repository | Case | Fix | Parent snapshot |
|---|---|---|---|
| 5chan | 5chan-gif-still | `bbf58550daa4` | `e3532c07db9f` |
| 5chan | 5chan-catalog-footer | `42751f7d8ee7` | `b5e00d73f819` |
| 5chan | 5chan-safari-scroll | `045f0bc18028` | `48186638cdfc` |
| 5chan | 5chan-quote-hover | `af3b129ad088` | `b50f601d8a2c` |
| seedit | seedit-reply-gif | `fb713c74ffb1` | `e271d6cf328d` |
| seedit | seedit-domain-state | `32b31b002f75` | `e9fc2774c2ed` |
| seedit | seedit-all-pagination | `e9fc2774c2ed` | `616830e42737` |
| seedit | seedit-optional-startup | `1dae6f514102` | `8274c3857383` |
| bitsocial-web | web-resume-graphics | `949655d4aa4b` | `2c259a209da3` |
| bitsocial-web | web-project-routes | `6b5c7f246fda` | `8b9b88aa24f7` |
| bitsocial-web | web-touch-header | `9fdd3349c606` | `8b9b88aa24f7` |
| bitsocial-web | web-phone-footer | `9d908232a80c` | `bf6e6fcb70bf` |

Full source was not needed in the coding agent merely to run the rg baseline. Do not compare Jev's report against loading every file and call the difference a saving over search. The rg timing is the recorded snippet command, not human reasoning or a complete bug investigation; both approaches also required candidate preparation.

The evaluated helper SHA-256 was `a2a209a0cdd51aa7a3f6b3fbb75e26af905a3f262676bf78b553012602d170e7` (formatting may differ between repositories). No prompt or threshold was tuned after seeing the live judgments. Initial source-size/block-packing changes happened before the first live request, and all 52 original candidates passed final preflight without truncation.

## Future acceptance criteria

Require a separate representative comparison showing useful evidence coverage and actual workflow benefit before expanding. Keep exact source, candidate retrieval, model judgments, uncertainty, and direct follow-up reads separate. Raw evaluation artifacts are kept outside Git; this document records the findings and provenance rather than claiming a reproducible public benchmark bundle or production-quality labels.
