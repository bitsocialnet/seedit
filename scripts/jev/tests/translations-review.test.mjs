import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTranslationReview, importTranslationReview } from '../translations-review.mjs';
import { blankReview } from '../review-handoff.mjs';
import { validateEvaluationCorpus, selectEvaluationPairs, evaluationMetrics } from '../translation-evaluation.mjs';
const source = {
  kind: 'repository',
  repository: 'test-repo',
  commit: 'a'.repeat(40),
  path: 'public/translations/en/default.json',
  translationPath: 'public/translations/it/default.json',
  key: 'test',
};
const queue = () =>
  prepareTranslationReview(
    ['calibration', 'holdout'].map((split, index) => ({
      source: { ...source, key: `test-${index}` },
      content: { source: `Source ${index}`, translation: `Traduzione ${index}`, locale: 'it' },
      group: `group-${index}`,
      split,
    })),
  );

test('translation answers import through existing evaluator with human source provenance', () => {
  const q = queue(),
    review = { ...blankReview(q), reviewerId: 'test-human', reviewedAt: '2026-09-21', independentOfModelOutput: true };
  review.labels.forEach((row) => {
    row.label = 'pass';
  });
  const result = importTranslationReview(q, { schemaVersion: 1, reviews: [review] });
  const validated = validateEvaluationCorpus(result.corpus);
  assert.equal(validated.metadata.independentlyReviewed, true);
  assert.equal(result.corpus.provenance.sourceKind, 'repository');
  assert.equal(result.corpus.provenance.model, null);
  assert.equal(selectEvaluationPairs(validated, { split: 'holdout' }).labels.length, 1);
  assert.equal(result.corpus.pairs[0].sourceProvenance.commit, source.commit);
});
test('uncertain holdout stays pending and never counts as an expected pass', () => {
  const q = queue(),
    review = { ...blankReview(q), reviewerId: 'test-human', reviewedAt: '2026-09-21', independentOfModelOutput: true };
  review.labels[0].label = 'flagged';
  review.labels[1].label = 'uncertain';
  const result = importTranslationReview(q, { schemaVersion: 1, reviews: [review] });
  assert.deepEqual(result.manifest.summary, { total: 2, labeled: 1, pending: 1 });
  assert.equal(result.manifest.items[1].split, 'holdout');
  const metrics = evaluationMetrics(result.corpus.pairs, []);
  assert.equal(metrics.cases, 1);
  assert.equal(metrics.expectedIssues, 1);
  assert.equal(metrics.expectedGood, 0);
  assert.throws(() => selectEvaluationPairs(validateEvaluationCorpus(result.corpus), { split: 'holdout' }), /Select/);
});
test('human-reviewed synthetic translations remain synthetic', () => {
  const q = prepareTranslationReview([
    { source: { ...source, kind: 'synthetic' }, content: { source: 'Example', translation: 'Esempio', locale: 'it' }, group: 'one', split: 'calibration' },
  ]);
  const review = { ...blankReview(q), reviewerId: 'test-human', reviewedAt: '2026-09-21', independentOfModelOutput: true };
  review.labels[0].label = 'pass';
  assert.equal(importTranslationReview(q, { schemaVersion: 1, reviews: [review] }).corpus.provenance.kind, 'synthetic');
});

test('deterministic placeholder failure is excluded from semantic-only calibration', async () => {
  const { evaluateTranslationPairs } = await import('../translations-eval.mjs');
  const q = prepareTranslationReview([{ source, content: { source: 'Hello {{name}}', translation: 'Ciao', locale: 'it' }, group: 'placeholder', split: 'calibration' }]);
  const review = { ...blankReview(q), reviewerId: 'test-human', reviewedAt: '2026-09-21', independentOfModelOutput: true };
  review.labels[0].label = 'flagged';
  const { corpus } = importTranslationReview(q, { schemaVersion: 1, reviews: [review] });
  const selected = selectEvaluationPairs(validateEvaluationCorpus(corpus));
  let calls = 0;
  const result = await evaluateTranslationPairs(selected.pairs, selected.labels, {
    live: true,
    model: 'jev-1.0.0',
    client: {
      ask() {
        calls++;
        throw new Error('Unexpected request');
      },
    },
  });
  assert.equal(calls, 0);
  assert.equal(corpus.pairs[0].category, 'structural');
  assert.equal(result.evaluation.allChecks.detected, 1);
  assert.equal(result.evaluation.semanticOnly.cases, 0);
  assert.equal(
    result.evaluation.calibration.thresholds.every((row) => row.cases === 0),
    true,
  );
});
