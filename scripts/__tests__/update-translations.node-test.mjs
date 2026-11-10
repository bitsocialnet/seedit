import assert from 'node:assert/strict';
import { execFile, fork } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const updater = fileURLToPath(new URL('../update-translations.js', import.meta.url));
const original = { keep: 'Café 🦉', obsolete: 'old' };

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'translation-writer-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const translations = path.join(root, 'public', 'translations');
  const localePath = (lang) => path.join(translations, lang, 'default.json');
  for (const lang of ['en', 'fr']) {
    await fs.mkdir(path.dirname(localePath(lang)), { recursive: true });
    await fs.writeFile(localePath(lang), JSON.stringify(original, null, 2) + '\n');
  }
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'src', 'main.ts'), "t('keep')\n");
  return { root, translations, localePath, lockPath: path.join(translations, '.update-translations.lock') };
}

async function run(f, args) {
  try {
    const result = await execute(process.execPath, [updater, ...args], { cwd: f.root, timeout: 5000 });
    return { ...result, code: 0 };
  } catch (err) {
    return { stdout: err.stdout, stderr: err.stderr, code: err.code };
  }
}

async function snapshot(dir) {
  const result = {};
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    result[entry.name] = entry.isDirectory() ? await snapshot(entryPath) : await fs.readFile(entryPath, 'utf8');
  }
  return result;
}

async function assertUnlocked(f) {
  await assert.rejects(fs.access(f.lockPath), { code: 'ENOENT' });
  for (const lang of ['en', 'fr']) {
    assert.deepEqual(await fs.readdir(path.dirname(f.localePath(lang))), ['default.json']);
  }
}

async function pauseWriterBeforeRead(f, args) {
  // Pause at an actual file read, after lock acquisition, without timing races or production test flags.
  const gate = path.join(f.root, 'pause-read.mjs');
  await fs.writeFile(
    gate,
    `
    import fs from 'node:fs/promises'
    import path from 'node:path'
    import { once } from 'node:events'
    const readFile = fs.readFile
    let paused = false
    fs.readFile = async (...args) => {
      if (!paused && path.basename(String(args[0])) === 'default.json') {
        paused = true
        process.send('before-read')
        await once(process, 'message')
      }
      return readFile(...args)
    }
  `,
  );
  const child = fork(updater, args, {
    cwd: f.root,
    execArgv: ['--import', pathToFileURL(gate).href],
    silent: true,
  });
  child.stdout.resume();
  let stderr = '';
  child.stderr.on('data', (data) => {
    stderr += data;
  });
  const result = once(child, 'close').then(([code]) => ({ code, stderr }));
  await Promise.race([
    once(child, 'message'),
    result.then((output) => {
      throw new Error(`Writer exited before reading: ${JSON.stringify(output)}`);
    }),
  ]);
  return { child, result };
}

test('overlapping update, delete, and audit writers are rejected without losing updates', { timeout: 15000 }, async (t) => {
  const f = await fixture(t);
  const first = await pauseWriterBeforeRead(f, ['--key', 'first', '--value', 'premier', '--include-en', '--write']);
  try {
    const before = await snapshot(f.translations);
    const contenders = [
      ['--key', 'second', '--value', 'deuxième', '--include-en', '--write'],
      ['--key', 'obsolete', '--delete', '--write'],
      ['--audit', '--write'],
    ];
    for (const args of contenders) {
      const result = await run(f, args);
      assert.equal(result.code, 1);
      assert.ok(result.stderr.includes(f.lockPath), result.stderr);
      assert.match(result.stderr, /No files were written/);
      assert.deepEqual(await snapshot(f.translations), before);
    }

    first.child.send('continue');
    assert.deepEqual(await first.result, { code: 0, stderr: '' });
    assert.equal((await run(f, contenders[0])).code, 0);
    for (const lang of ['en', 'fr']) {
      assert.deepEqual(JSON.parse(await fs.readFile(f.localePath(lang), 'utf8')), {
        ...original,
        first: 'premier',
        second: 'deuxième',
      });
    }
    await assertUnlocked(f);
  } finally {
    first.child.kill();
    await first.result;
  }
});

test('all dry-run modes leave files unchanged and work with an existing writer lock', async (t) => {
  const f = await fixture(t);
  const modes = [['--key', 'keep', '--value', 'changed', '--include-en'], ['--key', 'obsolete', '--delete'], ['--audit']];
  const before = await snapshot(f.translations);
  for (const args of modes) {
    assert.equal((await run(f, args)).code, 0);
    assert.deepEqual(await snapshot(f.translations), before);
  }
  await fs.writeFile(f.lockPath, 'another writer');
  const locked = await snapshot(f.translations);
  for (const args of modes) {
    for (const dry of ['--dry', '--dry-run']) {
      assert.equal((await run(f, [...args, '--write', dry])).code, 0);
      assert.deepEqual(await snapshot(f.translations), locked);
    }
  }
});

test('update, delete, and audit preserve unrelated keys and UTF-8 formatting', async (t) => {
  const f = await fixture(t);
  const map = path.join(f.root, 'map.json');
  await fs.writeFile(map, JSON.stringify({ en: 'Welcome', fr: 'Bienvenue à tous 🦉' }));
  assert.equal((await run(f, ['--key', 'greeting', '--map', map, '--include-en', '--write'])).code, 0);
  assert.equal(await fs.readFile(f.localePath('fr'), 'utf8'), JSON.stringify({ ...original, greeting: 'Bienvenue à tous 🦉' }, null, 2) + '\n');
  await assertUnlocked(f);
  assert.equal((await run(f, ['--key', 'obsolete', '--delete', '--write'])).code, 0);
  assert.deepEqual(JSON.parse(await fs.readFile(f.localePath('fr'), 'utf8')), { keep: original.keep, greeting: 'Bienvenue à tous 🦉' });
  await assertUnlocked(f);
  assert.equal((await run(f, ['--audit', '--write'])).code, 0);
  for (const lang of ['en', 'fr']) {
    assert.equal(await fs.readFile(f.localePath(lang), 'utf8'), JSON.stringify({ keep: original.keep }, null, 2) + '\n');
  }
  await assertUnlocked(f);
});

test('validation and read errors release the writer lock', async (t) => {
  const f = await fixture(t);
  for (const args of [['--write'], ['--key', 'missing', '--write'], ['--key', 'keep', '--map', 'missing.json', '--write']]) {
    assert.equal((await run(f, args)).code, 1);
    await assertUnlocked(f);
  }

  await fs.writeFile(f.localePath('fr'), '{invalid');
  const malformed = await run(f, ['--key', 'keep', '--delete', '--write']);
  assert.equal(malformed.code, 1);
  assert.match(malformed.stderr, /Failed to parse JSON/);
  assert.equal(await fs.readFile(f.localePath('fr'), 'utf8'), '{invalid');
  await assertUnlocked(f);

  await fs.writeFile(path.join(f.root, 'src', 'main.ts'), 't(dynamicKey)\n');
  assert.equal((await run(f, ['--audit', '--write'])).code, 1);
  await assertUnlocked(f);

  await fs.unlink(f.localePath('en'));
  const missingEnglish = await run(f, ['--audit', '--write']);
  assert.equal(missingEnglish.code, 1);
  assert.match(missingEnglish.stderr, /English translation file not found/);
  await assert.rejects(fs.access(f.lockPath), { code: 'ENOENT' });
});

test('cleanup leaves a replacement lock owned by another process untouched', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  const first = await pauseWriterBeforeRead(f, ['--key', 'keep', '--value', 'updated', '--write']);
  try {
    await fs.unlink(f.lockPath);
    await fs.writeFile(f.lockPath, 'replacement owner');
    first.child.send('continue');
    assert.deepEqual(await first.result, { code: 0, stderr: '' });
    assert.equal(await fs.readFile(f.lockPath, 'utf8'), 'replacement owner');
  } finally {
    first.child.kill();
    await first.result;
  }
});

test('a writer stopped by a signal writes nothing further and releases the lock', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  const before = await snapshot(f.translations);
  const writer = await pauseWriterBeforeRead(f, ['--key', 'keep', '--value', 'changed', '--include-en', '--write']);
  writer.child.kill('SIGTERM');
  writer.child.send('continue', () => {});
  const { code, stderr } = await writer.result;
  assert.equal(code, 143);
  assert.match(stderr, /Interrupted by SIGTERM/);
  assert.deepEqual(await snapshot(f.translations), before);
  await assertUnlocked(f);
});

test('a failed atomic replacement preserves the original file and releases the lock', async (t) => {
  const f = await fixture(t);
  const before = await snapshot(f.translations);
  const failRename = path.join(f.root, 'fail-rename.mjs');
  await fs.writeFile(
    failRename,
    `
    import fs from 'node:fs/promises'
    fs.rename = async () => { throw new Error('Simulated replacement failure') }
  `,
  );
  await assert.rejects(
    execute(process.execPath, ['--import', pathToFileURL(failRename).href, updater, '--key', 'keep', '--value', 'changed', '--include-en', '--write'], {
      cwd: f.root,
      timeout: 5000,
    }),
    (err) => err.code === 1 && /Simulated replacement failure/.test(err.stderr),
  );
  assert.deepEqual(await snapshot(f.translations), before);
  await assertUnlocked(f);
});
