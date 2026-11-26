import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';

const utils = new URL('../local-server-utils.mjs', import.meta.url).href;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

// Portless cleans up its route on SIGINT and SIGTERM only, so a hangup reaches it as SIGTERM.
for (const [signal, serverSignal] of [
  ['SIGTERM', 'SIGTERM'],
  ['SIGINT', 'SIGINT'],
  ['SIGHUP', 'SIGTERM'],
]) {
  test(`${signal} sent only to the launcher also stops its server`, async (t) => {
    const root = mkdtempSync(path.join(tmpdir(), 'local-server-test-'));
    const pidFile = path.join(root, 'server.pid');
    const server = `const fs = require('fs'); fs.writeFileSync(${JSON.stringify(`${pidFile}.tmp`)}, String(process.pid)); fs.renameSync(${JSON.stringify(`${pidFile}.tmp`)}, ${JSON.stringify(pidFile)}); setInterval(() => {}, 1000);`;
    const launcher = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { spawn } from 'node:child_process';
import { forwardChildExit } from ${JSON.stringify(utils)};
forwardChildExit(spawn(process.execPath, ['-e', ${JSON.stringify(server)}], { stdio: 'inherit' }));`,
      ],
      { stdio: 'ignore' },
    );
    let serverPid;
    t.after(() => {
      launcher.kill('SIGKILL');
      if (serverPid && alive(serverPid)) process.kill(serverPid, 'SIGKILL');
      rmSync(root, { recursive: true, force: true });
    });
    for (let attempt = 0; !existsSync(pidFile); attempt += 1) {
      assert.ok(attempt < 500, 'the server never started');
      await setTimeout(10);
    }
    serverPid = Number(readFileSync(pidFile, 'utf8'));

    const exited = once(launcher, 'exit');
    launcher.kill(signal);
    const [, launcherSignal] = await exited;
    for (let attempt = 0; alive(serverPid) && attempt < 100; attempt += 1) await setTimeout(20);
    assert.equal(alive(serverPid), false, 'the server outlived its launcher');
    // The launcher still reports how its server stopped.
    assert.equal(launcherSignal, serverSignal);
  });
}
