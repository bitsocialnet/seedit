#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { translationQuestions, TRANSLATION_RUBRIC_VERSION, structuralIssues } from './translations.mjs';
import { validateEvaluationCorpus } from './translation-evaluation.mjs';
import { createReviewQueue, selectReview, readReviewJson, writeReviewJson, reviewHash } from './review-handoff.mjs';

export function prepareTranslationReview(items, { corpusId = 'translation-blind-v1' } = {}) {
  return createReviewQueue({
    kind: 'translation',
    corpusId,
    rubric: {
      version: TRANSLATION_RUBRIC_VERSION,
      sourceSha256: reviewHash(translationQuestions()),
      text:
        'Compare the English source with the Italian translation in its supplied context. Label pass only when meaning, negation, qualifications, scope, and terminology are preserved and placeholders/markup remain valid. Flag a material error, untranslated ordinary text, or missing content. Brand names may remain unchanged. Prefer semantic correctness over stylistic preference. Choose uncertain / needs context if you cannot judge confidently. These are actual repository strings selected deterministically, not representative user traffic.\n\nExact current evaluator questions:\n' +
        JSON.stringify(translationQuestions(), null, 2),
    },
    items,
  });
}

export function importTranslationReview(queue, bundle) {
  if (queue.kind !== 'translation') throw new Error('Expected translation queue');
  const manifest = selectReview(queue, bundle);
  const labeled = manifest.items.filter((item) => item.state === 'labeled');
  const sourceKind = queue.items[0].source.kind;
  const corpus = labeled.length
    ? {
        schemaVersion: 1,
        corpusId: queue.corpusId,
        provenance: {
          kind: sourceKind === 'synthetic' ? 'synthetic' : 'independently-reviewed',
          authoredBy: manifest.reviewer.id,
          sourceKind,
          queueSha256: manifest.queueSha256,
          rubricSha256: manifest.rubricSha256,
          model: manifest.model,
        },
        pairs: labeled.map((item) => ({
          key: item.id,
          ...item.content,
          path: `${item.source.repository}/${item.source.translationPath ?? item.source.path}`,
          expected: item.label,
          category: structuralIssues(item.content).length ? 'structural' : 'human-review',
          group: item.group,
          split: item.split,
          review: {
            labelSource: 'human',
            reviewer: manifest.reviewer.id,
            reviewedAt: manifest.reviewer.reviewedAt,
            independentOfModelOutput: true,
            contentSha256: item.contentSha256,
          },
          sourceProvenance: item.source,
        })),
      }
    : null;
  if (corpus) validateEvaluationCorpus(corpus);
  return { corpus, manifest };
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({ args: argv, options: { help: { type: 'boolean' }, queue: { type: 'string' }, review: { type: 'string' }, out: { type: 'string' } } });
  if (values.help) {
    console.log(
      'Offline import: node scripts/jev/translations-review.mjs --queue translations-queue.json --review bitsocial-human-review.json --out new-output-prefix\nWrites decided-only evaluator corpus and complete pending/provenance manifest; never overwrites files. Export API: prepareTranslationReview + reviewHtml from review-handoff.mjs.',
    );
    return;
  }
  if (!values.queue || !values.review || !values.out) throw new Error('Explicit queue, review bundle, and new output prefix required');
  const result = importTranslationReview(await readReviewJson(values.queue), await readReviewJson(values.review));
  for (const [name, value] of Object.entries(result)) if (value !== null) await writeReviewJson(`${values.out}.${name}.json`, value);
  console.log(JSON.stringify({ outputPrefix: values.out, ...result.manifest.summary, accuracy: 'unmeasured' }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(() => {
    console.error('Review import failed: check queue identity, reviewer fields, labels, and unused output paths. No accuracy result was produced.');
    process.exitCode = 1;
  });
