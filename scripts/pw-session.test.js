import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pw-session.sh');

// A stand-in for playwright-cli so the lock can be exercised without launching
// real browser engines. `list` reports the session recorded in liveSession as
// `status: open`, mirroring the real `playwright-cli list --all` output.
const FAKE_CLI = `#!/bin/bash
state="$(dirname "$0")/live-session"
open_rc="$(dirname "$0")/open-exit-code"
if [ "\${1:-}" = "list" ]; then
  # A slow listing: it reports that it started, then waits for a file before
  # answering, so another acquirer can move on in the meantime.
  if [ -n "\${FAKE_LIST_STARTED:-}" ]; then : >"$FAKE_LIST_STARTED"; fi
  if [ -n "\${FAKE_LIST_WAIT_FOR:-}" ]; then
    for _ in $(seq 200); do [ -e "$FAKE_LIST_WAIT_FOR" ] && break; sleep 0.05; done
  fi
  live="$(cat "$state")"
  [ "$live" = "__UNAVAILABLE__" ] && exit 3
  echo "### Browsers"
  if [ -n "$live" ]; then
    echo "- $live:"
    echo "  - status: open"
  fi
  echo "- already-closed:"
  echo "  - status: closed"
  exit 0
fi
session="\${1#-s=}"
case "\${2:-}" in
  open)
    rc="$(cat "$open_rc")"
    # The session named in hold-open is not listed as open until the test
    # releases it, like a browser that is still launching.
    while [ "$(cat "$(dirname "$0")/hold-open" 2>/dev/null)" = "$session" ]; do sleep 0.05; done
    [ "$rc" = 0 ] && printf '%s' "$session" >"$state"
    exit "$rc"
    ;;
  close)
    [ "$(cat "$state")" = "$session" ] && printf '' >"$state"
    exit 0
    ;;
esac
exit 0
`;

let tempDir;

// PATH and HOME are named explicitly rather than relying on spreading
// process.env, which vitest patches per environment.
const scriptEnv = () => ({
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  PLAYWRIGHT_RESOURCE_LOCK_DIR: path.join(tempDir, 'slot.lock'),
  PLAYWRIGHT_CLI_BIN: path.join(tempDir, 'fake-playwright-cli'),
  PW_SESSION_POLL_SECONDS: '1',
});

// Status and diagnostics are split across stdout and stderr, so assertions read
// both streams.
const run = (...args) => {
  const result = spawnSync(scriptPath, args, { encoding: 'utf8', env: scriptEnv() });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
};

// Starts `open` without waiting for it, for a browser held in its launch phase.
const startOpen = (args, extraEnv = {}) => {
  const child = spawn(scriptPath, ['open', ...args], { env: { ...scriptEnv(), ...extraEnv } });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  const exited = new Promise((resolve) => child.on('close', (code) => resolve({ code, output })));
  return { child, exited };
};

const waitFor = async (condition) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for the fixture');
};

const lockPath = (...parts) => path.join(tempDir, 'slot.lock', ...parts);
const lockExists = () => fs.existsSync(path.join(tempDir, 'slot.lock'));
const setLiveSession = (session) => fs.writeFileSync(path.join(tempDir, 'live-session'), session);
const liveSession = () => fs.readFileSync(path.join(tempDir, 'live-session'), 'utf8');
const setOpenExitCode = (code) => fs.writeFileSync(path.join(tempDir, 'open-exit-code'), String(code));

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-session-test-'));
  const fakeCli = path.join(tempDir, 'fake-playwright-cli');
  fs.writeFileSync(fakeCli, FAKE_CLI, { mode: 0o755 });
  setLiveSession('');
  setOpenExitCode(0);
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('pw-session.sh', () => {
  it('reports an available slot and rejects malformed session names', () => {
    expect(run('status').output).toContain('browser slot is available');

    const rejected = run('open', 'bad name!');
    expect(rejected.code).toBe(1);
    expect(rejected.output).toContain('session must be 1-40');
  });

  it('acquires the slot, records the owner, and blocks a second live acquire with exit 75', () => {
    expect(run('open', 'verify-chrome', 'about:blank').output).toContain("acquired browser slot for 'verify-chrome'");
    expect(run('status').output).toContain('Browser: running');

    const blocked = run('open', 'verify-firefox', 'about:blank');
    expect(blocked.code).toBe(75);
    expect(blocked.output).toContain('do not bypass the lock');
  });

  it('refuses to release or steal a slot owned by another session', () => {
    run('open', 'verify-chrome', 'about:blank');

    const released = run('release', 'verify-firefox');
    expect(released.code).toBe(1);
    expect(released.output).toContain("cannot release the slot held by 'verify-chrome'");

    // Closing a different session must still stop that browser without
    // dropping someone else's lock.
    expect(run('close', 'verify-firefox').output).toContain("left the slot held by 'verify-chrome' untouched");
    expect(lockExists()).toBe(true);
  });

  it('releases the slot when the owner closes it', () => {
    run('open', 'verify-chrome', 'about:blank');

    expect(run('close', 'verify-chrome').output).toContain("released browser slot for 'verify-chrome'");
    expect(lockExists()).toBe(false);
  });

  it('reclaims a stale slot whose browser is gone instead of blocking forever', () => {
    run('open', 'verify-chrome', 'about:blank');
    setLiveSession(''); // the browser died without releasing the lock

    const status = run('status');
    expect(status.output).toContain('stale lock');
    expect(status.output).toContain('reclaims this slot automatically');

    const reclaimed = run('open', 'verify-firefox', 'about:blank');
    expect(reclaimed.code).toBe(0);
    expect(reclaimed.output).toContain("reclaimed stale slot from 'verify-chrome'");
  });

  it('holds a slot whose browser is still launching instead of reclaiming it', async () => {
    const hold = path.join(tempDir, 'hold-open');
    fs.writeFileSync(hold, 'verify-chrome');
    const first = startOpen(['verify-chrome', 'about:blank']);
    try {
      await waitFor(() => fs.existsSync(lockPath('owner')));

      const second = run('open', 'verify-firefox', 'about:blank');
      expect(second.output).not.toContain('reclaimed');
      expect(second.code).toBe(75);
      expect(run('status').output).toContain('Browser: starting');
    } finally {
      fs.rmSync(hold, { force: true });
    }

    expect((await first.exited).code).toBe(0);
    expect(liveSession()).toBe('verify-chrome');
    expect(run('status').output).toContain('Browser: running');
    expect(run('close', 'verify-chrome').output).toContain("released browser slot for 'verify-chrome'");
    expect(lockExists()).toBe(false);
  });

  it('leaves a fresh lock alone when another acquirer reclaimed the stale one first', async () => {
    fs.mkdirSync(lockPath());
    fs.writeFileSync(lockPath('owner'), 'verify-old\n');
    const hold = path.join(tempDir, 'hold-open');
    const listStarted = path.join(tempDir, 'slow-list-started');
    fs.writeFileSync(hold, 'verify-chrome');

    // Both acquirers find the same stale lock. The slow one's listing answers
    // only after the fast one has reclaimed it and created its own lock.
    const slow = startOpen(['verify-firefox', 'about:blank'], {
      FAKE_LIST_STARTED: listStarted,
      FAKE_LIST_WAIT_FOR: lockPath('opening'),
    });
    await waitFor(() => fs.existsSync(listStarted));
    const fast = startOpen(['verify-chrome', 'about:blank']);
    let slowResult;
    try {
      slowResult = await slow.exited;
    } finally {
      fs.rmSync(hold, { force: true });
    }
    const fastResult = await fast.exited;

    expect(slowResult.output).not.toContain('reclaimed');
    expect(slowResult.code).toBe(75);
    expect(fastResult.output).toContain("reclaimed stale slot from 'verify-old'");
    expect(fastResult.code).toBe(0);
    expect(liveSession()).toBe('verify-chrome');
    expect(fs.readFileSync(lockPath('owner'), 'utf8')).toBe('verify-chrome\n');
  });

  it('closes its browser instead of keeping it when the slot was taken while it started', async () => {
    const hold = path.join(tempDir, 'hold-open');
    fs.writeFileSync(hold, 'verify-chrome');
    const first = startOpen(['verify-chrome', 'about:blank']);
    try {
      await waitFor(() => fs.existsSync(lockPath('workspace')));
      // An older copy of this script ignores `opening` and reclaims the slot
      // for its own browser.
      fs.rmSync(lockPath(), { recursive: true });
      fs.mkdirSync(lockPath());
      fs.writeFileSync(lockPath('owner'), 'verify-firefox\n');
    } finally {
      fs.rmSync(hold, { force: true });
    }

    const result = await first.exited;
    expect(result.output).toContain("taken by 'verify-firefox' while 'verify-chrome' was starting");
    expect(result.code).toBe(75);
    expect(liveSession()).toBe('');
    expect(fs.readFileSync(lockPath('owner'), 'utf8')).toBe('verify-firefox\n');
  });

  it('reclaims a slot whose opener died before its browser started', () => {
    const exited = spawnSync('true');
    fs.mkdirSync(lockPath());
    fs.writeFileSync(lockPath('owner'), 'verify-chrome\n');
    fs.writeFileSync(lockPath('opening'), `${exited.pid}\n`);

    const reclaimed = run('open', 'verify-firefox', 'about:blank');
    expect(reclaimed.code).toBe(0);
    expect(reclaimed.output).toContain("reclaimed stale slot from 'verify-chrome'");
  });

  it('reclaims a long-abandoned launch even when its opener PID now belongs to another process', () => {
    // The opener was killed mid-launch and its PID was later reused by an
    // unrelated process that is still running.
    const unrelated = spawn('sleep', ['60'], { stdio: 'ignore' });
    try {
      fs.mkdirSync(lockPath());
      fs.writeFileSync(lockPath('owner'), 'verify-chrome\n');
      fs.writeFileSync(lockPath('opening'), `${unrelated.pid}\n`);
      const abandonedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      fs.utimesSync(lockPath('opening'), abandonedAt, abandonedAt);
      fs.utimesSync(lockPath(), abandonedAt, abandonedAt);

      expect(run('status').output).toContain('stale lock');
      const reclaimed = run('open', 'verify-firefox', 'about:blank');
      expect(reclaimed.code).toBe(0);
      expect(reclaimed.output).toContain("reclaimed stale slot from 'verify-chrome'");
    } finally {
      unrelated.kill();
    }
  });

  it('holds a lock created moments ago without an owner, but reclaims an abandoned one', () => {
    // An acquirer between its atomic mkdir and its metadata write.
    fs.mkdirSync(lockPath());
    const fresh = run('open', 'verify-firefox', 'about:blank');
    expect(fresh.output).not.toContain('reclaimed');
    expect(fresh.code).toBe(75);

    const abandonedAt = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(lockPath(), abandonedAt, abandonedAt);
    const reclaimed = run('open', 'verify-firefox', 'about:blank');
    expect(reclaimed.code).toBe(0);
    expect(reclaimed.output).toContain("reclaimed stale slot from 'unknown'");
  });

  it('still stops the browser when the lock was already lost', () => {
    run('open', 'verify-chrome', 'about:blank');
    fs.rmSync(path.join(tempDir, 'slot.lock'), { recursive: true });

    expect(run('close', 'verify-chrome').output).toContain("already free; closed 'verify-chrome' anyway");
    expect(liveSession()).toBe('');
  });

  it('releases the slot when the browser fails to start', () => {
    setOpenExitCode(1);

    const failed = run('open', 'verify-chrome', 'about:blank');
    expect(failed.code).toBe(1);
    expect(failed.output).toContain('released browser slot');
    expect(lockExists()).toBe(false);
  });

  it('leaves the lock alone when browser liveness cannot be verified', () => {
    run('open', 'verify-chrome', 'about:blank');
    setLiveSession('__UNAVAILABLE__'); // playwright-cli list fails

    expect(run('status').output).toContain('unverifiable');

    // Failing closed matters: a broken CLI must not silently disable the budget.
    const blocked = run('open', 'verify-firefox', 'about:blank');
    expect(blocked.code).toBe(75);
    expect(lockExists()).toBe(true);
  });

  it('polls for a busy slot with --wait and gives up with exit 75', () => {
    run('open', 'verify-chrome', 'about:blank');

    const timedOut = run('open', '--wait=2', 'verify-firefox', 'about:blank');
    expect(timedOut.code).toBe(75);
    expect(timedOut.output).toContain('gave up after 2s');
    expect(timedOut.output).toContain('retrying in 1s');

    const malformed = run('open', '--wait=soon', 'verify-firefox');
    expect(malformed.code).toBe(1);
    expect(malformed.output).toContain('whole number of seconds');
  });

  it('honours --wait after the session name instead of passing it to playwright-cli', () => {
    run('open', 'verify-chrome', 'about:blank');

    const afterSession = run('open', 'verify-firefox', '--wait=2', 'about:blank');
    expect(afterSession.code).toBe(75);
    expect(afterSession.output).toContain('gave up after 2s');
  });

  it('fails loudly instead of spinning when a stale lock cannot be removed', () => {
    run('open', 'verify-chrome', 'about:blank');
    setLiveSession(''); // stale, but the lock directory is not removable
    fs.chmodSync(tempDir, 0o500);

    try {
      const stuck = run('open', 'verify-firefox', 'about:blank');
      expect(stuck.code).toBe(75);
      expect(stuck.output).toContain('could not reclaim the stale slot');
    } finally {
      fs.chmodSync(tempDir, 0o700);
    }
  });

  it('opens with no extra playwright-cli arguments', () => {
    // Bash 3.2 errors on an empty array expansion under `set -u`, so the
    // no-arguments path needs its own guard.
    const opened = run('open', 'verify-chrome');
    expect(opened.code).toBe(0);
    expect(opened.output).toContain("acquired browser slot for 'verify-chrome'");
  });

  it('prints usage for an unknown subcommand', () => {
    const unknown = run('bogus');
    expect(unknown.code).toBe(1);
    expect(unknown.output).toContain('Usage:');
  });
});
