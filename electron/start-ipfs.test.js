/**
 * Unit tests for the IPFS auto-restart loop. A shell script stands in for the kubo binary
 * (KUBO_BINARY, dev mode), so spawn failures and daemon exits are real child process events.
 *
 * Vitest runs these files through vite's node polyfills, so the global `process` is a browser shim
 * (empty env, no-op `on`): KUBO_BINARY is set on it directly and exit hooks are read from a `process.on` spy.
 * `node:process` is the real process, which start-ipfs.js uses to signal pids.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import realProcess from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ dataPath: '', checkPort: null, startProxy: null }));

vi.mock('electron-is-dev', () => ({ default: true }));
vi.mock('tcp-port-used', () => ({ default: { check: (...args) => state.checkPort(...args) } }));
vi.mock('./proxy-server.js', () => ({ default: { start: (...args) => state.startProxy(...args) } }));
vi.mock('./pkc-paths.js', () => ({ getPkcDataPath: () => state.dataPath }));
vi.mock('./before-pack.js', () => ({
  downloadIpfsClients: () => {
    throw new Error('tests must not download kubo');
  },
}));

const within = (promise, ms = 4000) =>
  Promise.race([promise, new Promise((resolve, reject) => setTimeout(() => reject(new Error(`no IPFS start result after ${ms}ms`)), ms))]);

let startIpfs;
let processOn;
const exitHooks = () => processOn.mock.calls.filter(([event]) => event === 'exit').map(([, listener]) => listener);
const nextError = () => new Promise((resolve) => (startIpfs.onError = resolve));
const nextStart = () => new Promise((resolve) => (startIpfs.onStarted = resolve));
const retry = () => vi.advanceTimersByTime(1000);

const writeKubo = (script, mode = 0o755) => {
  const kuboPath = path.join(state.dataPath, 'kubo');
  fs.writeFileSync(kuboPath, `#!/bin/sh\n${script}\nexit 0\n`, { mode });
  process.env.KUBO_BINARY = kuboPath;
};

const importStartIpfs = async () => {
  vi.resetModules();
  ({ default: startIpfs } = await import('./start-ipfs.js'));
};

beforeEach(() => {
  state.dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'seedit-start-ipfs-test-'));
  state.checkPort = vi.fn(async () => false);
  state.startProxy = vi.fn();
  processOn = vi.spyOn(process, 'on');
  // only the module's 1s retry interval is faked; child process events stay real
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // the module's exit hooks signal pids, so never leave them on the test process
  for (const listener of exitHooks()) process.removeListener('exit', listener);
  delete process.env.KUBO_BINARY;
  vi.useRealTimers();
  vi.restoreAllMocks();
  fs.rmSync(state.dataPath, { recursive: true, force: true });
});

describe.skipIf(realProcess.platform === 'win32')('IPFS auto-restart', () => {
  it('reports a kubo binary that cannot be spawned and keeps retrying', async () => {
    // exists but is not executable: spawn emits 'error' (EACCES) and never 'exit'
    writeKubo('', 0o644);
    await importStartIpfs();

    const error = await within(nextError());
    expect(error.code).toBe('EACCES');

    state.checkPort.mockClear();
    const retried = nextError();
    retry();
    expect(state.checkPort).toHaveBeenCalledTimes(1);
    expect((await within(retried)).code).toBe('EACCES');
  });

  it('reports ipfs as started when another client starts it after a failed attempt', async () => {
    writeKubo('', 0o644);
    await importStartIpfs();
    await within(nextError());

    // the next retry finds the API port in use
    state.checkPort.mockResolvedValue(true);
    const started = nextStart();
    retry();
    await within(started);
  });

  it('reports a daemon that cannot be spawned', async () => {
    // init and config succeed, then the binary loses its exec bit before 'ipfs daemon'
    writeKubo('if [ "$1" = config ] && [ "$2" = Addresses.API ]; then /bin/chmod -x "$0"; fi');
    await importStartIpfs();

    const error = await within(nextError());
    expect(error.code).toBe('EACCES');
  });

  it('does not keep exit hooks or dev proxies for daemons that already exited', async () => {
    writeKubo('if [ "$1" = daemon ]; then echo "daemon crashed" >&2; exit 1; fi');
    await importStartIpfs();

    expect((await within(nextError())).message).toContain('daemon crashed');
    const exitHooksAfterFirstDaemon = exitHooks().length;
    for (let attempt = 0; attempt < 3; attempt++) {
      const failed = nextError();
      retry();
      await within(failed);
    }

    expect(exitHooks()).toHaveLength(exitHooksAfterFirstDaemon);
    expect(state.startProxy).toHaveBeenCalledTimes(1);

    // at app exit, no signal goes to the pids of daemons that already exited
    const kill = vi.spyOn(realProcess, 'kill').mockImplementation(() => true);
    for (const listener of exitHooks()) listener(0);
    expect(kill).not.toHaveBeenCalled();
  });

  it('still kills a running daemon when the app exits', async () => {
    writeKubo('if [ "$1" = daemon ]; then echo $$ > "$IPFS_PATH/daemon.pid"; echo "Daemon is ready"; exec /bin/sleep 30; fi');
    await importStartIpfs();

    await within(nextStart());
    const pid = Number(fs.readFileSync(path.join(state.dataPath, 'ipfs', 'daemon.pid'), 'utf8'));
    const kill = vi.spyOn(realProcess, 'kill').mockImplementation(() => true);
    try {
      for (const listener of exitHooks()) listener(0);
      expect(kill).toHaveBeenCalledWith(pid);
    } finally {
      kill.mockRestore();
      realProcess.kill(pid, 'SIGKILL');
    }
  });
});
