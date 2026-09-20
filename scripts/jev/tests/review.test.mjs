import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { readReviewJson, validateReviewInput, validateReviewRules, reviewPatches, reviewMetrics, collectReviewDiff } from '../review.mjs';
import { createJevClient, JevError } from '../client.mjs';
const exec = promisify(execFile);
const rules = validateReviewRules(JSON.parse(await fs.readFile(new URL('../review-rules.json', import.meta.url), 'utf8')));
const item = {
  id: 'example',
  path: 'src/view.ts',
  diff: '+ status("Done")',
  context: 'Fixture context',
  rules: ['state_truth'],
  expected: { state_truth: 'issue' },
};
const model = 'jev-1.13.0';
const answer = (choice = 'clear', probability = 0.99) => ({
  choice,
  probabilities: {
    clear: choice === 'clear' ? probability : (1 - probability) / 2,
    issue: choice === 'issue' ? probability : (1 - probability) / 2,
    uncertain: choice === 'uncertain' ? probability : (1 - probability) / 2,
  },
  confidence: probability,
  type: 'choice',
});
const client = (choice = 'clear', probability = 0.99, inspect = () => {}) =>
  createJevClient({
    live: true,
    apiKey: 'fixture-review-key',
    model,
    fetchImpl: async (_, request) => {
      inspect(JSON.parse(request.body));
      return Response.json({
        model,
        answers: { state_truth: answer(choice, probability) },
        usage: { input_tokens: 100, output_tokens: 10 },
      });
    },
  });

test('offline validation never touches credentials or a client', async () => {
  const result = await reviewPatches([item], rules, {
    client: {
      ask() {
        throw Error('must not call');
      },
      stats() {
        return { requests: 0 };
      },
    },
  });
  assert.equal(result.items[0].status, 'unverified');
  assert.equal(result.items[0].code, 'offline');
  assert.equal(result.usage.requests, 0);
});
test('only patch and explicit context are sent; labels and identity stay local', async () => {
  const result = await reviewPatches([item], rules, {
    live: true,
    client: client('issue', 0.99, (body) => {
      assert.deepEqual(body.state, { diff: item.diff, context: item.context });
      assert.ok(!JSON.stringify(body).includes('"expected"'));
      assert.ok(!JSON.stringify(body).includes(item.path));
    }),
  });
  assert.equal(result.items[0].status, 'issue');
  assert.equal(result.advisory, true);
  assert.ok(!JSON.stringify(result).includes(item.diff));
});
test('uncertainty, low probability, provider errors and budgets stay unverified', async () => {
  for (const [choice, p] of [
    ['uncertain', 0.99],
    ['clear', 0.6],
    ['issue', 0.6],
  ])
    assert.equal((await reviewPatches([item], rules, { live: true, client: client(choice, p) })).items[0].status, 'unverified');
  const result = await reviewPatches([item], rules, {
    live: true,
    client: {
      ask() {
        throw new JevError('budget_exhausted');
      },
      stats() {
        return { requests: 1, estimatedCostUsd: null };
      },
    },
  });
  assert.equal(result.items[0].code, 'budget_exhausted');
  assert.equal(result.usage.estimatedCostUsd, null);
});
test('common credential patterns and exact provider key are never sent', async () => {
  for (const text of [
    '-----BEGIN PRIVATE KEY-----',
    'ghp_' + 'a'.repeat(36),
    'github_pat_' + 'a'.repeat(22) + '_' + 'b'.repeat(59),
    'AKIA' + 'A'.repeat(16),
    'sk-proj-' + 'x'.repeat(30),
  ]) {
    const result = await reviewPatches([{ ...item, diff: text }], rules, {
      live: true,
      client: client(),
    });
    assert.equal(result.items[0].code, 'possible_secret');
    assert.equal(result.usage.requests, 0);
  }
  const result = await reviewPatches([{ ...item, diff: 'fixture-review-key' }], rules, {
    live: true,
    client: client(),
  });
  assert.equal(result.items[0].code, 'secret_in_input');
  assert.equal(result.usage.requests, 0);
});
test('invalid and ambiguous scopes fail rather than silently widening', () => {
  for (const bad of [
    { ...item, path: '../secret.ts' },
    { ...item, path: 'src/../file.ts' },
    { ...item, path: '.env.json' },
    { ...item, diff: '' },
    { ...item, diff: 'x'.repeat(40001) },
    { ...item, rules: [] },
    { ...item, rules: ['unknown'] },
    { ...item, expected: { state_truth: 'pass' } },
  ])
    assert.throws(() => validateReviewInput({ version: 1, items: [bad] }, rules));
  assert.throws(() => validateReviewInput({ version: 1, items: [item, item] }, rules));
  assert.throws(() => validateReviewRules({ version: 1, rules: [...rules, rules[0]] }));
});
test('metrics retain unavailable positive cases in recall and never count clear as accuracy', () => {
  const labels = [item, { ...item, id: 'good', expected: { state_truth: 'clear' } }];
  const metrics = reviewMetrics(labels, [
    { id: 'example', checks: [] },
    { id: 'good', checks: [{ rule: 'state_truth', status: 'issue' }] },
  ]);
  assert.equal(metrics.recall, 0);
  assert.equal(metrics.precision, 0);
  assert.equal(metrics.unverified, 1);
  assert.equal(metrics.falseFlags, 1);
});
test('definite judgments on intentionally insufficient evidence count as errors', () => {
  const labels = [{ ...item, expected: { state_truth: 'uncertain' } }];
  const flagged = reviewMetrics(labels, [{ id: item.id, checks: [{ rule: 'state_truth', status: 'issue' }] }]);
  assert.equal(flagged.falseFlags, 1);
  assert.equal(flagged.unsupportedFlags, 1);
  assert.equal(flagged.precision, 0);
  const cleared = reviewMetrics(labels, [{ id: item.id, checks: [{ rule: 'state_truth', status: 'clear' }] }]);
  assert.equal(cleared.falseClears, 1);
  assert.equal(cleared.unsupportedClears, 1);
});
test('Git scope is explicit, argument-safe and refuses symlinks/untracked files', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-review-test-'));
  try {
    await exec('git', ['init', '--quiet'], { cwd });
    await fs.writeFile(path.join(cwd, 'a.ts'), 'const a=1;\n');
    await exec('git', ['add', 'a.ts'], { cwd });
    await exec('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture'], { cwd });
    await fs.writeFile(path.join(cwd, 'a.ts'), 'const a=2;\n');
    const input = await collectReviewDiff('HEAD', ['a.ts'], { cwd });
    assert.match(input.items[0].diff, /const a=2/);
    await assert.rejects(collectReviewDiff('--output=bad', ['a.ts'], { cwd }));
    await assert.rejects(collectReviewDiff('HEAD', [], { cwd }));
    await fs.writeFile(path.join(cwd, 'untracked.ts'), 'x');
    await assert.rejects(collectReviewDiff('HEAD', ['untracked.ts'], { cwd }), /untracked_review_file/);
    await fs.symlink(path.join(cwd, 'a.ts'), path.join(cwd, 'link.ts'));
    await assert.rejects(collectReviewDiff('HEAD', ['link.ts'], { cwd }), /unsafe_review_path/);
    await assert.rejects(readReviewJson(path.join(cwd, 'link.ts')));
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});
test('fixture labels validate and are explicitly synthetic', async () => {
  const input = await readReviewJson(new URL('../fixtures/review.json', import.meta.url));
  assert.equal(input.provenance, 'synthetic');
  assert.equal(validateReviewInput(input, rules).length, 12);
});

test('Git filenames with pathspec metacharacters do not widen the selection', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-review-literal-'));
  try {
    await exec('git', ['init', '--quiet'], { cwd });
    await fs.mkdir(path.join(cwd, 'src'));
    for (const file of ['[x].ts', 'x.ts']) await fs.writeFile(path.join(cwd, 'src', file), 'const value = 1;\n');
    await exec('git', ['add', '.'], { cwd });
    await exec('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture'], { cwd });
    await fs.writeFile(path.join(cwd, 'src/[x].ts'), 'const value = 2;\n');
    await fs.writeFile(path.join(cwd, 'src/x.ts'), 'const OUT_OF_SCOPE = 3;\n');
    const input = await collectReviewDiff('HEAD', ['src/[x].ts'], { cwd });
    assert.equal(input.items.length, 1);
    assert.match(input.items[0].diff, /value = 2/);
    assert.ok(!input.items[0].diff.includes('OUT_OF_SCOPE'));
    assert.equal((input.items[0].diff.match(/diff --git/g) || []).length, 1);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});
