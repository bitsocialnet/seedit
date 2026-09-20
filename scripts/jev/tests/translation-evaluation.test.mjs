import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { evaluateTranslationPairs } from '../translations-eval.mjs';
import {
  calibrationReport,
  evaluationMetrics,
  identity,
  riskUpperBound,
  selectAuditExamples,
  selectEvaluationPairs,
  thresholdResults,
  validateEvaluationCorpus,
} from '../translation-evaluation.mjs';

const label = (key, expected = 'pass', split = 'calibration') => ({
  key,
  locale: 'it',
  source: `Source ${key}`,
  translation: `Traduzione ${key}`,
  expected,
  category: 'meaning',
  group: key,
  split,
});
const corpus = (pairs) => ({ schemaVersion: 1, corpusId: 'fixture-v1', provenance: { kind: 'synthetic', authoredBy: 'model' }, pairs });
const answers = (p = 0.98, choice = 'preserve') =>
  Object.fromEntries(
    ['meaning', 'qualifications', 'terminology'].map((id) => [
      id,
      { choice, confidence: 0.97, probabilities: choice === 'issue' ? { preserve: 1 - p, issue: p, uncertain: 0 } : { preserve: p, issue: 1 - p, uncertain: 0 } },
    ]),
  );
const result = (entry, status) => ({ key: entry.key, locale: entry.locale, status, origin: 'provider', issues: status === 'flagged' ? ['semantic_meaning'] : [] });

test('versioned corpora require provenance, per-human label reviews and consistent split families', () => {
  const value = corpus([label('a'), label('b', 'flagged', 'holdout')]);
  const validated = validateEvaluationCorpus(value);
  assert.equal(validated.metadata.independentlyReviewed, false);
  assert.deepEqual(validated.metadata.splits, { calibration: 1, holdout: 1, audit: 0 });
  assert.throws(() => validateEvaluationCorpus({ ...value, provenance: undefined }), /provenance/);
  assert.throws(() => validateEvaluationCorpus({ ...value, schemaVersion: 2 }), /Unsupported/);
  assert.throws(() => validateEvaluationCorpus(corpus([label('a'), label('a')])), /Duplicate/);
  assert.throws(() => validateEvaluationCorpus(corpus([label('a'), { ...label('b', 'pass', 'holdout'), group: 'a' }])), /leaks/);
  assert.throws(() => validateEvaluationCorpus(corpus([label('a'), { ...label('b', 'pass', 'holdout'), source: 'Source   a ' }])), /leaks/);
  value.provenance.kind = 'independently-reviewed';
  assert.throws(() => validateEvaluationCorpus(value), /human reviewer/);
  value.pairs.forEach((pair) => {
    pair.review = { reviewer: 'local-reviewer-1', labelSource: 'human' };
  });
  assert.equal(validateEvaluationCorpus(value).metadata.independentlyReviewed, true);
  const legacy = validateEvaluationCorpus([label('a')]);
  assert.equal(legacy.metadata.provenance.kind, 'unreviewed');
  assert.equal(legacy.metadata.legacy, true);
});

test('selection excludes holdout by default and strips expected/review/split metadata from model pairs', () => {
  const value = validateEvaluationCorpus(corpus([label('a'), label('b', 'flagged', 'holdout')]));
  const selected = selectEvaluationPairs(value);
  assert.deepEqual(
    selected.labels.map((pair) => pair.key),
    ['a'],
  );
  assert.deepEqual(Object.keys(selected.pairs[0]).sort(), ['context', 'key', 'locale', 'source', 'translation']);
  assert.throws(() => selectEvaluationPairs(value, { keys: ['b'] }), /absent/);
  assert.throws(() => selectEvaluationPairs(value, { split: 'all' }), /Split/);
  assert.equal(selectEvaluationPairs(value, { split: 'holdout' }).labels[0].key, 'b');
});

test('risk denominators include abstentions and distinguish coverage from empirical false-pass risk', () => {
  const labels = [label('a', 'flagged'), label('b', 'flagged'), label('c'), label('d')];
  const metrics = evaluationMetrics(labels, [result(labels[0], 'pass'), result(labels[1], 'unverified'), result(labels[2], 'pass'), result(labels[3], 'flagged')]);
  assert.equal(metrics.recall, 0);
  assert.equal(metrics.missed, 1);
  assert.equal(metrics.falsePassRate, 0.5);
  assert.equal(metrics.passCoverage, 0.5);
  assert.equal(metrics.abstentionRate, 0.25);
  assert.equal(metrics.falseAlarmRate, 0.5);
  assert.equal(metrics.selectiveErrorRate, 2 / 3);
  assert.equal(riskUpperBound(0, 0), null);
  assert.ok(riskUpperBound(0, 2) > 0.6);
  assert.equal(evaluationMetrics([label('a')], []).falsePassRate, null);
});

test('threshold sweeps only alter semantic passes and never convert unavailable or malformed evidence to passes', () => {
  const labels = [label('a'), label('b'), label('c'), label('d')];
  const results = [result(labels[0], 'unverified'), result(labels[1], 'flagged'), { ...result(labels[2], 'unverified'), origin: 'none' }, result(labels[3], 'pass')];
  const observations = new Map([
    [identity(labels[0]), answers(0.92)],
    [identity(labels[1]), answers(0.9, 'issue')],
    [identity(labels[2]), answers()],
    [identity(labels[3]), {}],
  ]);
  assert.deepEqual(
    thresholdResults(results, observations, 0.9).map((entry) => entry.status),
    ['pass', 'flagged', 'unverified', 'unverified'],
  );
  assert.equal(thresholdResults(results, observations, 0.95)[0].status, 'unverified');
  assert.throws(() => thresholdResults(results, observations, 0.5), /threshold/);
  assert.throws(() => calibrationReport(labels, results, observations, [0.9], 'holdout'), /calibration/);
  const report = calibrationReport(labels, results, observations, [0.9, 0.95], 'calibration');
  assert.equal(report.thresholds[0].passCoverage, 0.25);
  assert.equal(report.thresholds[1].passCoverage, 0);
});

test('audit queue uses uncertain plus reproducible random complement and never selects holdout', () => {
  const labels = [label('a'), label('b'), label('c'), label('d'), label('e', 'pass', 'holdout')];
  const results = labels.map((entry, index) => result(entry, index < 2 ? 'unverified' : 'pass'));
  const observations = new Map([
    [identity(labels[0]), answers(0.91)],
    [identity(labels[1]), answers(0.7)],
  ]);
  const queue = selectAuditExamples(labels, results, observations, { uncertain: 1, random: 2, seed: 'example' });
  assert.equal(queue.examples[0].key, 'b');
  assert.equal(new Set(queue.examples.map(identity)).size, 3);
  assert.ok(queue.examples.every((entry) => entry.key !== 'e'));
  assert.deepEqual(queue, selectAuditExamples([...labels].reverse(), results, observations, { uncertain: 1, random: 2, seed: 'example' }));
  assert.throws(() => selectAuditExamples(labels, results, observations, { random: -1 }), /sample sizes/);
});

test('fresh evaluation captures probabilities with labels withheld, includes structural results and never retries failure', async () => {
  const labels = [label('struct', 'flagged'), label('a'), label('fail'), label('issue', 'flagged')];
  labels[0].source = 'Read {{count}} posts';
  labels[0].translation = 'Leggi i post';
  labels[0].category = 'structural';
  const { pairs } = selectEvaluationPairs(validateEvaluationCorpus(corpus(labels)));
  let requests = 0;
  const client = {
    ask: async ({ state }) => {
      requests++;
      assert.deepEqual(Object.keys(state).sort(), ['domainContext', 'locale', 'pairContext', 'source', 'sourceLanguage', 'translation']);
      if (state.source === 'Source fail') throw new Error('DO NOT LEAK PROVIDER BODY');
      return { model: 'jev-1.13.0', answers: answers(state.source === 'Source a' ? 0.92 : 0.97, state.source === 'Source issue' ? 'issue' : 'preserve') };
    },
    stats: () => ({ requests }),
  };
  const report = await evaluateTranslationPairs(pairs, labels, { client, live: true, model: 'jev-1.13.0' });
  assert.equal(requests, 3);
  assert.equal(report.evaluation.allChecks.unverified, 2);
  assert.equal(report.evaluation.allChecks.detected, 2);
  assert.equal(report.evaluation.semanticOnly.detected, 1);
  assert.equal(report.evaluation.calibration.thresholds.find((entry) => entry.threshold === 0.9).passCoverage, 1 / 3);
  assert.ok(!JSON.stringify(report).includes('DO NOT LEAK'));
  assert.ok(!JSON.stringify(report).includes('Traduzione'));
});

test('offline evaluation never calls provider and invalid options fail before calls', async () => {
  const labels = [label('a')];
  const { pairs } = selectEvaluationPairs(validateEvaluationCorpus(corpus(labels)));
  let requests = 0;
  const client = {
    ask: async () => {
      requests++;
      throw new Error();
    },
  };
  const report = await evaluateTranslationPairs(pairs, labels, { client });
  assert.equal(report.evaluation.allChecks, null);
  assert.equal(report.evaluation.calibration, null);
  await assert.rejects(() => evaluateTranslationPairs(pairs, labels, { client, live: true, thresholds: [NaN] }), /threshold/);
  await assert.rejects(() => evaluateTranslationPairs(pairs, labels, { client, live: true, split: 'holdout' }), /calibration/);
  assert.equal(requests, 0);
});

test('CLI guards fixed corpus hash and holdout tuning before credential discovery', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-eval-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'corpus.json');
  await fs.writeFile(file, JSON.stringify(corpus([label('a'), label('b', 'pass', 'holdout')])));
  const cli = fileURLToPath(new URL('../translations-eval.mjs', import.meta.url));
  const env = { ...process.env, JEV_CONFIG_FILE: '/absent-config-for-test' };
  for (const [args, expected] of [
    [['--expected-corpus-sha256', 'wrong'], 'Corpus hash'],
    [['--split', 'holdout', '--thresholds', '0.9'], 'calibration split'],
  ]) {
    assert.throws(
      () => execFileSync(process.execPath, [cli, '--corpus', file, '--live', ...args], { env, stdio: 'pipe' }),
      (error) => {
        assert.equal(error.status, 2);
        assert.match(error.stderr.toString(), new RegExp(expected));
        assert.ok(!error.stderr.toString().includes('absent-config'));
        return true;
      },
    );
  }
});

test('shipped synthetic corpus has fixed separated contrast groups, no human gold claim', async () => {
  const input = JSON.parse(await fs.readFile(new URL('../fixtures/translations.json', import.meta.url), 'utf8'));
  const value = validateEvaluationCorpus(input);
  assert.equal(value.metadata.provenance.kind, 'synthetic');
  assert.equal(value.metadata.independentlyReviewed, false);
  assert.ok(value.metadata.splits.calibration > 0);
  assert.ok(value.metadata.splits.holdout > 0);
  assert.ok(value.pairs.some((entry) => entry.category === 'publication-state'));
});

test('unlabeled audit examples can be selected for human review but never count as correctness evidence', async () => {
  const unlabeled = { ...label('new', undefined, 'audit'), expected: undefined };
  const checked = validateEvaluationCorpus(corpus([unlabeled]));
  const { pairs, labels } = selectEvaluationPairs(checked, { split: 'audit' });
  const client = { ask: async () => ({ model: 'jev-1.13.0', answers: answers() }) };
  const report = await evaluateTranslationPairs(pairs, labels, { client, live: true, model: 'jev-1.13.0', split: 'audit', thresholds: [] });
  assert.equal(report.evaluation.allChecks, null);
  assert.equal(report.evaluation.semanticOnly, null);
  assert.equal(report.evaluation.unlabeledCases, 1);
  assert.equal(report.evaluation.audit.examples[0].key, 'new');
  assert.throws(() => validateEvaluationCorpus(corpus([{ ...unlabeled, split: 'calibration' }])), /require expected/);
  const input = corpus([unlabeled]);
  input.provenance.kind = 'independently-reviewed';
  assert.throws(() => validateEvaluationCorpus(input), /human reviewer/);
});
