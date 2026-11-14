import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { editedPaths, formatEditedFiles, formattingPaths } from '../agent-hooks/format.mjs';

function fixture(t) {
  const temporary = realpathSync(mkdtempSync(path.join(tmpdir(), 'agent-hooks-test-')));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'repo');
  mkdirSync(root);
  const write = (name, content = 'const value=1;') => {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
    return file;
  };
  return { temporary, root, write };
}

test('normalizes Claude edits, including paths with shell metacharacters', () => {
  const file_path = 'src/a $(touch sentinel).tsx';
  assert.deepEqual(editedPaths({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path } }), [file_path]);
});

test('Codex patch fixtures include additions, updates, and move destinations, excluding deletions and diff text', () => {
  const command = `*** Begin Patch
*** Add File: src/new.ts
+const value=1;
+*** Add File: not-a-path.ts
*** Update File: src/update.ts
@@
-const old=1;
+const old=2;
*** Update File: src/old.ts
*** Move to: src/renamed.ts
@@
-const old=1;
+const old=2;
*** Delete File: src/deleted.ts
*** End Patch`;
  assert.deepEqual(editedPaths({ tool_name: 'apply_patch', tool_input: { command } }), ['src/new.ts', 'src/update.ts', 'src/renamed.ts']);
});

test('read-only, failed, malformed, and irrelevant invocations do no work', (t) => {
  const { root, write } = fixture(t);
  write('node_modules/oxfmt/package.json', '{}');
  write('file.ts');
  const payloads = [
    undefined,
    null,
    {},
    { tool_name: 'Read', tool_input: { file_path: 'file.ts' } },
    { tool_name: 'exec_command', tool_input: { command: '*** Begin Patch\n*** Add File: file.ts\n*** End Patch' } },
    { hook_event_name: 'Stop', file_path: 'file.ts' },
    { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'file.ts' } },
    { tool_name: 'Edit', tool_input: { file_path: 'file.ts' }, tool_response: { isError: true } },
    { tool_name: 'Write', tool_input: { file_path: 'file.ts' }, tool_response: { success: false } },
    { tool_name: 'apply_patch', tool_input: { command: 'echo file.ts' } },
    { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Add File: file.ts' } },
    { file_path: ['file.ts'] },
    { file_path: 'README.md' },
  ];
  for (const payload of payloads) {
    formatEditedFiles(payload, root, () => assert.fail(`Unexpected formatter invocation: ${JSON.stringify(payload)}`));
  }
});

test('contains paths within the repo, checking final symlinks and symlinked directories', (t) => {
  const { temporary, root, write } = fixture(t);
  const local = write('src/local.ts');
  const outside = path.join(temporary, 'outside.ts');
  writeFileSync(outside, 'const outside=1;');
  symlinkSync(outside, path.join(root, 'outside-link.ts'));
  symlinkSync(temporary, path.join(root, 'outside-directory'));
  symlinkSync(local, path.join(root, 'inside-link.ts'));
  mkdirSync(path.join(root, 'directory.ts'));

  for (const file_path of ['../outside.ts', outside, 'outside-link.ts', 'outside-directory/outside.ts', 'missing.ts', 'directory.ts', 'bad\0.ts']) {
    assert.deepEqual(formattingPaths({ file_path }, root), [], file_path);
  }
  assert.deepEqual(formattingPaths({ file_path: local }, root), [local]);
  assert.deepEqual(formattingPaths({ file_path: 'inside-link.ts' }, root), [local]);
});

test('relative edits use the tool working directory while retaining repository containment', (t) => {
  const { temporary, root, write } = fixture(t);
  const local = write('scripts/example.mjs');
  write('example.mjs');
  const payload = { cwd: path.join(root, 'scripts'), tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: example.mjs\n*** End Patch' } };
  assert.deepEqual(formattingPaths(payload, root), [local]);
  assert.deepEqual(formattingPaths({ ...payload, cwd: temporary }, root), []);
});

test('formats each existing edited file once through installed Corepack Yarn with network disabled', (t) => {
  const { root, write } = fixture(t);
  write('node_modules/oxfmt/package.json', '{}');
  const first = write('src/a $(touch sentinel).tsx');
  const second = write('src/second.mjs');
  const command = `*** Begin Patch\n*** Update File: ${first}\n*** Update File: ${first}\n*** Add File: ${second}\n*** Delete File: removed.ts\n*** End Patch`;
  let invocations = 0;
  formatEditedFiles({ tool_name: 'apply_patch', tool_input: { command } }, root, (executable, args, options) => {
    invocations += 1;
    assert.equal(executable, 'corepack');
    assert.deepEqual(args, ['yarn', 'exec', 'oxfmt', '--write', first, second]);
    assert.equal(options.cwd, root);
    assert.equal(options.env.COREPACK_ENABLE_NETWORK, '0');
    assert.equal(options.shell, undefined);
    return { status: 0 };
  });
  assert.equal(invocations, 1);
});

test('missing formatter dependencies skip work without installing anything', (t) => {
  const { root, write } = fixture(t);
  write('file.ts');
  formatEditedFiles({ file_path: 'file.ts' }, root, () => assert.fail('Must not bootstrap dependencies'));
});

test('formatter failures are reported without blocking the edit', (t) => {
  const { root, write } = fixture(t);
  write('file.ts');
  write('node_modules/oxfmt/package.json', '{}');
  const errors = [];
  t.mock.method(console, 'error', (message) => errors.push(message));
  assert.doesNotThrow(() => formatEditedFiles({ file_path: 'file.ts' }, root, () => ({ status: 1, stderr: 'invalid syntax' })));
  assert.match(errors.join('\n'), /Formatting failed: invalid syntax/);
});

test('CLI ignores invalid JSON and read-only hook input', () => {
  const script = fileURLToPath(new URL('../agent-hooks/format.mjs', import.meta.url));
  for (const input of ['{bad json', JSON.stringify({ hook_event_name: 'Stop' })]) {
    const result = spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  }
});

function initFixture(t) {
  const { temporary, root } = fixture(t);
  const bin = path.join(temporary, 'bin');
  const curlLog = path.join(temporary, 'curl.log');
  const yarnLog = path.join(temporary, 'yarn.log');
  mkdirSync(bin);
  const commands = {
    git: 'case "$1" in branch) printf "%s\\n" "$MOCK_BRANCH" ;; rev-parse) printf "%s\\n" "$MOCK_REPO_ROOT" ;; *) exit 1 ;; esac',
    curl: 'printf "%s\\n" "$@" > "$CURL_LOG"; exit "$CURL_EXIT"',
    yarn: 'printf "unexpected server start" > "$YARN_LOG"; exit 91',
  };
  for (const [name, command] of Object.entries(commands)) writeFileSync(path.join(bin, name), `#!/bin/sh\n${command}\n`, { mode: 0o755 });
  const script = fileURLToPath(new URL('../agent-init.sh', import.meta.url));
  const run = (overrides = {}) =>
    spawnSync('bash', [script], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        MOCK_BRANCH: 'master',
        MOCK_REPO_ROOT: root,
        CURL_LOG: curlLog,
        YARN_LOG: yarnLog,
        CURL_EXIT: '0',
        AGENT_APP_URL: '',
        PORTLESS: '',
        PORT: '',
        ...overrides,
      },
    });
  return { root, curlLog, yarnLog, run };
}

test('agent-init checks the canonical or branch-scoped Seedit server without starting one', (t) => {
  const { root, curlLog, yarnLog, run } = initFixture(t);
  assert.equal(run().status, 0);
  assert.match(readFileSync(curlLog, 'utf8'), /https:\/\/seedit\.localhost/);
  assert.equal(run({ MOCK_BRANCH: 'codex/fix/example' }).status, 0);
  assert.match(readFileSync(curlLog, 'utf8'), /https:\/\/codex-fix-example\.seedit\.localhost/);
  assert.equal(existsSync(yarnLog), false);
  assert.equal(existsSync(path.join(root, '.playwright-cli')), false);
});

test('agent-init respects the direct PORT fallback and explicit app URL', (t) => {
  const { curlLog, run } = initFixture(t);
  assert.equal(run({ PORTLESS: '0', PORT: '4321' }).status, 0);
  assert.match(readFileSync(curlLog, 'utf8'), /http:\/\/localhost:4321/);
  assert.equal(run({ AGENT_APP_URL: 'https://existing.seedit.localhost' }).status, 0);
  assert.match(readFileSync(curlLog, 'utf8'), /https:\/\/existing\.seedit\.localhost/);
});

test('agent-init fails promptly for an unavailable server without launching background work', (t) => {
  const { root, curlLog, yarnLog, run } = initFixture(t);
  const result = run({ CURL_EXIT: '7' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Start yarn start in an owned terminal/);
  assert.match(readFileSync(curlLog, 'utf8'), /--max-time\n10\n/);
  assert.equal(existsSync(yarnLog), false);
  assert.equal(existsSync(path.join(root, '.playwright-cli')), false);
});
