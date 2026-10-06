import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run, loadInput, imageMetadata, LIMITS, parseArgs } from '../check.mjs';
import { ENDPOINT, MODEL, makeRequest, parseDecision, resolveSettings, readLocalFile } from '../decisions.mjs';

const KEY = 'sk-visual-qa-fake-fixture-key-123456';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=', 'base64');
const checks = [{ id: 'heading', criterion: 'A page heading is visible.' }];
const env = { OPENAI_API_KEY: KEY };

function fixture(t) {
  const directory = mkdtempSync(path.join(realpathSync(tmpdir()), 'visual-qa-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const image = path.join(directory, 'screen.png');
  const input = path.join(directory, 'input.json');
  const manifest = { version: 1, screenshot: 'screen.png', checks };
  writeFileSync(image, png);
  writeFileSync(input, JSON.stringify(manifest));
  return { directory, input, image, manifest };
}
const answer = (id = 'heading', choice = 'satisfies', confidence = 0.98) => ({
  type: 'choice',
  name: id,
  choice,
  confidence,
  probabilities: ['satisfies', 'issue', 'uncertain'].map((value) => ({ value, probability: value === choice ? 0.98 : 0.01 })),
});
const data = (answers = [answer()]) => ({ model: MODEL, answers, usage: { input_tokens: 200, output_tokens: 0, total_tokens: 200 } });
const success = async () => Response.json(data());

test('offline validates provenance without touching credentials, config or network', async (t) => {
  const f = fixture(t);
  const outcome = await run(
    { input: f.input },
    {
      env: new Proxy(
        {},
        {
          get() {
            throw new Error('credential access forbidden');
          },
        },
      ),
      home: '/missing',
      fetchImpl() {
        throw new Error('network forbidden');
      },
    },
  );
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.report.status, 'offline_validated');
  assert.equal(outcome.report.networkCalls, 0);
  assert.equal(outcome.report.advisory, true);
  assert.match(outcome.report.input.screenshotSha256, /^[a-f0-9]{64}$/u);
  assert.equal(outcome.report.input.bytes, png.length);
  assert.equal(outcome.report.estimatedInputCostUsd, null);
});

test('CLI defaults offline and rejects malformed or duplicate flags without raw errors', (t) => {
  const f = fixture(t);
  const executable = fileURLToPath(new URL('../check.mjs', import.meta.url));
  const out = spawnSync(process.execPath, [executable, '--input', f.input], { encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY_FILE: '/missing' } });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(JSON.parse(out.stdout).status, 'offline_validated');
  assert.deepEqual(parseArgs(['--input', f.input, '--live', '--provider', 'openai-decisions']), { input: f.input, live: true, provider: 'openai-decisions' });
  for (const args of [[], ['--input'], ['--live', '--live'], ['--token', KEY], ['--input', 'a', '--input', 'b']]) assert.throws(() => parseArgs(args));
});

test('live sends exactly the captured image with independent rubric, fixed endpoint and no redirects', async (t) => {
  const f = fixture(t);
  let calls = 0;
  const outcome = await run(
    { input: f.input, live: true },
    {
      env,
      fetchImpl: async (url, init) => {
        calls++;
        assert.equal(url, ENDPOINT);
        assert.equal(init.redirect, 'error');
        assert.equal(init.method, 'POST');
        assert.equal(init.headers.Authorization, `Bearer ${KEY}`);
        const body = JSON.parse(init.body);
        assert.equal(body.model, MODEL);
        assert.deepEqual(body.input[0].content[1], { type: 'input_image', image_url: `data:image/png;base64,${png.toString('base64')}`, detail: 'original' });
        assert.match(body.questions[0].instructions, /untrusted evidence/u);
        assert.match(body.questions[0].instructions, /page heading/u);
        return Response.json(data());
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.report.status, 'advisory_satisfies');
  assert.equal(outcome.report.networkCalls, 1);
  assert.equal(outcome.report.usage.input_tokens, 200);
  assert.equal(outcome.report.estimatedInputCostUsd, 0.00002);
  const serialized = JSON.stringify(outcome.report);
  for (const hidden of [KEY, png.toString('base64'), f.directory]) assert.equal(serialized.includes(hidden), false);
});

test('uncertain, low probability, low confidence, issue and refusal all require review', async (t) => {
  const f = fixture(t);
  const lowProbability = answer();
  lowProbability.probabilities = [
    { value: 'satisfies', probability: 0.7 },
    { value: 'issue', probability: 0.2 },
    { value: 'uncertain', probability: 0.1 },
  ];
  for (const value of [
    answer('heading', 'uncertain'),
    answer('heading', 'issue'),
    answer('heading', 'satisfies', 0.8),
    lowProbability,
    { type: 'refusal', name: 'heading' },
  ]) {
    const outcome = await run({ input: f.input, live: true }, { env, fetchImpl: async () => Response.json(data([value])) });
    assert.equal(outcome.exitCode, 2);
    assert.equal(outcome.report.status, 'needs_review');
  }
});

test('one call can retain a refusal alongside a valid independent answer', () => {
  const result = parseDecision(data([answer(), { type: 'refusal', name: 'footer' }]), [...checks, { id: 'footer' }]);
  assert.equal(result.results[0].status, 'satisfies');
  assert.deepEqual(result.results[1], { id: 'footer', status: 'unavailable', reason: 'provider_refusal' });
});

test('missing or malformed usage stays unknown rather than becoming zero cost', () => {
  for (const usage of [undefined, {}, { input_tokens: -1 }, { input_tokens: 1.5 }, { input_tokens: '200' }]) {
    const result = parseDecision({ ...data(), usage }, checks);
    assert.equal(result.estimatedInputCostUsd, null);
    assert.equal(result.usage.input_tokens, undefined);
  }
});

test('strict validation rejects wrong model, answer order, choices and inconsistent probabilities', () => {
  const cases = [
    { ...data(), model: 'gpt-unpinned' },
    { ...data(), answers: [] },
    { ...data(), answers: {} },
    data([answer('other')]),
    data([answer('heading', 'unknown')]),
    data([{ ...answer(), type: 'predicate' }]),
    data([{ ...answer(), confidence: 2 }]),
    data([{ ...answer(), confidence: NaN }]),
    data([{ ...answer(), probabilities: [{ value: 'satisfies', probability: 1 }] }]),
    data([
      {
        ...answer(),
        probabilities: [
          { value: 'satisfies', probability: 1 },
          { value: 'satisfies', probability: 0 },
          { value: 'uncertain', probability: 0 },
        ],
      },
    ]),
    data([
      {
        ...answer(),
        probabilities: [
          { value: 'satisfies', probability: 0.7 },
          { value: 'issue', probability: 0.8 },
          { value: 'uncertain', probability: 0.1 },
        ],
      },
    ]),
    data([{ ...answer(), choice: 'issue' }]),
    data([{ type: 'refusal', name: 'other' }]),
  ];
  for (const value of cases) assert.throws(() => parseDecision(value, checks), { code: 'invalid_response' });
  assert.throws(() => parseDecision(data([answer('footer'), answer()]), [...checks, { id: 'footer' }]), { code: 'invalid_response' });
});

test('network, HTTP, redirect, invalid JSON and oversized responses fail once without leaking bodies', async (t) => {
  const f = fixture(t);
  const attempts = [
    async () => {
      throw new Error(`request ${KEY}`);
    },
    async () => new Response(KEY, { status: 429 }),
    async () => new Response(KEY, { status: 302, headers: { Location: 'https://untrusted.example' } }),
    async () => ({ redirected: true, ok: true }),
    async () => new Response(KEY),
    async () => new Response('x'.repeat(128_001)),
    async () => Response.json({ ...data(), model: KEY }),
  ];
  for (const fetcher of attempts) {
    let calls = 0;
    const outcome = await run(
      { input: f.input, live: true },
      {
        env,
        fetchImpl: (...args) => {
          calls++;
          return fetcher(...args);
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(outcome.exitCode, 2);
    assert.equal(outcome.report.status, 'unavailable');
    assert.deepEqual(outcome.report.results, []);
    assert.equal(JSON.stringify(outcome.report).includes(KEY), false);
  }
});

test('deadline aborts even an uncooperative fetch without a retry', async (t) => {
  const f = fixture(t);
  let signal,
    calls = 0;
  const outcome = await run(
    { input: f.input, live: true },
    {
      env,
      timeoutMs: 10,
      fetchImpl: (_, init) => {
        calls++;
        signal = init.signal;
        return new Promise(() => {});
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(signal.aborted, true);
  assert.equal(outcome.report.reason, 'deadline_exceeded');
  assert.equal(outcome.exitCode, 2);
});

test('deadline also covers a stalled response stream', async (t) => {
  const f = fixture(t);
  const outcome = await run({ input: f.input, live: true }, { env, timeoutMs: 10, fetchImpl: async () => new Response(new ReadableStream({ start() {} })) });
  assert.equal(outcome.report.reason, 'deadline_exceeded');
  assert.equal(outcome.exitCode, 2);
});

test('screenshots or manifests changed during inference invalidate advisory results and retain known usage', async (t) => {
  const f = fixture(t);
  for (const target of ['image', 'input']) {
    writeFileSync(f.image, png);
    writeFileSync(f.input, JSON.stringify(f.manifest));
    const outcome = await run(
      { input: f.input, live: true },
      {
        env,
        fetchImpl: async () => {
          writeFileSync(f[target], target === 'image' ? Buffer.concat([png, Buffer.from('changed')]) : '{}');
          return Response.json(data());
        },
      },
    );
    assert.equal(outcome.report.reason, 'input_changed');
    assert.equal(outcome.exitCode, 2);
    assert.deepEqual(outcome.report.results, []);
    assert.equal(outcome.report.usage.input_tokens, 200);
  }
});

test('input change during credential resolution fails before sending the captured image', async (t) => {
  const f = fixture(t);
  const changeEnv = {
    get OPENAI_API_KEY() {
      writeFileSync(f.image, Buffer.concat([png, Buffer.from('changed')]));
      return KEY;
    },
  };
  const outcome = await run({ input: f.input, live: true }, { env: changeEnv, fetchImpl: success });
  assert.equal(outcome.report.reason, 'input_changed');
  assert.equal(outcome.report.networkCalls, 0);
});

test('unsafe screenshot paths, unknown fields and malformed checks are rejected offline', async (t) => {
  const f = fixture(t);
  const variants = [
    ...[
      '../screen.png',
      '/screen.png',
      'a/../screen.png',
      'a//screen.png',
      './screen.png',
      'a\\screen.png',
      'https://example.com/a.png',
      '.env',
      'Vault/screen.png',
      '.git/screen.png',
    ].map((screenshot) => ({ ...f.manifest, screenshot })),
    { ...f.manifest, endpoint: 'https://evil.example' },
    { ...f.manifest, version: 2 },
    { ...f.manifest, checks: [] },
    { ...f.manifest, checks: Array(9).fill(checks[0]) },
    { ...f.manifest, checks: [checks[0], checks[0]] },
    { ...f.manifest, checks: [{ criterion: 'missing id' }] },
    { ...f.manifest, checks: [{ ...checks[0], instructions: 'extra' }] },
    { ...f.manifest, checks: [{ ...checks[0], criterion: 'x'.repeat(1501) }] },
    { ...f.manifest, context: 'x'.repeat(2001) },
  ];
  for (const manifest of variants) {
    writeFileSync(f.input, JSON.stringify(manifest));
    const outcome = await run({ input: f.input });
    assert.equal(outcome.exitCode, 2, JSON.stringify(manifest));
    assert.equal(outcome.report.networkCalls, 0);
  }
});

test('symlink files, symlink ancestors and nonregular inputs are rejected', async (t) => {
  const f = fixture(t);
  symlinkSync(f.image, path.join(f.directory, 'link.png'));
  symlinkSync(f.directory, path.join(f.directory, 'alias'));
  for (const screenshot of ['link.png', 'alias/screen.png', 'directory.png']) {
    if (screenshot === 'directory.png') mkdirSync(path.join(f.directory, screenshot));
    writeFileSync(f.input, JSON.stringify({ ...f.manifest, screenshot }));
    assert.equal((await run({ input: f.input })).exitCode, 2);
  }
  symlinkSync(f.input, path.join(f.directory, 'link.json'));
  assert.throws(() => loadInput(path.join(f.directory, 'link.json')), { code: 'symlink_rejected' });
});

test('byte, pixel, dimension and image-format bounds are enforced before upload', (t) => {
  const f = fixture(t);
  writeFileSync(f.image, Buffer.alloc(LIMITS.screenshotBytes + 1));
  assert.throws(() => loadInput(f.input), { code: 'file_size_limit' });
  writeFileSync(f.image, png);
  writeFileSync(f.input, ' '.repeat(LIMITS.manifestBytes + 1));
  assert.throws(() => loadInput(f.input), { code: 'file_size_limit' });
  for (const [width, height] of [
    [0, 1],
    [4097, 1],
    [2001, 2000],
  ]) {
    const changed = Buffer.from(png);
    changed.writeUInt32BE(width, 16);
    changed.writeUInt32BE(height, 20);
    assert.throws(() => imageMetadata(changed, 'screen.png'), { code: 'image_dimensions_limit' });
  }
  for (const [bytes, filename] of [
    [png, 'screen.gif'],
    [png, 'screen.jpg'],
    [Buffer.from('not an image'), 'screen.png'],
    [png.subarray(0, 40), 'screen.png'],
  ])
    assert.throws(() => imageMetadata(bytes, filename));
});

test('JPEG dimensions and MIME are read without decoding or fetching another file', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 0, 2, 0, 3, 0, 0xff, 0xda, 0, 2, 0, 0xff, 0xd9]);
  assert.deepEqual(imageMetadata(jpeg, 'screen.jpeg'), { mime: 'image/jpeg', width: 3, height: 2 });
  assert.throws(() => imageMetadata(jpeg.subarray(0, -2), 'screen.jpg'), { code: 'invalid_image' });
});

test('private settings support labeled key files and precedence without exposing private content', (t) => {
  const f = fixture(t);
  const configDir = path.join(f.directory, '.config', 'bitsocial');
  mkdirSync(configDir, { recursive: true });
  const keyFile = path.join(f.directory, 'api.txt');
  const configFile = path.join(configDir, 'decisions.json');
  writeFileSync(keyFile, `OpenAI key:\n${KEY}\n`, { mode: 0o600 });
  writeFileSync(configFile, JSON.stringify({ apiKeyFile: keyFile, model: MODEL }), { mode: 0o600 });
  assert.deepEqual(resolveSettings({ env: {}, home: f.directory }), { apiKey: KEY, model: MODEL });
  writeFileSync(configFile, '{broken');
  assert.equal(resolveSettings({ env, home: f.directory }).apiKey, KEY);
  assert.equal(resolveSettings({ env: { OPENAI_API_KEY_FILE: keyFile }, home: f.directory }).apiKey, KEY);
  assert.throws(() => resolveSettings({ env: {}, home: f.directory }), { code: 'invalid_config' });
  chmodSync(keyFile, 0o644);
  assert.throws(() => resolveSettings({ env: { OPENAI_API_KEY_FILE: keyFile } }), { code: 'private_file_permissions' });
});

test('ambiguous, invalid, oversized and symlink credential files fail safely', (t) => {
  const f = fixture(t);
  const keyFile = path.join(f.directory, 'key.txt');
  for (const raw of ['', 'not-a-token', `${KEY}\nsk-other-fake-fixture-token-45678`, 'x'.repeat(16_385)]) {
    writeFileSync(keyFile, raw, { mode: 0o600 });
    assert.throws(
      () => resolveSettings({ env: { OPENAI_API_KEY_FILE: keyFile } }),
      (error) => !error.message.includes(KEY),
    );
  }
  symlinkSync(keyFile, path.join(f.directory, 'link.txt'));
  assert.throws(() => resolveSettings({ env: { OPENAI_API_KEY_FILE: path.join(f.directory, 'link.txt') } }), { code: 'symlink_rejected' });
  assert.throws(() => resolveSettings({ env: { OPENAI_API_KEY_FILE: 'relative.txt' } }), { code: 'invalid_api_key_file' });
  assert.throws(() => resolveSettings({ env: { OPENAI_API_KEY: `label: ${KEY}` } }), { code: 'invalid_api_key' });
  assert.throws(() => readLocalFile(keyFile, 1));
});

test('absolute XDG configuration overrides the home default and invalid overrides fail explicitly', (t) => {
  const f = fixture(t);
  const configRoot = path.join(f.directory, 'custom-config');
  const configDirectory = path.join(configRoot, 'bitsocial');
  mkdirSync(configDirectory, { recursive: true });
  const keyFile = path.join(f.directory, 'key.txt');
  writeFileSync(keyFile, KEY, { mode: 0o600 });
  writeFileSync(path.join(configDirectory, 'decisions.json'), JSON.stringify({ apiKeyFile: keyFile, model: MODEL }), { mode: 0o600 });
  assert.deepEqual(resolveSettings({ env: { XDG_CONFIG_HOME: configRoot }, home: '/unused' }), { model: MODEL, apiKey: KEY });
  for (const override of ['', 'relative', null, '/path\ninvalid']) {
    assert.throws(() => resolveSettings({ env: { XDG_CONFIG_HOME: override }, home: f.directory }), { code: 'invalid_config_path' });
  }
  // Runtime credentials do not depend on unrelated local configuration overrides.
  assert.equal(resolveSettings({ env: { ...env, XDG_CONFIG_HOME: '' }, home: f.directory }).apiKey, KEY);
  assert.equal(resolveSettings({ env: { OPENAI_API_KEY_FILE: keyFile, XDG_CONFIG_HOME: '' }, home: f.directory }).apiKey, KEY);
});

test('loaded credential in rubric or context is never uploaded or reported', async (t) => {
  const f = fixture(t);
  writeFileSync(f.input, JSON.stringify({ ...f.manifest, context: KEY }));
  const outcome = await run({ input: f.input, live: true }, { env, fetchImpl: success });
  assert.equal(outcome.report.networkCalls, 0);
  assert.equal(outcome.report.reason, 'secret_in_input');
  assert.equal(JSON.stringify(outcome.report).includes(KEY), false);
});

test('provider-independent input rejects undeveloped providers instead of silently falling back', async (t) => {
  const f = fixture(t);
  const outcome = await run({ input: f.input, live: true, provider: 'jev' }, { env, fetchImpl: success });
  assert.equal(outcome.report.reason, 'unsupported_provider');
  assert.equal(outcome.report.networkCalls, 0);
  const request = makeRequest(loadInput(f.input));
  assert.deepEqual(
    request.questions.map(({ name }) => name),
    ['heading'],
  );
});
