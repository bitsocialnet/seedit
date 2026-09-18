import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createJevClient } from '../client.mjs';
import { evaluationMetrics, main as evaluateMain } from '../translations-eval.mjs';
import {
  flattenTranslations,
  gitRelativePath,
  loadLocalePairs,
  loadParagraphPairs,
  main as translationMain,
  parseScopedCsv,
  reviewTranslations,
  structuralIssues,
  summarizeAnswers,
  translationCacheKey,
} from '../translations.mjs';

const model = 'jev-1.13.0';
const goodPair = { key: 'secret', locale: 'it', source: 'Do not share your private key.', translation: 'Non condividere la tua chiave privata.' };
function answers(choice = 'preserve', confidence = 0.99) {
  return Object.fromEntries(
    ['meaning', 'qualifications', 'terminology'].map((id) => [
      id,
      {
        choice,
        confidence,
        probabilities: Object.fromEntries(['preserve', 'issue', 'uncertain'].map((item) => [item, item === choice ? confidence : (1 - confidence) / 2])),
      },
    ]),
  );
}
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-translation-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
async function json(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value));
}
function fakeClient(choice = 'preserve') {
  const requests = [];
  return {
    requests,
    ask: async (request) => {
      requests.push(request);
      return { model, answers: answers(choice) };
    },
  };
}
function runGit(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

test('placeholder-preserving reversed meaning is structurally valid and requires semantic QA', () => {
  assert.deepEqual(structuralIssues({ source: 'You cannot delete {{count}} posts.', translation: 'Vous pouvez supprimer {{count}} publications.' }), []);
});

test('structural checks catch missing keys, placeholder multiplicity, tags, URLs, addresses and code', () => {
  assert.deepEqual(structuralIssues({ source: 'One' }), ['missing_or_nonstring_translation']);
  assert.deepEqual(structuralIssues({ source: 'One', translation: '' }), ['empty_translation']);
  assert.deepEqual(structuralIssues({ source: '{{count}} + {{count}}', translation: '{{count}}' }), ['placeholder_mismatch']);
  assert.deepEqual(structuralIssues({ source: '<0>One</0>', translation: '<1>Uno</1>' }), ['tag_mismatch']);
  assert.deepEqual(structuralIssues({ source: 'Open https://example.org.', translation: 'Apri https://other.org.' }), ['protected_token_mismatch']);
  assert.deepEqual(structuralIssues({ source: 'Run `export-key`.', translation: 'Esegui `import-key`.' }), ['protected_token_mismatch']);
  assert.deepEqual(structuralIssues({ source: '0x0000000000000000000000000000000000000001', translation: '0x0000000000000000000000000000000000000002' }), [
    'protected_token_mismatch',
  ]);
});

test('natural reordering keeps structural checks green', () => {
  assert.deepEqual(structuralIssues({ source: '<b>{{name}}</b> has {{count}} posts.', translation: '{{count}} pubblicazioni di <b>{{name}}</b>.' }), []);
});

test('same tag inventory with broken nesting is still a structural failure', () => {
  assert.deepEqual(structuralIssues({ source: '<b><i>One</i></b>', translation: '<b><i>Uno</b></i>' }), ['unbalanced_tags']);
});

test('nested keys flatten while ambiguous dotted keys fail', () => {
  assert.equal(flattenTranslations({ nav: { help: 'Help' } })['nav.help'], 'Help');
  assert.throws(() => flattenTranslations({ nav: { help: 'Help' }, 'nav.help': 'Other' }), /Ambiguous/);
});

test('offline and structural failures never call the provider', async () => {
  const client = fakeClient();
  const report = await reviewTranslations([goodPair, { ...goodPair, key: 'missing', translation: undefined }], { client });
  assert.equal(client.requests.length, 0);
  assert.deepEqual(report.summary, { pass: 0, flagged: 1, unverified: 1 });
  assert.equal(report.results[0].issues[0], 'live_disabled');
});

test('only strong preserve results pass and any semantic issue flags', () => {
  assert.equal(summarizeAnswers(answers()).status, 'pass');
  assert.equal(summarizeAnswers(answers('preserve', 0.8)).status, 'unverified');
  assert.equal(summarizeAnswers(answers('uncertain')).status, 'unverified');
  const bad = answers();
  bad.meaning = answers('issue').meaning;
  assert.deepEqual(summarizeAnswers(bad), { status: 'flagged', issues: ['semantic_meaning'] });
});

test('malformed, missing, extra and contradictory probability answers never pass', () => {
  for (const value of [
    null,
    {},
    { ...answers(), invented: {} },
    { ...answers(), meaning: { ...answers().meaning, probabilities: { preserve: 1, issue: 1, uncertain: 1 } } },
  ]) {
    assert.equal(summarizeAnswers(value).status, 'unverified');
  }
  const contradictory = answers();
  contradictory.meaning.choice = 'issue';
  assert.equal(summarizeAnswers(contradictory).status, 'unverified');
});

test('only explicitly selected pair text and context are submitted, without labels or paths', async () => {
  const client = fakeClient();
  const pair = { ...goodPair, expected: 'pass', path: 'docs/it/privacy.md', unrelated: 'private-data' };
  const report = await reviewTranslations([pair], { client, live: true, model, context: 'Cryptographic keys are not passwords.' });
  assert.equal(report.results[0].status, 'pass');
  assert.equal(report.results[0].path, pair.path);
  assert.deepEqual(Object.keys(client.requests[0].questions), ['meaning', 'qualifications', 'terminology']);
  assert.equal(client.requests[0].state.domainContext, 'Cryptographic keys are not passwords.');
  assert.ok(!JSON.stringify(client.requests[0]).includes('private-data'));
  assert.ok(!JSON.stringify(client.requests[0]).includes('docs/it/privacy.md'));
  assert.ok(!own(client.requests[0].state, 'expected'));
});
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

test('omitted filters allow explicit pair-file scope, but provided blank CSV filters never widen it', () => {
  assert.deepEqual(parseScopedCsv(undefined, '--keys'), []);
  assert.deepEqual(parseScopedCsv('a, a ,b', '--keys'), ['a', 'b']);
  for (const value of ['', ' ', ',', ' , , ']) assert.throws(() => parseScopedCsv(value, '--keys'), /--keys requires/);
});

test('empty keys, locales and changed-files are rejected before input loading or live requests', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    throw new Error('Unexpected provider call');
  });
  for (const option of ['--keys', '--locales', '--changed-files']) {
    for (const value of ['', ' ', ',', ' , , ']) {
      await assert.rejects(
        () => translationMain(['--pairs', '/nonexistent-unread-fixture.json', '--live', '--model', model, option, value]),
        new RegExp(`${option} requires`),
      );
    }
  }
  assert.equal(calls, 0);
});

test('empty evaluation cases are rejected before any input loading or live requests', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    throw new Error('Unexpected provider call');
  });
  for (const value of ['', ' ', ',', ' , , ']) {
    await assert.rejects(() => evaluateMain(['--corpus', '/nonexistent-unread-fixture.json', '--live', '--model', model, '--cases', value]), /--cases requires/);
  }
  assert.equal(calls, 0);
});

test('model failures and mismatched model identities stay unverified without echoed secrets', async () => {
  for (const client of [
    {
      ask: async () => {
        throw new Error('secret-provider-body');
      },
    },
    { ask: async () => ({ model: 'jev-other', answers: answers() }) },
  ]) {
    const report = await reviewTranslations([goodPair], { client, live: true, model });
    assert.equal(report.results[0].status, 'unverified');
    assert.ok(!JSON.stringify(report).includes('secret-provider-body'));
  }
  await assert.rejects(() => reviewTranslations([goodPair], { live: true, model: 'jev-latest' }), /pinned/);
});

test('cache is private and contains no source, translation, key, domain context, or API key', async (t) => {
  const cacheDir = path.join(await temporary(t), 'cache');
  const client = fakeClient();
  await reviewTranslations([goodPair], { client, live: true, model, cacheDir, context: 'context-sentinel' });
  const [file] = await fs.readdir(cacheDir);
  assert.match(file, /^[a-f0-9]{64}\.json$/);
  const contents = await fs.readFile(path.join(cacheDir, file), 'utf8');
  for (const sentinel of [goodPair.source, goodPair.translation, goodPair.key, 'context-sentinel']) assert.ok(!contents.includes(sentinel));
  assert.equal((await fs.stat(cacheDir)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.join(cacheDir, file))).mode & 0o777, 0o600);
  const cached = await reviewTranslations([goodPair], { client, live: true, model, cacheDir, context: 'context-sentinel' });
  assert.equal(client.requests.length, 1);
  assert.equal(cached.results[0].origin, 'cache');
});

test('cache identity changes with source, translation, locale, model and rubric context', () => {
  const original = translationCacheKey(goodPair, model);
  for (const pair of [
    { ...goodPair, source: 'Changed' },
    { ...goodPair, translation: 'Changed' },
    { ...goodPair, locale: 'fr' },
    { ...goodPair, context: 'Changed' },
  ]) {
    assert.notEqual(original, translationCacheKey(pair, model));
  }
  assert.notEqual(original, translationCacheKey(goodPair, 'jev-1.14.0'));
  assert.notEqual(original, translationCacheKey(goodPair, model, 'Changed'));
});

test('expired and corrupt cache entries cause a fresh check', async (t) => {
  const cacheDir = await temporary(t);
  const client = fakeClient();
  const cacheFile = path.join(cacheDir, `${translationCacheKey(goodPair, model)}.json`);
  await json(cacheFile, { model, createdAt: 1, answers: answers() });
  await reviewTranslations([goodPair], { client, live: true, model, cacheDir, now: 10 * 24 * 60 * 60 * 1000 });
  await fs.writeFile(cacheFile, '{');
  await reviewTranslations([goodPair], { client, live: true, model, cacheDir });
  assert.equal(client.requests.length, 2);
});

test('shared client enforces a real request limit and preserves unverified budget results', async () => {
  let calls = 0;
  const client = createJevClient({
    live: true,
    model,
    apiKey: 'fixture-token',
    maxRequests: 1,
    fetchImpl: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          model,
          answers: Object.fromEntries(Object.entries(answers()).map(([id, value]) => [id, { ...value, type: 'choice' }])),
          usage: { input_tokens: 500, output_tokens: 12 },
        }),
      );
    },
  });
  const report = await reviewTranslations([goodPair, { ...goodPair, key: 'next' }], { client, live: true, model });
  assert.equal(calls, 1);
  assert.equal(report.results[0].status, 'pass');
  assert.deepEqual(report.results[1].issues, ['budget_exhausted']);
  assert.equal(report.usage.inputTokens, 500);
});

test('locale scans require explicit locales and keys or Git filtering', async (t) => {
  const cwd = await temporary(t);
  await assert.rejects(() => loadLocalePairs({ cwd, locales: [] }), /--locales/);
  await assert.rejects(() => loadLocalePairs({ cwd, locales: ['it'] }), /implicit whole-catalog/);
  await assert.rejects(() => loadLocalePairs({ cwd, locales: ['../secrets'], keys: ['a'] }), /locale codes/);
});

test('explicit locale keys report missing source and target entries', async (t) => {
  const cwd = await temporary(t);
  await json(path.join(cwd, 'public/translations/en/default.json'), { a: 'One' });
  await json(path.join(cwd, 'public/translations/it/default.json'), { b: 'Due' });
  const pairs = await loadLocalePairs({ cwd, locales: ['it'], keys: ['a', 'b'] });
  assert.equal(pairs.length, 2);
  assert.deepEqual(structuralIssues(pairs[0]), ['missing_or_nonstring_translation']);
  assert.deepEqual(structuralIssues(pairs[1]), ['missing_or_nonstring_source']);
});

test('Git changed-file paths match English and target catalogs on Windows and POSIX', () => {
  const changed = new Set(['public/translations/en/default.json', 'public/translations/it/default.json']);
  for (const pathApi of [path.win32, path.posix]) {
    const repository = pathApi.resolve('fixtures', 'repository');
    for (const locale of ['en', 'it']) {
      const file = pathApi.join(repository, 'public', 'translations', locale, 'default.json');
      assert.ok(changed.has(gitRelativePath(repository, file, pathApi)), `${pathApi.sep} ${locale}`);
    }
    assert.ok(!changed.has(gitRelativePath(repository, pathApi.join(repository, 'public/translations/fr/default.json'), pathApi)));
  }
});

test('malformed locale diagnostics identify the selected English or target catalog without contents', async (t) => {
  const cwd = await temporary(t);
  const sourceFile = path.join(cwd, 'public/translations/en/default.json');
  const targetFile = path.join(cwd, 'public/translations/it/default.json');
  await json(sourceFile, { a: 'One' });
  await json(targetFile, { a: 'Uno' });
  for (const [file, relative] of [
    [targetFile, 'public/translations/it/default.json'],
    [sourceFile, 'public/translations/en/default.json'],
  ]) {
    await fs.writeFile(file, '{"private-catalog-content": broken');
    await assert.rejects(
      () => loadLocalePairs({ cwd, locales: ['it'], keys: ['a'] }),
      (error) => {
        assert.equal(error.message, `Unable to read valid JSON input: ${relative}`);
        assert.ok(!error.message.includes('private-catalog-content'));
        return true;
      },
    );
    await json(file, { a: 'Restored' });
  }
});

test('both CLIs report bounded malformed pair or corpus paths and redact the API token', async (t) => {
  const cwd = await temporary(t);
  const token = 'fixture-diagnostic-secret';
  const relative = path.join('a'.repeat(100), 'b'.repeat(100), token, 'broken.json');
  const file = path.join(cwd, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, '{"private-pair-content": broken');
  for (const [script, option] of [
    ['translations.mjs', '--pairs'],
    ['translations-eval.mjs', '--corpus'],
  ]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../${script}`, import.meta.url)), option, relative], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, TYPESAFE_API_KEY: ` ${token} ` },
    });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Unable to read valid JSON input: \.\.\..*\[redacted\]\/broken\.json/);
    assert.ok(!result.stderr.includes(token));
    assert.ok(!result.stderr.includes('private-pair-content'));
    assert.ok(result.stderr.trim().length <= 'Unable to read valid JSON input: '.length + 180);
  }
});

test('Git base includes only changed keys plus English changes across selected locales', async (t) => {
  const cwd = await temporary(t);
  for (const [locale, value] of Object.entries({
    en: { a: 'One', b: 'Two', c: 'Three' },
    it: { a: 'Uno', b: 'Due', c: 'Tre' },
    fr: { a: 'Un', b: 'Deux', c: 'Trois' },
  })) {
    await json(path.join(cwd, `public/translations/${locale}/default.json`), value);
  }
  runGit(cwd, ['init', '-q']);
  runGit(cwd, ['add', 'public']);
  runGit(cwd, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
  await json(path.join(cwd, 'public/translations/en/default.json'), { a: 'Changed', b: 'Two', c: 'Three' });
  await json(path.join(cwd, 'public/translations/it/default.json'), { a: 'Uno', b: 'DUE', c: 'Tre' });
  const pairs = await loadLocalePairs({ cwd, locales: ['it', 'fr'], base: 'HEAD' });
  assert.deepEqual(
    pairs.map(({ locale, key }) => `${locale}:${key}`),
    ['it:a', 'it:b', 'fr:a'],
  );
  const narrowed = await loadLocalePairs({ cwd, locales: ['it', 'fr'], keys: ['b'], base: 'HEAD' });
  assert.deepEqual(
    narrowed.map(({ locale, key }) => `${locale}:${key}`),
    ['it:b'],
  );
  await json(path.join(cwd, 'public/translations/es/default.json'), { a: 'Uno', b: 'Dos', c: 'Tres' });
  const added = await loadLocalePairs({ cwd, locales: ['es'], base: 'HEAD' });
  assert.equal(added.length, 3);
});

test('explicit changed-file lists and configurable locale root select only that file', async (t) => {
  const cwd = await temporary(t);
  await json(path.join(cwd, 'about/public/translations/en/default.json'), { a: 'One' });
  await json(path.join(cwd, 'about/public/translations/it/default.json'), { a: 'Uno' });
  await json(path.join(cwd, 'about/public/translations/fr/default.json'), { a: 'Un' });
  runGit(cwd, ['init', '-q']);
  runGit(cwd, ['add', 'about']);
  runGit(cwd, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
  const pairs = await loadLocalePairs({
    cwd,
    translationsRoot: 'about/public/translations',
    locales: ['it', 'fr'],
    changedFiles: ['about/public/translations/fr/default.json'],
  });
  assert.deepEqual(
    pairs.map(({ locale, key }) => `${locale}:${key}`),
    ['fr:a'],
  );
});

test('paragraph input supports paths and excludes labels/unrelated text', async (t) => {
  const file = path.join(await temporary(t), 'pairs.json');
  await json(file, [{ ...goodPair, expected: 'pass', path: 'docs/it/keys.md', private: 'exclude-me' }]);
  const pairs = await loadParagraphPairs(file);
  assert.equal(pairs[0].path, 'docs/it/keys.md');
  assert.ok(!own(pairs[0], 'expected'));
  assert.ok(!own(pairs[0], 'private'));
  await assert.rejects(() => loadParagraphPairs(file, { locales: ['xx'] }), /No translation pairs/);
  await json(file, [goodPair, goodPair]);
  await assert.rejects(() => loadParagraphPairs(file), /Duplicate/);
});

test('zero selected pairs is unverified rather than successful empty coverage', async (t) => {
  await assert.rejects(() => reviewTranslations([]), /No translation pairs/);
  const cwd = await temporary(t);
  await json(path.join(cwd, 'public/translations/en/default.json'), { a: 'One' });
  await json(path.join(cwd, 'public/translations/it/default.json'), { a: 'Uno' });
  runGit(cwd, ['init', '-q']);
  runGit(cwd, ['add', 'public']);
  runGit(cwd, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
  await assert.rejects(() => loadLocalePairs({ cwd, locales: ['it'], base: 'HEAD' }), /No translation pairs/);
});

test('pilot includes multilingual good/corrupt pairs, structural cases and semantic reversals with matching placeholders', async () => {
  const file = fileURLToPath(new URL('../fixtures/translations.json', import.meta.url));
  const corpus = JSON.parse(await fs.readFile(file, 'utf8')).pairs;
  assert.equal(new Set(corpus.map((pair) => pair.locale)).size, 6);
  for (const pair of corpus) {
    assert.ok(['pass', 'flagged'].includes(pair.expected));
    if (pair.category === 'structural') assert.ok(structuralIssues(pair).length > 0);
    else assert.deepEqual(structuralIssues(pair), [], pair.key);
  }
  assert.equal(corpus.find((pair) => pair.key === 'fr-placeholder-bad').expected, 'flagged');
});

test('evaluation reports false alarms, misses and unverified without hiding unknowns', () => {
  const labels = [
    { key: 'a', locale: 'it', expected: 'flagged' },
    { key: 'b', locale: 'it', expected: 'flagged' },
    { key: 'c', locale: 'it', expected: 'pass' },
  ];
  const metrics = evaluationMetrics(labels, [
    { key: 'a', locale: 'it', status: 'flagged' },
    { key: 'c', locale: 'it', status: 'flagged' },
  ]);
  assert.equal(metrics.recall, 0.5);
  assert.equal(metrics.falseAlarmRate, 1);
  assert.equal(metrics.unverified, 1);
  assert.equal(metrics.unverifiedIssues, 1);
});
