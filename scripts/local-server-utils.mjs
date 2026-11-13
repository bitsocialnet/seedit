import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';

export const isWindows = process.platform === 'win32';
export const usePortless = process.env.PORTLESS !== '0' && !isWindows;
export const binDir = join(process.cwd(), 'node_modules', '.bin');
export const executableSuffix = isWindows ? '.cmd' : '';
export const portlessBin = join(binDir, `portless${executableSuffix}`);
export const viteBin = join(binDir, `vite${executableSuffix}`);
export const fallbackHost = '127.0.0.1';
export const fallbackUrlHost = 'localhost';
export const portlessProxyPort = process.env.PORTLESS_PORT || '443';
export const portlessEnv = {
  ...process.env,
  PORTLESS_PORT: portlessProxyPort,
  PORTLESS_HTTPS: process.env.PORTLESS_HTTPS ?? '1',
  PORTLESS_LAN: process.env.PORTLESS_LAN ?? '0',
};

export function getLocalServerCommand() {
  return usePortless && existsSync(portlessBin) ? portlessBin : viteBin;
}

export function sanitizeLabel(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function getCurrentBranch() {
  const result = spawnSync('git', ['branch', '--show-current'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

export function getActivePortlessRouteHosts() {
  const result = spawnSync(portlessBin, ['list'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return new Set();
  }

  const matches = result.stdout.match(/https?:\/\/[a-z0-9.-]+\.localhost(?::\d+)?/g) || [];

  return new Set(matches.map((url) => new URL(url).hostname));
}

export function isRouteBusy(activeRouteHosts, appName) {
  return activeRouteHosts.has(`${appName}.localhost`);
}

export function getPreferredPortlessAppName(activeRouteHosts) {
  const branch = getCurrentBranch();
  const branchLabel = sanitizeLabel(branch || 'current');

  if (branch && branch !== 'master' && branch !== 'main') {
    return `${branchLabel}.seedit`;
  }

  if (isRouteBusy(activeRouteHosts, 'seedit')) {
    return `${branchLabel}.seedit`;
  }

  return 'seedit';
}

export function getPortlessAppName() {
  const activeRouteHosts = getActivePortlessRouteHosts();
  const preferredAppName = getPreferredPortlessAppName(activeRouteHosts);

  if (!isRouteBusy(activeRouteHosts, preferredAppName)) {
    return preferredAppName;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${preferredAppName}-${suffix}`;

    if (!isRouteBusy(activeRouteHosts, candidate)) {
      return candidate;
    }
  }

  return `${preferredAppName}-${Date.now()}`;
}

export function ensurePortlessProxy() {
  const result = spawnSync(portlessBin, ['proxy', 'start', '--port', portlessProxyPort, '--https'], {
    cwd: process.cwd(),
    env: portlessEnv,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export async function waitForUrlReady(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const ready = await new Promise((resolve) => {
      const parsedUrl = new URL(url);
      const getUrl = parsedUrl.protocol === 'https:' ? httpsGet : httpGet;
      const onResponse = (response) => {
        response.resume();
        const statusCode = response.statusCode ?? 500;
        resolve(statusCode >= 200 && statusCode < 400);
      };
      const request = parsedUrl.protocol === 'https:' ? getUrl(parsedUrl, { rejectUnauthorized: false }, onResponse) : getUrl(parsedUrl, onResponse);

      request.on('error', () => resolve(false));
      request.setTimeout(2_000, () => {
        request.destroy();
        resolve(false);
      });
    });

    if (ready) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

export function openInBrowser(url) {
  const opener =
    process.platform === 'darwin'
      ? { cmd: 'open', args: [url] }
      : process.platform === 'win32'
        ? { cmd: 'cmd', args: ['/c', 'start', '""', url] }
        : { cmd: 'xdg-open', args: [url] };

  spawn(opener.cmd, opener.args, { stdio: 'ignore', detached: true }).unref();
}

// A signal sent only to the launcher (an agent stopping the PID it recorded) would otherwise leave
// the server and its Portless route running. Portless removes its route on SIGINT and SIGTERM only.
const forwardedSignals = { SIGINT: 'SIGINT', SIGTERM: 'SIGTERM', SIGHUP: 'SIGTERM' };

export function forwardChildExit(child) {
  const forwardSignal = (signal) => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(forwardedSignals[signal]);
    }
  };

  for (const signal of Object.keys(forwardedSignals)) {
    process.on(signal, forwardSignal);
  }

  child.on('exit', (code, signal) => {
    for (const forwarded of Object.keys(forwardedSignals)) {
      process.off(forwarded, forwardSignal);
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}
