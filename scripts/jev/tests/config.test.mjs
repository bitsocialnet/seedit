import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveJevSettings, redactJevSecrets } from '../config.mjs';

function fixture(t) {
  const home = mkdtempSync(path.join(tmpdir(), 'jev-config-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const directory = path.join(home, '.config', 'bitsocial');
  mkdirSync(directory, { recursive: true });
  const keyFile = path.join(home, 'key.txt');
  writeFileSync(keyFile, ' file-fixture-key\n');
  const configFile = path.join(directory, 'jev.json');
  writeFileSync(configFile, JSON.stringify({ apiKeyFile: keyFile, model: 'jev-1.13.0' }));
  return { home, keyFile, configFile };
}
function cleanEnv(home) {
  const env = { ...process.env, XDG_CONFIG_HOME: path.join(home, '.config') };
  for (const key of ['TYPESAFE_API_KEY', 'TYPESAFE_API_KEY_FILE', 'JEV_MODEL', 'JEV_CONFIG_FILE']) delete env[key];
  return env;
}

test('one machine configuration supplies every checkout and redacts the file-backed key', (t) => {
  const { home } = fixture(t);
  assert.deepEqual(resolveJevSettings({ env: {}, home }), { apiKey: 'file-fixture-key', model: 'jev-1.13.0' });
  assert.equal(redactJevSecrets('path/file-fixture-key/plan.json'), 'path/[redacted]/plan.json');
});

test('explicit options then environment override local defaults; complete overrides ignore broken config', (t) => {
  const { home, configFile, keyFile } = fixture(t);
  const env = { TYPESAFE_API_KEY: 'environment-key', JEV_MODEL: 'jev-2.0.0', JEV_CONFIG_FILE: '/nonexistent' };
  assert.deepEqual(resolveJevSettings({ env, home }), { apiKey: 'environment-key', model: 'jev-2.0.0' });
  assert.deepEqual(resolveJevSettings({ env, home, apiKey: 'explicit-key', model: 'jev-3.0.0' }), { apiKey: 'explicit-key', model: 'jev-3.0.0' });
  writeFileSync(configFile, '{invalid');
  assert.deepEqual(resolveJevSettings({ env: { TYPESAFE_API_KEY_FILE: keyFile, JEV_MODEL: 'jev-2.0.0' }, home }), { apiKey: 'file-fixture-key', model: 'jev-2.0.0' });
});

test('explicit null settings are invalid and never select private defaults', (t) => {
  const { home } = fixture(t);
  for (const options of [{ apiKey: null }, { model: null }, { apiKey: null, model: null }]) {
    assert.throws(() => resolveJevSettings({ env: {}, home, ...options }));
    assert.throws(() => resolveJevSettings({ env: { TYPESAFE_API_KEY: 'environment-key', JEV_MODEL: 'jev-1.13.0' }, home, ...options }));
  }
});

test('XDG and explicit config paths are honored without repository-relative credential discovery', (t) => {
  const { home, configFile } = fixture(t);
  const result = resolveJevSettings({ env: { XDG_CONFIG_HOME: path.join(home, '.config') }, home: '/not-used' });
  assert.equal(result.apiKey, 'file-fixture-key');
  assert.equal(resolveJevSettings({ env: { JEV_CONFIG_FILE: configFile }, home: '/not-used' }).model, result.model);
  assert.throws(() => resolveJevSettings({ env: { JEV_CONFIG_FILE: 'relative.json' }, home }), { code: 'invalid_config_path' });
});

test('malformed, oversized, unreadable and unpinned config errors disclose no content', (t) => {
  const { home, configFile, keyFile } = fixture(t);
  for (const value of ['{private-content', 'x'.repeat(16_385), JSON.stringify({ apiKey: 'private-content' }), '[]']) {
    writeFileSync(configFile, value);
    assert.throws(
      () => resolveJevSettings({ env: {}, home }),
      (error) => !error.message.includes('private-content') && ['invalid_config', 'config_unreadable'].includes(error.code),
    );
  }
  assert.throws(() => resolveJevSettings({ env: { JEV_CONFIG_FILE: path.join(home, 'absent') }, home }), { code: 'config_unreadable' });
  assert.throws(() => resolveJevSettings({ apiKey: 'fixture', model: 'jev-latest', env: {}, home }), { code: 'pinned_model_required' });
  assert.throws(() => resolveJevSettings({ env: { TYPESAFE_API_KEY_FILE: 'relative.key', JEV_MODEL: 'jev-1.13.0' }, home }), { code: 'invalid_api_key_file' });
  for (const content of ['', 'key\nsecond-line', 'x'.repeat(16_385)]) {
    writeFileSync(keyFile, content);
    assert.throws(() => resolveJevSettings({ env: { TYPESAFE_API_KEY_FILE: keyFile, JEV_MODEL: 'jev-1.13.0' }, home }));
  }
});

test('CLI check is safe; a live client uses file credentials and fixed model without exporting secrets', (t) => {
  const { home, keyFile } = fixture(t);
  const env = cleanEnv(home);
  const configPath = fileURLToPath(new URL('../config.mjs', import.meta.url));
  const check = spawnSync(process.execPath, [configPath, '--check'], { env, cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.deepEqual(JSON.parse(check.stdout), { ready: true, model: 'jev-1.13.0', networkCalls: 0 });
  assert.equal(check.stdout.includes('file-fixture-key'), false);
  const clientUrl = pathToFileURL(fileURLToPath(new URL('../client.mjs', import.meta.url))).href;
  const run = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import { createJevClient } from ${JSON.stringify(clientUrl)};
    const client = createJevClient({live:true,fetchImpl:async (url, init) => {
      assert.equal(init.headers.Authorization, 'Bearer file-fixture-key');
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'jev-1.13.0');
      assert.equal(process.env.TYPESAFE_API_KEY, undefined);
      return Response.json({model:body.model, answers:{choice:{type:'choice',choice:'yes',confidence:1,probabilities:{yes:1,no:0}}}});
    }});
    assert.deepEqual(client.assertReady(), {model:'jev-1.13.0'});
    await client.ask({state:'public fixture',questions:{choice:{type:'choice',instructions:'Assess',criteria:{yes:'yes',no:'no'}}}});
    await assert.rejects(client.ask({state:'file-fixture-key',questions:{}}), {code:'invalid_questions'});
    await assert.rejects(client.ask({state:'file-fixture-key',questions:{choice:{type:'choice',instructions:'Assess',criteria:{yes:'yes',no:'no'}}}}), {code:'secret_in_input'});
  `,
    ],
    { env, cwd: tmpdir(), encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.includes('file-fixture-key'), false);
  assert.equal(run.stdout.includes(keyFile), false);
});

test('import and offline client never read invalid machine configuration', (t) => {
  const { home, configFile } = fixture(t);
  writeFileSync(configFile, '{invalid');
  const env = cleanEnv(home);
  const url = new URL('../client.mjs', import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import {createJevClient} from ${JSON.stringify(url)};
    const client = createJevClient({fetchImpl:() => {throw Error('network forbidden')}});
    assert.throws(() => client.assertReady(), {code:'live_not_enabled'});
  `,
    ],
    { env, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
});
