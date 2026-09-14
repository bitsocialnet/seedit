#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import spawn from 'cross-spawn';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { constants, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Bitsocial checkouts, including 5chan and Seedit, deliberately share this slot.
export const verificationLockPath = path.join(tmpdir(), '5chan-agent-verify.lock');
const defaultCommands = ['build', 'lint', 'type-check', 'doctor:check', 'perf:check'].map((name) => ['corepack', 'yarn', name]);
const signalExitCode = (signal) => 128 + (constants.signals[signal] || 1);

function acquireLock(lockPath, cwd) {
  try {
    mkdirSync(lockPath, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner = 'owner details unavailable';
    try {
      const details = JSON.parse(readFileSync(path.join(lockPath, 'owner.json'), 'utf8'));
      owner = `PID ${details.pid}, ${details.cwd}, started ${details.startedAt}`;
    } catch {
      // A concurrent owner may still be writing its metadata. Do not steal it.
    }
    throw Object.assign(new Error(`Verification slot busy (${owner}). Lock: ${lockPath}. Retry after that run finishes; inspect stale locks before removing them.`), {
      code: 'LOCK_BUSY',
    });
  }

  const ownerPath = path.join(lockPath, 'owner.json');
  const token = randomUUID();
  try {
    writeFileSync(ownerPath, JSON.stringify({ pid: process.pid, cwd, startedAt: new Date().toISOString(), token }), { flag: 'wx' });
  } catch (error) {
    rmdirSync(lockPath);
    throw error;
  }
  return () => {
    // Never remove a lock that has been replaced by another invocation.
    if (JSON.parse(readFileSync(ownerPath, 'utf8')).token !== token) throw new Error(`Verification lock ownership changed: ${lockPath}`);
    unlinkSync(ownerPath);
    rmdirSync(lockPath);
  };
}

export async function runVerification({ cwd = repoRoot, lockPath = verificationLockPath, commands = defaultCommands, log = console.log, error = console.error } = {}) {
  let release;
  try {
    release = acquireLock(lockPath, cwd);
  } catch (failure) {
    error(`[agent verify] ${failure.message}`);
    return failure.code === 'LOCK_BUSY' ? 75 : 1;
  }

  let child;
  let interrupted;
  let exitCode = 0;
  const failures = [];
  const forwardSignal = (signal) => {
    interrupted = signal;
    if (!child?.pid) return;
    try {
      if (process.platform === 'win32') {
        const result = spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        if (result.error || result.status !== 0) error(`[agent verify] Could not terminate command tree for PID ${child.pid}`);
      } else process.kill(-child.pid, signal);
    } catch (failure) {
      if (failure.code !== 'ESRCH') error(`[agent verify] Could not forward ${signal}: ${failure.message}`);
    }
  };
  const onInterrupt = () => forwardSignal('SIGINT');
  const onTerminate = () => forwardSignal('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);

  try {
    for (const command of commands) {
      if (interrupted) break;
      const label = command.join(' ');
      log(`[agent verify] ${label} (${cwd})`);
      const result = await new Promise((resolve) => {
        child = spawn(command[0], command.slice(1), { cwd, stdio: 'inherit', detached: process.platform !== 'win32' });
        child.on('error', (failure) => resolve({ code: failure.code === 'ENOENT' ? 127 : 1, detail: failure.message }));
        child.on('close', (code, signal) => resolve({ code: signal ? signalExitCode(signal) : (code ?? 1), detail: signal ? `signal ${signal}` : `exit ${code}` }));
      });
      child = undefined;
      if (result.code !== 0) {
        exitCode ||= result.code;
        failures.push(`${label}: ${result.detail}`);
        error(`[agent verify] Failed: ${failures.at(-1)}`);
      }
    }
  } catch (failure) {
    error(`[agent verify] ${failure.message}`);
    exitCode ||= 1;
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
    try {
      release();
    } catch (failure) {
      error(`[agent verify] Could not release lock: ${failure.message}`);
      exitCode ||= 1;
    }
  }

  if (interrupted) return signalExitCode(interrupted);
  if (failures.length) error(`[agent verify] ${failures.length} check(s) failed; returning exit ${exitCode}.`);
  else if (exitCode === 0) log('[agent verify] Build, lint, type-check, Doctor diagnostics, and runtime performance checks passed.');
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runVerification();
}
