#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createJevClient } from './client.mjs';
import { loadParagraphPairs, parseScopedCsv, reviewTranslations, TranslationInputError } from './translations.mjs';

export function evaluationMetrics(labels, results) {
  const byIdentity = new Map(results.map((result) => [JSON.stringify([result.locale, result.key]), result]));
  const cases = labels.map((label) => ({
    key: label.key,
    locale: label.locale,
    category: label.category,
    expected: label.expected,
    actual: byIdentity.get(JSON.stringify([label.locale, label.key]))?.status || 'unverified',
  }));
  const positives = cases.filter((entry) => entry.expected === 'flagged');
  const negatives = cases.filter((entry) => entry.expected === 'pass');
  const detected = positives.filter((entry) => entry.actual === 'flagged').length;
  const missed = positives.filter((entry) => entry.actual === 'pass').length;
  const falseAlarms = negatives.filter((entry) => entry.actual === 'flagged').length;
  const unverified = cases.filter((entry) => entry.actual === 'unverified').length;
  return {
    cases: cases.length,
    expectedIssues: positives.length,
    expectedGood: negatives.length,
    detected,
    missed,
    falseAlarms,
    unverified,
    unverifiedIssues: positives.filter((entry) => entry.actual === 'unverified').length,
    recall: positives.length ? detected / positives.length : null,
    falseAlarmRate: negatives.length ? falseAlarms / negatives.length : null,
    verifiedFraction: cases.length ? (cases.length - unverified) / cases.length : null,
    results: cases,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      live: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
      corpus: { type: 'string', default: fileURLToPath(new URL('./fixtures/translations.json', import.meta.url)) },
      cases: { type: 'string' },
      model: { type: 'string', default: process.env.JEV_MODEL || '' },
      'max-requests': { type: 'string', default: '20' },
      'max-cost-usd': { type: 'string', default: '0.01' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/jev/translations-eval.mjs [--live --model jev-1.13.0] [--cases it-negation-good,it-negation-bad] [--corpus labeled-pairs.json] [--max-requests 20 --max-cost-usd 0.01]\nOffline execution does not measure model accuracy. Live evaluation bypasses the cache.',
    );
    return 0;
  }
  const keys = parseScopedCsv(values.cases, '--cases');
  const maxRequests = Number(values['max-requests']);
  const maxCostUsd = Number(values['max-cost-usd']);
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 500 || !Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > 1)
    throw new Error('Invalid evaluation limits');
  const pairs = await loadParagraphPairs(values.corpus, { keys });
  if (!pairs.length || pairs.length > 100) throw new Error('Evaluation requires 1 to 100 explicitly selected fixture pairs');
  const input = JSON.parse(await fs.readFile(values.corpus, 'utf8'));
  const labels = (Array.isArray(input) ? input : input.pairs).filter((pair) => !keys.length || keys.includes(pair.key));
  if (labels.some((label) => !['pass', 'flagged'].includes(label.expected))) throw new Error('Evaluation labels must be pass or flagged');
  if (keys.some((key) => !labels.some((label) => label.key === key))) throw new Error('Requested case is absent from corpus');
  const client = values.live ? createJevClient({ live: true, model: values.model, maxRequests, maxCostUsd }) : undefined;
  const report = await reviewTranslations(pairs, { client, live: values.live, model: values.model });
  console.log(
    JSON.stringify(
      {
        ...report,
        evaluation: {
          note: 'Small hand-labeled pilot; not representative multilingual accuracy. Labels are excluded from provider state. Unverified issue cases remain in the recall denominator. No cache is used.',
          allChecks: values.live ? evaluationMetrics(labels, report.results) : null,
          semanticOnly: values.live
            ? evaluationMetrics(
                labels.filter((label) => label.category !== 'structural'),
                report.results,
              )
            : null,
          offline: !values.live,
        },
      },
      null,
      2,
    ),
  );
  if (!values.live) return 2;
  const metrics = evaluationMetrics(labels, report.results);
  return metrics.missed || metrics.falseAlarms ? 1 : metrics.unverified ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(
        error instanceof TranslationInputError ? error.message : 'Translation evaluation could not run. Check the corpus, pinned model, and limits; use --help.',
      );
      process.exitCode = 2;
    });
}
