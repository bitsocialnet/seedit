import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { askFiles, readAskJson, validateAskInput } from '../ask.mjs';
import { createJevClient } from '../client.mjs';

const exec = promisify(execFile),
  model = 'jev-1.13.0';
const input = (files = ['source.ts'], extra = {}) => ({
  version: 1,
  task: 'Find the account persistence code.',
  files,
  questions: {
    relevance: {
      type: 'choice',
      instructions: 'Does this file persist account data?',
      criteria: {
        relevant: 'It implements account persistence.',
        unrelated: 'It does not implement account persistence.',
        uncertain: 'Cannot decide from this file alone.',
      },
    },
  },
  ...extra,
});
const digest = (value) => createHash('sha256').update(value).digest('hex');
async function fixture(t, entries = { 'source.ts': 'export const saveAccount = () => store.set(account);\n' }) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jev-ask-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(entries)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
  return root;
}
function client({ choose = () => 'relevant', probability = 0.98, inspect = () => {}, ...options } = {}) {
  return createJevClient({
    live: true,
    apiKey: 'fixture-ask-key',
    model,
    fetchImpl: async (_, request) => {
      const body = JSON.parse(request.body);
      await inspect(body);
      return Response.json({
        model,
        answers: Object.fromEntries(
          Object.entries(body.questions).map(([id, question]) => {
            const choice = choose(id, question),
              choices = Object.keys(question.criteria);
            return [
              id,
              {
                type: 'choice',
                choice,
                confidence: probability,
                probabilities: Object.fromEntries(choices.map((key) => [key, key === choice ? probability : (1 - probability) / (choices.length - 1)])),
              },
            ];
          }),
        ),
        usage: { input_tokens: 100, output_tokens: 1 },
      });
    },
    ...options,
  });
}

test('offline validates complete sources, preserves hashes and never touches client or configuration', async (t) => {
  const root = await fixture(t);
  const result = await askFiles(input(), {
    root,
    client: new Proxy(
      {},
      {
        get() {
          throw Error('offline client access');
        },
      },
    ),
  });
  assert.deepEqual(result.usage, { requests: 0 });
  assert.equal(result.items[0].code, 'offline');
  assert.equal(result.items[0].status, 'unverified');
  assert.equal(result.items[0].sha256, digest(await fs.readFile(path.join(root, 'source.ts'))));
  assert.equal(result.items[0].lines, 1);
  assert.equal(result.model, null);
  assert.ok(!JSON.stringify(result).includes('store.set'));
});

test('manifest rejects unknown fields, commands, unsafe scope, excessive questions and missing uncertainty', () => {
  for (const value of [
    input([], {}),
    input(['../other.ts']),
    input(['/tmp/other.ts']),
    input(['src\\a.ts']),
    input(['a.ts', 'a.ts']),
    input(['src/*.ts']),
    input(['.env']),
    input(['src/.hidden.ts']),
    input(['Vault/a.txt']),
    input(['keys/a.json']),
    input(['credentials.json']),
    input(['src/api-key.json']),
    input(['a.pem']),
    input(['src']),
    input(['a.ts'], { command: 'echo hi' }),
    input(['a.ts'], { questions: { q: { type: 'choice', instructions: 'x', criteria: { yes: 'yes', no: 'no' } } } }),
    input(['a.ts'], { evidence: { question: 'missing', choice: 'relevant' } }),
    input(['a.ts'], { evidence: { question: 'relevance', choice: 'uncertain' } }),
    input(['a.ts'], { task: 'x'.repeat(1001) }),
    input(Array.from({ length: 13 }, (_, i) => `${i}.ts`)),
  ])
    assert.throws(() => validateAskInput(value));
});

test('manifest reader refuses symlink files, symlink parents, binary and oversized input', async (t) => {
  const root = await fixture(t, { 'manifest.json': JSON.stringify(input()), 'large.json': ' '.repeat(24_001), 'bad.json': Buffer.from([0xff]) });
  await fs.symlink(path.join(root, 'manifest.json'), path.join(root, 'link.json'));
  await fs.symlink(root, path.join(root, 'alias'));
  await assert.rejects(readAskJson(path.join(root, 'link.json')), /unsafe_file/);
  await assert.rejects(readAskJson(path.join(root, 'alias/manifest.json')), /unsafe_file/);
  await assert.rejects(readAskJson(path.join(root, 'large.json')), /file_too_large/);
  await assert.rejects(readAskJson(path.join(root, 'bad.json')), /binary_file/);
  assert.deepEqual(await readAskJson(path.join(root, 'manifest.json')), input());
});

test('source preflight rejects symlinks, directories, binary, oversized, long lines and credentials before uploading them', async (t) => {
  const root = await fixture(t, {
    'okay.ts': 'const okay = true;\n',
    'secret.txt': 'ghp_' + 'a'.repeat(36),
    'binary.txt': Buffer.from([0, 1, 2]),
    'huge.ts': 'x'.repeat(64_001),
    'long.ts': 'x'.repeat(2001),
    'invalid.txt': Buffer.from([0xff]),
  });
  await fs.mkdir(path.join(root, 'folder.ts'));
  await fs.symlink(path.join(root, 'okay.ts'), path.join(root, 'linked.ts'));
  await fs.symlink(root, path.join(root, 'alias'));
  let calls = 0;
  const result = await askFiles(input(['okay.ts', 'binary.txt', 'huge.ts', 'long.ts', 'invalid.txt', 'folder.ts', 'linked.ts', 'alias/okay.ts', 'missing.ts']), {
    root,
    live: true,
    client: client({
      inspect: () => {
        calls++;
      },
    }),
  });
  assert.equal(calls, 1);
  assert.equal(result.items.length, 9);
  assert.equal(result.items[0].status, 'advisory');
  assert.deepEqual(
    result.items.slice(1).map((x) => x.code),
    ['binary_file', 'file_too_large', 'source_line_too_long', 'binary_file', 'invalid_file', 'unsafe_file', 'unsafe_file', 'ask_unavailable'],
  );
  // A protected basename is rejected even before opening it.
  await assert.rejects(askFiles(input(['secret.txt']), { root, live: true, client: client() }), /invalid_ask_input/);
});

test('common credential content and loaded provider key do not leave the machine', async (t) => {
  let calls = 0;
  const root = await fixture(t, { 'source.ts': 'const value = "ghp_' + 'a'.repeat(36) + '";\n' });
  const guarded = client({
    inspect: () => {
      calls++;
    },
  });
  const result = await askFiles(input(), { root, live: true, client: guarded });
  assert.equal(result.items[0].code, 'possible_secret');
  assert.equal(calls, 0);
  await assert.rejects(askFiles(input(['source.ts'], { task: 'Find sk-' + 'a'.repeat(30) }), { root, live: true, client: guarded }), /possible_secret/);
  await fs.writeFile(path.join(root, 'source.ts'), 'fixture-ask-key');
  const exact = await askFiles(input(), { root, live: true, client: guarded });
  assert.equal(exact.items[0].code, 'secret_in_input');
  assert.equal(calls, 0);
  assert.ok(!JSON.stringify(exact).includes('fixture-ask-key'));
});

test('evidence is an exact bounded source range and hash; paths are not uploaded', async (t) => {
  const content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}\n`).join('');
  const root = await fixture(t, { 'source.ts': content });
  const result = await askFiles(input(['source.ts'], { evidence: { question: 'relevance', choice: 'relevant' } }), {
    root,
    live: true,
    client: client({
      choose: (id) => (id === 'evidence_block' ? 'block_2' : 'relevant'),
      inspect: (body) => {
        assert.equal(body.state.source.blocks.map((x) => x.text).join(''), content);
        assert.ok(!JSON.stringify(body).includes('source.ts'));
        assert.match(body.questions.relevance.instructions, /untrusted evidence/);
        assert.match(body.questions.evidence_block.instructions, /Does this file persist account data/);
        assert.match(body.questions.evidence_block.instructions, /It implements account persistence/);
      },
    }),
  });
  const evidence = result.items[0].evidence;
  assert.equal(result.items[0].status, 'advisory');
  assert.equal(evidence.startLine, 33);
  assert.equal(evidence.endLine, 50);
  assert.equal(evidence.excerpt, content.split('\n').slice(32, 50).join('\n') + '\n');
  assert.equal(evidence.sourceSha256, digest(content));
  assert.equal(evidence.excerptSha256, digest(evidence.excerpt));
});

test('all negative files remain visible; contradictory or uncertain evidence never earns advisory status', async (t) => {
  const root = await fixture(t, { 'a.ts': 'one\n', 'b.ts': 'two\n' });
  for (const [choice, evidence, status] of [
    ['unrelated', 'none', 'advisory'],
    ['unrelated', 'block_1', 'unverified'],
    ['relevant', 'none', 'unverified'],
    ['relevant', 'uncertain', 'unverified'],
    ['uncertain', 'none', 'unverified'],
  ]) {
    const result = await askFiles(input(['a.ts', 'b.ts'], { evidence: { question: 'relevance', choice: 'relevant' } }), {
      root,
      live: true,
      client: client({ choose: (id) => (id === 'evidence_block' ? evidence : choice) }),
    });
    assert.equal(result.items.length, 2);
    assert.ok(result.items.every((x) => x.status === status && x.answers.relevance.choice === choice));
    assert.ok(!JSON.stringify(result).includes('"success"'));
    assert.ok(result.items.every((x) => !x.evidence));
  }
});

test('low confidence, provider errors, model mismatch and exhausted budgets retain all files unverified', async (t) => {
  const root = await fixture(t, { 'a.ts': 'one\n', 'b.ts': 'two\n' });
  const low = await askFiles(input(['a.ts']), { root, live: true, client: client({ probability: 0.6 }) });
  assert.equal(low.items[0].code, 'uncertain');
  assert.equal(low.items[0].answers.relevance.choice, 'relevant');
  const budget = await askFiles(input(['a.ts', 'b.ts']), { root, live: true, concurrency: 3, client: client({ maxRequests: 1 }) });
  assert.equal(budget.usage.requests, 1);
  // Concurrent source reads may reach the shared request budget in either order.
  assert.equal(budget.items.filter((item) => item.code === 'budget_exhausted').length, 1);
  assert.equal(budget.items.filter((item) => item.status === 'advisory').length, 1);
  assert.deepEqual(
    budget.items.map((item) => item.path),
    ['a.ts', 'b.ts'],
  );
  for (const [fetchImpl, code] of [
    [async () => new Response('sensitive provider body', { status: 429 }), 'provider_throttled'],
    [async () => Response.json({ model: 'different', answers: {} }), 'invalid_response'],
    [
      async () => {
        throw Error('sensitive exception');
      },
      'provider_unavailable',
    ],
  ]) {
    const result = await askFiles(input(['a.ts']), { root, live: true, client: client({ fetchImpl }) });
    assert.equal(result.items[0].code, code);
    assert.equal(result.items[0].status, 'unverified');
    assert.ok(!JSON.stringify(result).includes('sensitive'));
    assert.equal(result.usage.usageMissing, 1);
  }
});

test('source changes invalidate answers and evidence while preserving the original fingerprint', async (t) => {
  const root = await fixture(t);
  const before = await askFiles(input(), { root });
  const live = await askFiles(input(), { root, live: true, client: client({ inspect: () => fs.writeFile(path.join(root, 'source.ts'), 'changed\n') }) });
  assert.equal(live.items[0].code, 'source_changed');
  assert.equal(live.items[0].status, 'unverified');
  assert.equal(live.items[0].answers.relevance.choice, 'relevant');
  assert.equal(live.fingerprint, before.fingerprint);
  assert.notEqual((await askFiles(input(), { root })).fingerprint, before.fingerprint);
});

test('shell metacharacters in an explicit filename are inert and no commands are executed', async (t) => {
  const file = 'source;$(touch PWNED).ts';
  const root = await fixture(t, { [file]: 'plain source\n' });
  const result = await askFiles(input([file]), { root });
  assert.equal(result.items[0].path, file);
  assert.equal(result.items[0].code, 'offline');
  await assert.rejects(fs.stat(path.join(root, 'PWNED')), { code: 'ENOENT' });
});

test('CLI offline ignores unavailable private configuration and preserves explicit source scope', async (t) => {
  const root = await fixture(t, { 'input.json': JSON.stringify(input(['scripts/jev/ask.mjs'])) });
  // This helper's own file is longer than a block but valid, and exercises actual repository-root resolution.
  const { stdout } = await exec(process.execPath, [new URL('../ask.mjs', import.meta.url).pathname, '--input', path.join(root, 'input.json')], {
    env: { ...process.env, JEV_CONFIG_FILE: '/nonexistent/jev-config.json', TYPESAFE_API_KEY: '' },
  });
  const result = JSON.parse(stdout);
  assert.equal(result.offline, true);
  assert.equal(result.usage.requests, 0);
  assert.equal(result.items[0].path, 'scripts/jev/ask.mjs');
});

test('concurrency is bounded and late responses remain unverified', async (t) => {
  const root = await fixture(t, { 'a.ts': 'a\n', 'b.ts': 'b\n', 'c.ts': 'c\n', 'd.ts': 'd\n' });
  let active = 0,
    peak = 0;
  const result = await askFiles(input(['a.ts', 'b.ts', 'c.ts', 'd.ts']), {
    root,
    live: true,
    concurrency: 2,
    client: client({
      inspect: async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active--;
      },
    }),
  });
  assert.equal(peak, 2);
  assert.equal(result.usage.requests, 4);
  await assert.rejects(askFiles(input(['a.ts']), { root, concurrency: 4 }), /invalid_limits/);
  const late = await askFiles(input(['a.ts']), { root, live: true, deadlineMs: 5, client: client({ inspect: () => new Promise((resolve) => setTimeout(resolve, 15)) }) });
  assert.equal(late.items[0].code, 'deadline_exceeded');
});

test('large ordinary source remains complete within bounded line blocks', async (t) => {
  const content = Array.from({ length: 1000 }, () => '// ' + 'x'.repeat(55) + '\n').join('');
  const root = await fixture(t, { 'source.ts': content });
  const result = await askFiles(input(), {
    root,
    live: true,
    client: client({
      maxInputBytes: 128_000,
      inspect: (body) => {
        const blocks = body.state.source.blocks;
        assert.equal(blocks.map((x) => x.text).join(''), content);
        assert.ok(blocks.length <= 40);
        assert.ok(blocks.every((x) => x.text.length <= 2000));
      },
    }),
  });
  assert.equal(result.items[0].bytes, Buffer.byteLength(content));
  assert.equal(result.items[0].status, 'advisory');
});

test('all files preflight before upload; later changed files are retained without a request', async (t) => {
  const root = await fixture(t, { 'a.ts': 'a\n', 'b.ts': 'original\n' });
  const result = await askFiles(input(['a.ts', 'b.ts']), {
    root,
    live: true,
    concurrency: 1,
    client: client({ inspect: () => fs.writeFile(path.join(root, 'b.ts'), 'changed\n') }),
  });
  assert.equal(result.usage.requests, 1);
  assert.equal(result.items[1].sha256, digest('original\n'));
  assert.equal(result.items[1].code, 'source_changed');
  assert.equal(result.items[1].status, 'unverified');
});

test('evidence selector carries arbitrary user rubric meaning without relying on question IDs', async (t) => {
  const root = await fixture(t);
  const custom = input(['source.ts'], {
    task: 'Investigate rendering.',
    questions: {
      q7: {
        type: 'choice',
        instructions: 'Does this code persist votes to disk?',
        criteria: { alpha: 'Calls durable vote storage.', beta: 'Only computes rendering.', uncertain: 'Evidence missing.' },
      },
    },
    evidence: { question: 'q7', choice: 'alpha' },
  });
  const result = await askFiles(custom, {
    root,
    live: true,
    client: client({
      choose: (id) => (id === 'q7' ? 'alpha' : 'block_1'),
      inspect: (body) => {
        assert.match(body.questions.evidence_block.instructions, /Does this code persist votes to disk/);
        assert.match(body.questions.evidence_block.instructions, /Calls durable vote storage/);
      },
    }),
  });
  assert.equal(result.items[0].status, 'advisory');
});
