import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';

const exec = promisify(execFile);
const require = createRequire(import.meta.url);

// Timing out does not cancel a CDP command; exact-session wrapper cleanup still
// owns terminating the browser after a disconnected or crashed renderer.
export async function bounded(promise, label, timeoutMs = 5000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function browserDriver() {
  // Use the driver pinned by the CLI that owns this browser, rather than a
  // different Playwright version used by an application's existing tests.
  const cliPackage = require.resolve('@playwright/cli/package.json');
  const cliRequire = createRequire(cliPackage);
  return {
    chromium: cliRequire('playwright').chromium,
    cli: path.join(path.dirname(cliPackage), 'playwright-cli.js'),
    install: path.join(path.dirname(cliRequire.resolve('playwright/package.json')), 'cli.js'),
  };
}

export async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function withBrowser(packageRoot, headed, run) {
  const driver = browserDriver();
  const { stdout } = await exec('git', ['rev-parse', '--show-toplevel'], { cwd: packageRoot });
  const repoRoot = stdout.trim();
  const wrapper = path.join(repoRoot, 'scripts/pw-session.sh');
  if (!existsSync(wrapper)) throw new Error(`Browser ownership wrapper missing: ${wrapper}`);
  const session = `perf-${process.pid}-${Date.now().toString(36)}`;
  const port = await freePort();
  const channel = process.env.REACT_PERF_BROWSER_CHANNEL;
  if (!channel && !existsSync(driver.chromium.executablePath())) throw new Error('Profiling browser is missing. Run perf:install first.');
  const scratch = await mkdtemp(path.join(tmpdir(), 'react-perf-'));
  const config = path.join(scratch, 'browser.json');
  await writeFile(
    config,
    JSON.stringify({
      browser: {
        browserName: 'chromium',
        launchOptions: {
          ...(channel ? { channel } : { executablePath: driver.chromium.executablePath() }),
          headless: !headed,
          args: [`--remote-debugging-port=${port}`],
        },
        contextOptions: { viewport: { width: 1280, height: 900 } },
      },
    }),
  );
  const env = { ...process.env, PLAYWRIGHT_CLI_BIN: driver.cli };
  let attempted = false;
  let busy = false;
  let primaryError;
  let browser;
  try {
    attempted = true;
    const result = await exec('bash', [wrapper, 'open', session, 'about:blank', `--config=${config}`], { cwd: repoRoot, env, timeout: 60000 });
    process.stderr.write(result.stdout);
    browser = await driver.chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    return await run(browser);
  } catch (error) {
    primaryError = error;
    busy = error.code === 75;
    if (busy) error.message = `Browser slot busy; retry after the owning task closes its browser. ${error.stderr || ''}`;
    throw error;
  } finally {
    // close() on a CDP connection disconnects the client; the wrapper closes
    // the actual owned browser and releases its exact session's global lock.
    const failures = [];
    try {
      if (browser) await bounded(browser.close(), 'Browser disconnect');
    } catch (error) {
      failures.push(error);
    }
    if (attempted && !busy) {
      try {
        const result = await exec('bash', [wrapper, 'close', session], { cwd: repoRoot, env, timeout: 30000 });
        process.stderr.write(result.stdout);
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      await rm(scratch, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) {
      if (primaryError) process.stderr.write(`[perf] Cleanup failed: ${failures.map((error) => error.message).join('; ')}\n`);
      else throw new AggregateError(failures, 'Profiling browser cleanup failed');
    }
  }
}

export async function startTrace(page) {
  const cdp = await bounded(page.context().newCDPSession(page), 'Trace session creation');
  try {
    await bounded(
      cdp.send('Tracing.start', {
        categories: [
          '-*',
          'blink.console',
          'blink.user_timing',
          'devtools.timeline',
          'disabled-by-default-devtools.timeline',
          'disabled-by-default-devtools.timeline.stack',
          'disabled-by-default-v8.cpu_profiler',
          'v8.execute',
          'latencyInfo',
        ].join(','),
        transferMode: 'ReturnAsStream',
      }),
      'Trace start',
    );
  } catch (error) {
    try {
      await bounded(cdp.detach(), 'Trace detach', 2000);
    } catch {
      /* Preserve the start failure. */
    }
    throw error;
  }
  return async (filename) => {
    let timer;
    let stream;
    let completeHandler;
    const complete = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Chrome did not finalize the trace')), 5000);
      completeHandler = (data) => resolve(data);
      cdp.once('Tracing.tracingComplete', completeHandler);
    });
    // Observe both promises immediately so a failed Tracing.end cannot leave an
    // unhandled timeout rejection while cleanup is already running.
    const chunks = [];
    try {
      const [result] = await Promise.all([complete, bounded(cdp.send('Tracing.end'), 'Trace end')]);
      stream = result.stream;
      const deadline = Date.now() + 10000;
      while (true) {
        if (Date.now() >= deadline) throw new Error('Trace read exceeded its 10 second deadline');
        const result = await bounded(cdp.send('IO.read', { handle: stream }), 'Trace read', Math.min(5000, deadline - Date.now()));
        chunks.push(Buffer.from(result.data, result.base64Encoded ? 'base64' : 'utf8'));
        if (result.eof) break;
      }
    } finally {
      clearTimeout(timer);
      cdp.off('Tracing.tracingComplete', completeHandler);
      try {
        if (stream) await bounded(cdp.send('IO.close', { handle: stream }), 'Trace stream close', 2000);
      } finally {
        await bounded(cdp.detach(), 'Trace detach', 2000);
      }
    }
    await writeFile(filename, gzipSync(Buffer.concat(chunks)));
  };
}

export async function startServer(server, packageRoot, env, output, abortSignal) {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const substitute = (value) => String(value).replaceAll('{port}', String(port)).replaceAll('{origin}', origin);
  const command = server.command.map(substitute);
  const log = await import('node:fs').then(({ openSync }) => openSync(output, 'w', 0o600));
  const child = spawn(command[0], command.slice(1), {
    cwd: path.resolve(packageRoot, server.cwd || '.'),
    env: { ...process.env, ...env, ...Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, substitute(value)])) },
    stdio: ['ignore', log, log],
    detached: process.platform !== 'win32',
  });
  let exited = false;
  let failure;
  child.once('error', (error) => {
    failure = error;
    exited = true;
  });
  child.once('exit', (code, signal) => {
    failure = new Error(`Server exited (${signal || code}); see ${output}`);
    exited = true;
  });
  const stop = async () => {
    if (child.pid) {
      const groupAlive = () => {
        try {
          process.kill(process.platform === 'win32' ? child.pid : -child.pid, 0);
          return true;
        } catch (error) {
          if (error.code === 'ESRCH') return false;
          throw error;
        }
      };
      const kill = (signal) => {
        try {
          process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
        }
      };
      kill('SIGTERM');
      for (let attempt = 0; groupAlive() && attempt < 30; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
      if (groupAlive()) kill('SIGKILL');
    }
    const { closeSync } = await import('node:fs');
    closeSync(log);
  };
  try {
    const deadline = Date.now() + (server.timeoutMs || 180000);
    while (Date.now() < deadline) {
      abortSignal?.throwIfAborted();
      if (exited) throw failure;
      try {
        const response = await fetch(new URL(server.readyPath || '/', origin), { signal: AbortSignal.timeout(2000) });
        await response.body?.cancel();
        if (response.status < 500) return { origin, stop };
      } catch {
        /* Wait for this owned server to bind and compile. */
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Server readiness timed out at ${origin}; see ${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
}
