import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluationQuestions, evaluateTranslationPairs } from '../translations-eval.mjs';
import { translationQuestions } from '../translations.mjs';

const pair = { key: 'fixture', locale: 'it', source: 'Sample text', translation: 'Testo di esempio' };
const label = { ...pair, expected: 'pass', category: 'meaning', split: 'calibration', review: { reviewer: 'HUMAN_ONLY' } };
const answers = Object.fromEntries(
  ['meaning', 'qualifications', 'terminology'].map((id) => [
    id,
    {
      choice: 'preserve',
      confidence: 0.95,
      probabilities: { preserve: 0.98, issue: 0.01, uncertain: 0.01 },
    },
  ]),
);

test('baseline stays identical and rubric reports identify different immutable question sets', async () => {
  assert.deepEqual(evaluationQuestions(), translationQuestions());
  const baseline = await evaluateTranslationPairs([pair], [label]);
  const contrastive = await evaluateTranslationPairs([pair], [label], { rubric: 'contrastive' });
  assert.equal(baseline.rubric, 'translation-qa-v1');
  assert.equal(contrastive.rubric, 'translation-qa-contrastive-v1');
  assert.notEqual(contrastive.rubricSha256, baseline.rubricSha256);
  assert.equal(contrastive.evaluation.allChecks, null);
  assert.deepEqual(evaluationQuestions(), translationQuestions());
  assert.throws(() => evaluationQuestions(null), /Rubric/);
});

test('trial sends its exact questions, withholds labels and never reuses another rubric response', async () => {
  const requests = [];
  const client = {
    ask: async (request) => {
      requests.push(request);
      return { model: 'jev-1.13.0', answers };
    },
  };
  for (const rubric of ['baseline', 'contrastive']) {
    const report = await evaluateTranslationPairs([pair], [label], { client, live: true, model: 'jev-1.13.0', rubric });
    assert.equal(report.results[0].origin, 'provider');
    assert.equal(report.evaluation.passThreshold, 0.95);
    assert.deepEqual(requests.at(-1).questions, evaluationQuestions(rubric));
    assert.ok(!JSON.stringify(requests.at(-1)).includes('HUMAN_ONLY'));
    assert.equal(requests.at(-1).state.source, pair.source);
  }
  assert.equal(requests.length, 2);
  await assert.rejects(() => evaluateTranslationPairs([pair], [label], { client, live: true, rubric: 'unknown' }), /Rubric/);
  assert.equal(requests.length, 2);
});

test('provider failure remains unverified under the contrastive rubric', async () => {
  const client = {
    ask: async () => {
      throw new Error('PRIVATE_RESPONSE');
    },
  };
  const report = await evaluateTranslationPairs([pair], [label], { client, live: true, model: 'jev-1.13.0', rubric: 'contrastive' });
  assert.equal(report.results[0].status, 'unverified');
  assert.ok(!JSON.stringify(report).includes('PRIVATE_RESPONSE'));
});
