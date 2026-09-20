import { createHash } from 'node:crypto';
import { summarizeAnswers, TranslationInputError } from './translations.mjs';

export const identity = (entry) => JSON.stringify([entry.locale, entry.key]);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const ratio = (numerator, denominator) => (denominator ? numerator / denominator : null);
const failure = (message) => {
  throw new TranslationInputError(message);
};
const splits = ['calibration', 'holdout', 'audit'];

export function validateEvaluationCorpus(input) {
  const legacy = Array.isArray(input) || input?.schemaVersion === undefined;
  const pairs = Array.isArray(input) ? input : input?.pairs;
  if (!Array.isArray(pairs) || !pairs.length || pairs.length > 5000) failure('Evaluation corpus requires 1 to 5000 pairs');
  if (!legacy && input.schemaVersion !== 1) failure('Unsupported evaluation corpus schema');
  const provenance = legacy ? { kind: 'unreviewed', authoredBy: 'unknown' } : input.provenance;
  if (!legacy && (!text(input.corpusId) || !['synthetic', 'independently-reviewed', 'unreviewed'].includes(provenance?.kind) || !text(provenance.authoredBy)))
    failure('Versioned corpus requires corpusId and explicit provenance');
  const seen = new Set();
  const assignments = new Map();
  const normalized = pairs.map((pair) => {
    if (!pair || !text(pair.key) || !text(pair.locale) || !text(pair.category)) failure('Every evaluation pair requires locale, key, and category');
    const unlabeledAudit = !legacy && pair.split === 'audit' && pair.expected === undefined;
    if (!['pass', 'flagged'].includes(pair.expected) && !unlabeledAudit)
      failure('Calibration and holdout require expected pass/flagged labels; only audit may be unlabeled');
    if ((pair.context !== undefined && typeof pair.context !== 'string') || (pair.path !== undefined && typeof pair.path !== 'string'))
      failure('Optional pair context/path must be strings');
    if (seen.has(identity(pair))) failure('Duplicate evaluation locale/key');
    seen.add(identity(pair));
    const split = legacy ? 'calibration' : pair.split;
    const group = legacy ? digest([pair.locale, pair.source]) : pair.group;
    if (!splits.includes(split) || !text(group)) failure('Every versioned pair requires a split and contrast group');
    if (provenance.kind === 'independently-reviewed' && (unlabeledAudit || !text(pair.review?.reviewer) || pair.review?.labelSource !== 'human'))
      failure('Independently reviewed labels require per-pair human reviewer metadata');
    // Contrast variants and identical source prompts cannot straddle calibration/holdout.
    for (const family of [
      `group:${group}`,
      `source:${digest([pair.locale, typeof pair.source === 'string' ? pair.source.normalize('NFKC').trim().replace(/\s+/g, ' ') : pair.source])}`,
    ]) {
      if (assignments.has(family) && assignments.get(family) !== split) failure('Evaluation group or source leaks across splits');
      assignments.set(family, split);
    }
    return { ...pair, split, group };
  });
  return {
    pairs: normalized,
    metadata: {
      corpusId: legacy ? 'legacy-unreviewed' : input.corpusId,
      sha256: digest(input),
      provenance: { kind: provenance.kind, authoredBy: provenance.authoredBy },
      independentlyReviewed: provenance.kind === 'independently-reviewed',
      legacy,
      splits: Object.fromEntries(splits.map((split) => [split, normalized.filter((pair) => pair.split === split).length])),
      note: 'Provenance is supplied by the corpus author, not independently verified by this runner. Keep the corpus hash fixed for a final holdout. Group related/paraphrased examples together.',
    },
  };
}

export function selectEvaluationPairs(corpus, { split = 'calibration', keys = [] } = {}) {
  if (!splits.includes(split)) failure('Split must be calibration, holdout, or audit');
  const labels = corpus.pairs.filter((pair) => pair.split === split && (!keys.length || keys.includes(pair.key)));
  if (keys.some((key) => !labels.some((pair) => pair.key === key))) failure('Requested case is absent from the selected split');
  if (!labels.length || labels.length > 100) failure('Select 1 to 100 evaluation pairs from one split');
  const pairs = labels.map(({ key, locale, source, translation, context = '', path }) => ({ key, locale, source, translation, context, ...(path ? { path } : {}) }));
  return { labels, pairs };
}

// Wilson's 95% upper confidence bound; zero observed errors is not evidence of zero risk.
export function riskUpperBound(errors, count) {
  if (!count) return null;
  const z2 = 1.96 ** 2;
  const p = errors / count;
  return Math.min(1, (p + z2 / (2 * count) + 1.96 * Math.sqrt((p * (1 - p) + z2 / (4 * count)) / count)) / (1 + z2 / count));
}

export function evaluationMetrics(labels, results) {
  const byIdentity = new Map(results.map((result) => [identity(result), result]));
  const cases = labels.map((label) => ({
    key: label.key,
    locale: label.locale,
    category: label.category,
    expected: label.expected,
    actual: ['pass', 'flagged'].includes(byIdentity.get(identity(label))?.status) ? byIdentity.get(identity(label)).status : 'unverified',
  }));
  const positives = cases.filter((entry) => entry.expected === 'flagged');
  const negatives = cases.filter((entry) => entry.expected === 'pass');
  const detected = positives.filter((entry) => entry.actual === 'flagged').length;
  const missed = positives.filter((entry) => entry.actual === 'pass').length;
  const falseAlarms = negatives.filter((entry) => entry.actual === 'flagged').length;
  const unverified = cases.filter((entry) => entry.actual === 'unverified').length;
  const accepted = cases.filter((entry) => entry.actual === 'pass').length;
  const verified = cases.length - unverified;
  return {
    cases: cases.length,
    expectedIssues: positives.length,
    expectedGood: negatives.length,
    detected,
    missed,
    falseAlarms,
    unverified,
    unverifiedIssues: positives.filter((entry) => entry.actual === 'unverified').length,
    recall: ratio(detected, positives.length),
    falseAlarmRate: ratio(falseAlarms, negatives.length),
    verifiedFraction: ratio(verified, cases.length),
    passCoverage: ratio(accepted, cases.length),
    abstentionRate: ratio(unverified, cases.length),
    falsePassRate: ratio(missed, accepted),
    falsePassRiskUpper95: riskUpperBound(missed, accepted),
    selectiveErrorRate: ratio(missed + falseAlarms, verified),
    results: cases,
  };
}

export function observationScore(answers) {
  if (summarizeAnswers(answers).issues.includes('invalid_provider_answers')) return null;
  // This is a routing score across dimensions, not the probability the entire translation is correct.
  return Math.min(...Object.values(answers).map((answer) => answer.probabilities.preserve));
}

export function thresholdResults(results, observations, threshold) {
  if (!Number.isFinite(threshold) || threshold <= 0.5 || threshold > 1) failure('Pass threshold must be greater than 0.5 and at most 1');
  return results.map((result) => {
    if (result.origin !== 'provider') return result;
    const answers = observations.get(identity(result));
    const score = observationScore(answers);
    if (score === null) return { ...result, status: 'unverified', issues: ['invalid_provider_answers'] };
    const summary = summarizeAnswers(answers);
    if (summary.status === 'flagged') return result;
    const passes = Object.values(answers).every((answer) => answer.choice === 'preserve') && score >= threshold;
    return { ...result, status: passes ? 'pass' : 'unverified', issues: passes ? [] : ['semantic_uncertainty'] };
  });
}

export function calibrationReport(labels, results, observations, thresholds, split) {
  if (split !== 'calibration') failure('Threshold sweeps are permitted only on the calibration split');
  const semantic = labels.filter((label) => label.category !== 'structural');
  return {
    note: 'Descriptive calibration-split results only; no threshold is selected or installed. Minimum preservation probability is a routing score, not calibrated pair correctness. Inspect the untouched holdout only after fixing the policy.',
    thresholds: thresholds.map((threshold) => ({ threshold, ...evaluationMetrics(semantic, thresholdResults(results, observations, threshold)) })),
    scoreBands: [
      [0, 0.5],
      [0.5, 0.8],
      [0.8, 0.9],
      [0.9, 0.95],
      [0.95, 1],
    ].map(([low, high]) => {
      const bucket = semantic.filter((label) => {
        const score = observationScore(observations.get(identity(label)));
        return score !== null && score >= low && (score < high || high === 1);
      });
      return { low, high, cases: bucket.length, observedIssueFraction: ratio(bucket.filter((label) => label.expected === 'flagged').length, bucket.length) };
    }),
  };
}

export function selectAuditExamples(labels, results, observations, { uncertain = 5, random = 5, seed = 'translation-audit-v1' } = {}) {
  if (![uncertain, random].every((value) => Number.isInteger(value) && value >= 0 && value <= 100) || !text(seed) || seed.length > 128)
    failure('Audit sample sizes must be integers from 0 to 100 and seed must be 1 to 128 characters');
  const byIdentity = new Map(results.map((result) => [identity(result), result]));
  const eligible = labels.filter((label) => label.split !== 'holdout');
  const hashOrder = (a, b) => digest([seed, identity(a)]).localeCompare(digest([seed, identity(b)]));
  const uncertainEntries = eligible
    .filter((label) => (byIdentity.get(identity(label))?.status || 'unverified') === 'unverified')
    .sort((a, b) => (observationScore(observations.get(identity(a))) ?? -1) - (observationScore(observations.get(identity(b))) ?? -1) || hashOrder(a, b))
    .slice(0, uncertain);
  const used = new Set(uncertainEntries.map(identity));
  const randomEntries = eligible
    .filter((label) => !used.has(identity(label)))
    .sort(hashOrder)
    .slice(0, random);
  const entry = (label, reason) => ({ key: label.key, locale: label.locale, reason, status: byIdentity.get(identity(label))?.status || 'unverified' });
  return {
    seed,
    holdoutExcluded: true,
    note: 'Queue identifiers only; reviewers must inspect the local corpus. Random means a reproducible seeded hash sample from the remaining selected examples, not a representative population estimate.',
    examples: [...uncertainEntries.map((label) => entry(label, 'uncertain')), ...randomEntries.map((label) => entry(label, 'random'))],
  };
}
