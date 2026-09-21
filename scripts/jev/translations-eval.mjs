#!/usr/bin/env node
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createJevClient, JevError } from './client.mjs';
import { parseScopedCsv, readTranslationJson, reviewTranslations, structuralIssues, translationQuestions, TranslationInputError } from './translations.mjs';
import {
  calibrationReport,
  evaluationMetrics,
  identity,
  selectAuditExamples,
  selectEvaluationPairs,
  thresholdResults,
  validateEvaluationCorpus,
} from './translation-evaluation.mjs';

export { evaluationMetrics } from './translation-evaluation.mjs';

// Illustrative contrasts, not learned labels. This experiment never changes normal QA or its cache.
export function evaluationQuestions(rubric = 'baseline') {
  if (!['baseline', 'contrastive'].includes(rubric)) throw new TranslationInputError('Rubric must be baseline or contrastive');
  const questions = translationQuestions();
  if (rubric === 'baseline') return questions;
  const examples = {
    meaning: {
      preserve: 'Example boundary: active and passive wording are equivalent when the same actor performs the same action.',
      issue: 'Example boundary: permission to undo an operation becomes an obligation to undo it, or the actor receiving a notification becomes the sender.',
    },
    qualifications: {
      preserve: 'Example boundary: a condition may move to another clause while retaining the same prerequisite and exception.',
      issue: 'Example boundary: access while a session is open becomes permanent access; an action affecting one workspace is described as affecting every workspace.',
    },
    terminology: {
      preserve: 'Example boundary: a conventional localized technical term denotes the same function even if its literal wording differs.',
      issue: 'Example boundary: a recovery code is described as an account password, or exporting a copy is described as transferring ownership.',
    },
  };
  for (const [id, question] of Object.entries(questions)) {
    question.criteria = {
      preserve: `${question.criteria.preserve} ${examples[id].preserve}`,
      issue: `${question.criteria.issue} ${examples[id].issue}`,
      uncertain: `${question.criteria.uncertain} Do not invent a product rule or infer correctness from fluency alone.`,
    };
  }
  return questions;
}

export async function evaluateTranslationPairs(
  pairs,
  labels,
  { client, live = false, model, passThreshold = 0.95, split = 'calibration', thresholds = [0.8, 0.9, 0.95, 0.99], audit = {}, rubric = 'baseline' } = {},
) {
  // Validate every option before invoking the provider.
  const questions = evaluationQuestions(rubric);
  thresholdResults([], new Map(), passThreshold);
  for (const threshold of thresholds) thresholdResults([], new Map(), threshold);
  selectAuditExamples([], [], new Map(), audit);
  if (split !== 'calibration' && thresholds.length) throw new TranslationInputError('Threshold sweeps are permitted only on the calibration split');
  const observations = new Map();
  const pending = pairs.filter((pair) => !structuralIssues(pair).length);
  let index = 0;
  const recordingClient = client && {
    stats: () => client.stats?.(),
    ask: async (request) => {
      // reviewTranslations is sequential and this evaluation never enables its cache.
      const pair = pending[index++];
      const response = await client.ask({ ...request, questions });
      if (response.model === model) observations.set(identity(pair), response.answers);
      return response;
    },
  };
  const report = await reviewTranslations(pairs, { client: recordingClient, live, model });
  const results = thresholdResults(report.results, observations, passThreshold);
  const labeled = labels.filter((label) => ['pass', 'flagged'].includes(label.expected));
  const metrics = live && labeled.length ? evaluationMetrics(labeled, results) : null;
  return {
    ...report,
    rubric: rubric === 'baseline' ? report.rubric : 'translation-qa-contrastive-v1',
    rubricVariant: rubric,
    rubricSha256: createHash('sha256').update(JSON.stringify(questions)).digest('hex'),
    results,
    summary: Object.fromEntries(['pass', 'flagged', 'unverified'].map((status) => [status, results.filter((item) => item.status === status).length])),
    evaluation: {
      note: 'Advisory labeled evaluation, not a multilingual accuracy guarantee. Labels, groups, split, and review metadata are excluded from provider state. Unverified issues stay in the recall denominator. No cache or threshold changes.',
      split,
      passThreshold,
      unlabeledCases: labels.length - labeled.length,
      allChecks: metrics,
      semanticOnly:
        live && labeled.length
          ? evaluationMetrics(
              labeled.filter((label) => label.category !== 'structural'),
              results,
            )
          : null,
      calibration: live && split === 'calibration' ? calibrationReport(labels, report.results, observations, thresholds, split) : null,
      audit: selectAuditExamples(labels, results, observations, audit),
      offline: !live,
    },
  };
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      live: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
      corpus: {
        type: 'string',
        default: fileURLToPath(new URL('./fixtures/translations.json', import.meta.url)),
      },
      cases: { type: 'string' },
      model: { type: 'string' },
      rubric: { type: 'string', default: 'baseline' },
      split: { type: 'string', default: 'calibration' },
      'pass-threshold': { type: 'string', default: '0.95' },
      thresholds: { type: 'string' },
      'expected-corpus-sha256': { type: 'string' },
      'audit-uncertain': { type: 'string', default: '5' },
      'audit-random': { type: 'string', default: '5' },
      seed: { type: 'string', default: 'translation-audit-v1' },
      'max-requests': { type: 'string', default: '20' },
      'max-cost-usd': { type: 'string', default: '0.01' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/jev/translations-eval.mjs [--live] [--corpus labeled-pairs.json] [--split calibration|holdout|audit] [--cases case1,case2]\n  [--rubric baseline|contrastive] [--pass-threshold 0.95] [--thresholds 0.8,0.9,0.95,0.99] [--expected-corpus-sha256 SHA256]\n  [--audit-uncertain 5 --audit-random 5 --seed translation-audit-v1] [--max-requests 20 --max-cost-usd 0.01]\nThreshold sweeps use calibration only. Holdout is explicit, never used for tuning/audit selection. Offline metrics remain null. No cache or policy writes.',
    );
    return 0;
  }
  evaluationQuestions(values.rubric);
  const keys = parseScopedCsv(values.cases, '--cases');
  const maxRequests = Number(values['max-requests']);
  const maxCostUsd = Number(values['max-cost-usd']);
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 500 || !Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > 1)
    throw new TranslationInputError('Invalid evaluation limits');
  const corpus = validateEvaluationCorpus(await readTranslationJson(values.corpus));
  if (values['expected-corpus-sha256'] !== undefined && values['expected-corpus-sha256'] !== corpus.metadata.sha256)
    throw new TranslationInputError('Corpus hash does not match the fixed evaluation corpus');
  const { labels, pairs } = selectEvaluationPairs(corpus, { split: values.split, keys });
  const thresholds =
    values.thresholds === undefined ? (values.split === 'calibration' ? [0.8, 0.9, 0.95, 0.99] : []) : parseScopedCsv(values.thresholds, '--thresholds').map(Number);
  if (values.split !== 'calibration' && thresholds.length) throw new TranslationInputError('Threshold sweeps are permitted only on the calibration split');
  const passThreshold = Number(values['pass-threshold']);
  const audit = {
    uncertain: Number(values['audit-uncertain']),
    random: Number(values['audit-random']),
    seed: values.seed,
  };
  thresholdResults([], new Map(), passThreshold);
  for (const threshold of thresholds) thresholdResults([], new Map(), threshold);
  selectAuditExamples([], [], new Map(), audit);
  const client = values.live ? createJevClient({ live: true, model: values.model, maxRequests, maxCostUsd }) : undefined;
  const model = client ? client.assertReady().model : values.model || process.env.JEV_MODEL || '';
  const report = await evaluateTranslationPairs(pairs, labels, {
    client,
    live: values.live,
    model,
    passThreshold,
    split: values.split,
    thresholds,
    audit,
    rubric: values.rubric,
  });
  console.log(JSON.stringify({ ...report, evaluation: { ...report.evaluation, corpus: corpus.metadata } }, null, 2));
  if (!values.live) return 2;
  const metrics = report.evaluation.allChecks;
  return metrics?.missed || metrics?.falseAlarms ? 1 : !metrics || metrics.unverified || report.evaluation.unlabeledCases ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(
        error instanceof TranslationInputError
          ? error.message
          : error instanceof JevError
            ? error.code
            : 'Translation evaluation could not run. Check the corpus, pinned model, and limits; use --help.',
      );
      process.exitCode = 2;
    });
}
