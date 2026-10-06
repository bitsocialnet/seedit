# Jev and OpenAI Decisions: local workflow comparison

On 6 October 2026, Jev 1.13 and OpenAI Decisions with GPT-6 Luna had similar median API latency on an existing synthetic moderation pilot. **Jev's estimated input cost was 53% lower for these requests.** This is evidence for retaining Jev in this particular text workflow, not a universal provider ranking or a production accuracy claim.

The accompanying [sanitized results](comparison-2026-10-06.json) contain every paired case result, timing and token count, aggregate metrics, historical price assumptions and source hashes. Private moderation policy, prompts, request IDs, local paths and screenshots are intentionally omitted. The records let readers verify the arithmetic; they do not allow independent prompt reruns or label adjudication.

## Moderation results

There were **48 unique synthetic cases, repeated twice**: 96 calls per provider. The table pools latency and input cost across both rounds. Label matches are shown per round because repeating a case does not create a new independent example.

| Measure                                            |     Jev 1.13 | OpenAI Decisions / GPT-6 Luna |
| -------------------------------------------------- | -----------: | ----------------------------: |
| Median API latency                                 |       276 ms |                        271 ms |
| 95th-percentile API latency                        |       343 ms |                        550 ms |
| Labels matched in round 1                          |        48/48 |                         45/48 |
| Labels matched in round 2                          |        48/48 |                         45/48 |
| Estimated input cost per million comparable checks |  $120.810375 |                   $257.945833 |
| Observed input tokens, both rounds                 |      276,138 |                       247,628 |
| Estimated input cost of these 96 requests          | $0.011597796 |                    $0.0247628 |

All responses passed the evaluation's response validation; no failures or retries were removed. The two providers agreed with all **28 additional synthetic stress-case labels**, evaluated once each. This does not establish production error rates.

Decisions disagreed with three pilot labels in each round: one expected-review case was classified as allow, and two expected-allow cases involving date arithmetic were classified as review. The incorrect allow did not pass the stricter auto-allow gate (allow verdict and risk <= 0.05). Excluding **all four** date-arithmetic cases gives **44/44 versus 43/44** per round. The headline table retains all 48 cases.

## Cost and timing calculations

Input rates used on the evaluation date were **$0.042 per million input tokens for Jev** and **$0.10 for Decisions / GPT-6 Luna**. These are the dated assumptions used in the experiment, not a promise about current prices.

```text
Jev:       (276138 / 96) * 0.042 = $120.810375 per million checks
Decisions: (247628 / 96) * 0.10  = $257.945833 per million checks
Savings:   1 - (120.810375 / 257.945833...) = 53.16%
```

The million-check figure extrapolates the observed average request size; a million requests were not run. It covers **the initial decision's input cost only**. Downstream Luna/Grok fallbacks, orchestration and infrastructure are outside this comparison. Provider-reported input tokens were multiplied by standard input rates; these estimates are not an account invoice. Decisions reported zero cached/cache-write tokens. Jev did not provide equivalent cache detail, so every input token was priced at the standard input rate for both providers.

Calls were paired and sequential from the **same Mac**, with alternating provider order reversed between repetitions and a fixed shuffled case order. Concurrency was one, with no retries. API time includes network and response-body receipt. It is **not VPS latency, rendering speed, posting time or throughput**. Medians use the average of the middle two values; p95 uses the nearest-rank method. Small-run tail latency is especially sensitive to individual requests.

## Translation QA

The semantic comparison covered 23 synthetic examples: 11 expected-good translations and 12 expected issues. Two other fixtures failed deterministic placeholder/protected-token checks before inference and were excluded from both providers' semantic calls.

Both providers flagged all **12 issue examples**, with **zero false passes and zero false flags**. At the existing shared threshold, Jev left **one good example unverified** and Decisions left **five good examples unverified**. An unverified result means review is needed, not that the translation was wrongly classified as bad.

The existing rule flags any reported issue, passes when all preservation probabilities are at least 0.95, and otherwise leaves the example unverified. That rule was held constant and was not calibrated separately for Decisions. The result measures workflow behavior under that rule, not relative language intelligence or representative multilingual accuracy.

## Screenshot capability smoke test

Decisions also answered four straightforward, assistant-labeled predicates about **one existing 5chan screenshot**, matching all four labels in approximately **979 ms**. The request used 1,818 input tokens, for an estimated $0.0001818 input cost.

This only confirms that image input worked for one easy example. It is **not a visual-regression benchmark**, an independent accuracy evaluation, or a comparison against Jev. The screenshot itself remains private. The optional screenshot evaluator is a separate developer tool; this work changes no moderation runtime or deployed provider setting.

## Limits and provenance

- Moderation fixtures and labels were authored before these calls from an existing private policy, but were not independently human reviewed. Translation fixtures and labels were model-authored. Neither corpus represents production traffic.
- The historical moderation policy and normalization runtime were frozen to the original pilot. Both providers received the same semantic state and question meanings, with only the request schema adapted.
- Prompts, rubrics and thresholds originated in the Jev workflow. Holding them fixed avoids tuning to these outcomes but may favor Jev's existing calibration. Provider probabilities and confidence need not be calibrated alike.
- The pilot repeats cases, uses one host and one session, and does not establish statistical significance, a latency guarantee or relative model intelligence.
- All 294 paired requests are included. Including two warmup calls and the separate screenshot request gives **297 paid requests**, with **$0.049820612 estimated total input cost**. Warmups and the screenshot are excluded from the moderation/translation headline metrics.
- The JSON records preserve neutral case IDs, expected and returned classifications, timing, token usage and date-arithmetic membership. SHA-256 hashes identify private source artifacts without publishing their contents. This is an auditable aggregate export, not a public reproduction corpus.

The current implementation decision is to retain Jev for existing text checks and evaluate image-capable providers separately. Playwright actions and deterministic assertions remain the basis of browser testing; model opinions are optional evidence.

Reference documentation: [OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions), [OpenAI Decisions API reference](https://developers.openai.com/api/reference/python/resources/decisions/methods/create), [TypeSafe models](https://docs.typesafe.ai/models), [TypeSafe API](https://docs.typesafe.ai/api).

## Verify the published headline

Run this offline from the repository root; it reads only the public JSON above:

```sh
python3 - <<'PY'
import json, math, statistics
from pathlib import Path

data = json.loads(Path('scripts/visual-qa/comparison-2026-10-06.json').read_text())
rates = data['pricing']['usdPerMillionInputTokens']
costs = {}
for provider in ['jev', 'decisions']:
    rows = [r for r in data['moderationRecords']
            if r['cohort'] == 'pilot48' and r['provider'] == provider]
    times = sorted(r['elapsedMs'] for r in rows)
    costs[provider] = sum(r['usage']['inputTokens'] for r in rows) / len(rows) * rates[provider]
    print(provider, 'cases:', len({r['caseId'] for r in rows}),
          'requests:', len(rows), 'median ms:', statistics.median(times),
          'p95 ms:', times[math.ceil(len(times) * .95) - 1],
          'input USD per 1M checks:', costs[provider])
print('Jev input-cost reduction:', 100 * (1 - costs['jev'] / costs['decisions']), '%')
PY
```
