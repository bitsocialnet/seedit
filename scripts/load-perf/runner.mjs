// Cold-load benchmark for the production build: measures what a first-time visitor
// waits for (first paint, first React commit, first post) and which page regions
// move after first paint. Throttling uses Chrome DevTools Protocol, so this is
// Chromium-only. Peer traffic is blocked by default so JavaScript/render cost is
// measured without live network noise; `--network live` includes peer loading.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createSecureServer } from 'node:http2';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { bounded, freePort, withBrowser } from '../react-perf/browser.mjs';
import config from './config.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const options = { samples: '5', profile: 'mid', network: 'blocked', build: 'build' };
for (let index = 0; index < args.length; index += 1) {
  const name = args[index];
  if (name === '--help') options.help = true;
  else if (name === '--check') options.check = true;
  else if (name === '--headed') options.headed = true;
  else if (['--samples', '--profile', '--network', '--build', '--output', '--route'].includes(name)) {
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    options[name.slice(2)] = value;
  } else throw new Error(`Unknown option: ${name}`);
}
if (options.help) {
  console.log(
    [
      'perf:load [--samples N] [--profile mid|cpu4|off] [--network blocked|live] [--route NAME] [--build DIR] [--output DIR] [--check] [--headed]',
      'Serves an existing production build (run `yarn build` first) and cold-loads each configured route in a fresh context',
      'with service workers blocked (CDP throttling does not reliably cover worker fetches). `blocked` aborts every request',
      'outside the app origin; `live` allows peer traffic.',
      "--check fails when a configured region shifts between first paint and React's first commit, or when a route",
      "marked staticShell does not show a shell identical to React's first frame (both in `blocked` mode). Shifts after",
      'the first commit (account and peer data arriving) are reported, not gated.',
    ].join('\n'),
  );
  process.exit(0);
}

// Same values as scripts/pw-throttle.sh. Throughput is bytes per second.
const profiles = {
  mid: { cpu: 4, down: 200000, up: 93750, latency: 150 },
  cpu4: { cpu: 4, down: -1, up: -1, latency: 0 },
  off: { cpu: 1, down: -1, up: -1, latency: 0 },
};
const profile = profiles[options.profile];
if (!profile) throw new Error(`Unknown profile: ${options.profile}`);
if (!['blocked', 'live'].includes(options.network)) throw new Error(`Unknown network mode: ${options.network}`);
const samples = Number(options.samples);
if (!Number.isInteger(samples) || samples < 1 || samples > 20) throw new Error('--samples must be an integer from 1 to 20');
if (options.check && options.network !== 'blocked') throw new Error('--check requires --network blocked');
const routes = config.routes.filter((route) => !options.route || route.name === options.route);
if (!routes.length) throw new Error(`No matching route: ${options.route}`);

const buildDir = path.resolve(packageRoot, options.build);
const output = path.resolve(packageRoot, options.output || `.react-perf/load-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(output, { recursive: true, mode: 0o700 });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

// A minimal static server keeps the measurement free of dev-server transforms. Like production
// hosting it speaks HTTP/2 and gzips text assets: over HTTP/1.1, Chromium's six connections per host
// plus the emulated per-request latency would overstate the cost of each additional startup file.
async function serveBuild() {
  const compressed = new Map();
  try {
    await stat(path.join(buildDir, 'index.html'));
  } catch {
    throw new Error(`No production build at ${buildDir}; run yarn build first`);
  }
  // Browsers only use HTTP/2 over TLS; a throwaway self-signed certificate is enough for the lab.
  const certificateDir = await mkdtemp(path.join(tmpdir(), 'load-perf-'));
  const keyFile = path.join(certificateDir, 'key.pem');
  const certificateFile = path.join(certificateDir, 'cert.pem');
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:prime256v1',
        '-nodes',
        '-subj',
        '/CN=127.0.0.1',
        '-days',
        '1',
        '-keyout',
        keyFile,
        '-out',
        certificateFile,
      ],
      {
        stdio: 'ignore',
      },
    );
  } catch (error) {
    throw new Error(`perf:load needs the openssl CLI to create a local TLS certificate for HTTP/2: ${error.message}`);
  }
  const tls = { key: await readFile(keyFile), cert: await readFile(certificateFile) };
  await rm(certificateDir, { recursive: true, force: true });
  const server = createSecureServer(tls, async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.join(buildDir, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(buildDir)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) throw new Error('not a file');
    } catch {
      file = path.join(buildDir, 'index.html');
    }
    const type = mimeTypes[path.extname(file)] || 'application/octet-stream';
    const headers = { 'content-type': type, 'cache-control': 'no-store' };
    let body = await readFile(file);
    if (/text|javascript|json|svg|wasm/.test(type) && /\bgzip\b/.test(request.headers['accept-encoding'] || '')) {
      if (!compressed.has(file)) compressed.set(file, gzipSync(body));
      body = compressed.get(file);
      headers['content-encoding'] = 'gzip';
    }
    response.writeHead(200, headers).end(body);
  });
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { origin: `https://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

// Runs in the page before any app code. Everything is timed against the
// navigation start, like the browser's own paint entries.
function installObservers(settings) {
  const state = { shifts: [], longTasks: [], firstAppCommit: null, firstContent: null, paints: {} };
  window.__LOAD_PERF__ = state;
  const regionOf = (node) => {
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    if (!element) return 'unknown';
    for (const [name, selector] of Object.entries(settings.regions)) if (element.closest(selector)) return name;
    return 'other';
  };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.shifts.push({
        time: entry.startTime,
        value: entry.value,
        hadRecentInput: entry.hadRecentInput,
        sources: (entry.sources || []).map((source) => ({
          region: regionOf(source.node),
          node: source.node?.nodeType === 1 ? `${source.node.tagName.toLowerCase()}.${String(source.node.className).slice(0, 60)}` : source.node?.nodeName,
          dy: Math.round(source.currentRect.y - source.previousRect.y),
          dx: Math.round(source.currentRect.x - source.previousRect.x),
          dh: Math.round(source.currentRect.height - source.previousRect.height),
        })),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) state.paints[entry.name] = entry.startTime;
  }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) state.longTasks.push({ time: entry.startTime, duration: entry.duration });
  }).observe({ type: 'longtask', buffered: true });
  // React's first commit replaces whatever static markup #root started with.
  const watch = () => {
    const root = document.getElementById('root');
    if (!root) return false;
    const check = () => {
      const now = performance.now();
      if (state.shellHtml === undefined && root.firstElementChild?.hasAttribute('data-static-shell')) {
        state.shellHtml = root.innerHTML;
        state.shellInserted = now;
      }
      if (state.firstAppCommit === null && [...root.children].some((child) => !child.hasAttribute('data-static-shell'))) {
        state.firstAppCommit = now;
        // Observer callbacks run right after React's commit, before its passive effects: the first app frame.
        state.commitHtml = root.innerHTML;
      }
      if (state.firstContent === null && settings.content && root.querySelector(settings.content)) state.firstContent = now;
    };
    new MutationObserver(check).observe(root, { childList: true, subtree: true });
    check();
    return true;
  };
  if (!watch()) document.addEventListener('DOMContentLoaded', watch, { once: true });
}

const median = (values) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round = (value) => (value === null || value === undefined ? null : Math.round(value));

async function loadOnce(browser, origin, route) {
  const context = await bounded(
    browser.newContext({ viewport: route.viewport || config.viewport, locale: route.locale || 'en-US', serviceWorkers: 'block', ignoreHTTPSErrors: true }),
    'Context creation',
  );
  try {
    if (route.storage)
      await context.addInitScript((entries) => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
      }, route.storage);
    await context.addInitScript(installObservers, { regions: config.regions, content: route.content });
    const page = await bounded(context.newPage(), 'Page creation');
    const cdp = await bounded(context.newCDPSession(page), 'CDP session');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: profile.down, uploadThroughput: profile.up, latency: profile.latency });
    const blocked = new Set();
    if (options.network === 'blocked')
      await page.route(
        (url) => url.origin !== origin,
        (request) => {
          blocked.add(new URL(request.request().url()).host);
          return request.abort('blockedbyclient');
        },
      );
    const errors = [];
    page.on('pageerror', (error) => errors.length < 10 && errors.push(error.message));
    await page.goto(`${origin}/${route.hash ? `#${route.hash}` : ''}`, { waitUntil: 'load', timeout: 120000 });
    // Wait for the app to commit, then let late layout (account, theme, data) settle.
    // Live mode instead waits for the first post, bounded by the route's timeout.
    const commitDeadline = Date.now() + config.commitTimeoutMs;
    while (Date.now() < commitDeadline && !(await page.evaluate(() => window.__LOAD_PERF__.firstAppCommit !== null))) await page.waitForTimeout(100);
    if (options.network === 'live' && route.content) {
      const contentDeadline = Date.now() + (route.liveTimeoutMs || 60000);
      while (Date.now() < contentDeadline && !(await page.evaluate(() => window.__LOAD_PERF__.firstContent !== null))) await page.waitForTimeout(250);
    } else await page.waitForTimeout(config.settleMs);
    const data = await page.evaluate(() => {
      // Compare the static shell with React's first frame after the browser normalizes both.
      const normalize = (html) => {
        const template = document.createElement('template');
        template.innerHTML = html;
        template.content.firstElementChild?.removeAttribute('data-static-shell');
        for (const element of template.content.querySelectorAll('[style]')) element.setAttribute('style', element.style.cssText);
        return template.innerHTML;
      };
      let handoff = null;
      const { shellHtml, commitHtml } = window.__LOAD_PERF__;
      if (shellHtml !== undefined && commitHtml !== undefined) {
        const shell = normalize(shellHtml);
        const commit = normalize(commitHtml);
        let index = 0;
        while (index < shell.length && shell[index] === commit[index]) index += 1;
        handoff =
          shell === commit
            ? { matches: true }
            : { matches: false, shell: shell.slice(Math.max(0, index - 80), index + 120), commit: commit.slice(Math.max(0, index - 80), index + 120) };
      }
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const scripts = resources.filter((entry) => entry.initiatorType === 'script' || entry.name.endsWith('.js'));
      return {
        ...window.__LOAD_PERF__,
        shellHtml: undefined,
        commitHtml: undefined,
        handoff,
        responseStart: navigation?.responseStart,
        domContentLoaded: navigation?.domContentLoadedEventEnd,
        load: navigation?.loadEventEnd,
        scriptBytes: scripts.reduce((total, entry) => total + (entry.encodedBodySize || 0), 0),
        scriptCount: scripts.length,
        resources: resources.map((entry) => ({
          name: entry.name.replace(location.origin, ''),
          start: Math.round(entry.startTime),
          end: Math.round(entry.responseEnd),
          kB: Math.round((entry.encodedBodySize || 0) / 1024),
        })),
      };
    });
    const fcp = data.paints['first-contentful-paint'] ?? null;
    const afterPaint = data.shifts.filter((shift) => !shift.hadRecentInput && fcp !== null && shift.time >= fcp);
    const firstAppCommit = data.firstAppCommit;
    // Shifts before React's first commit happen while the static shell is on screen; later ones come
    // from app state and peer data arriving after the page is usable.
    const regionShifts = { beforeCommit: {}, afterCommit: {} };
    for (const shift of afterPaint)
      for (const source of shift.sources) {
        if (!(source.region in config.regions)) continue;
        const phase = firstAppCommit === null || shift.time < firstAppCommit ? 'beforeCommit' : 'afterCommit';
        const region = (regionShifts[phase][source.region] ||= { count: 0, maxDy: 0, maxDx: 0 });
        region.count += 1;
        region.maxDy = Math.max(region.maxDy, Math.abs(source.dy));
        region.maxDx = Math.max(region.maxDx, Math.abs(source.dx));
      }
    return {
      route: route.name,
      responseStart: round(data.responseStart),
      fcp: round(fcp),
      shellInserted: round(data.shellInserted),
      firstAppCommit: round(firstAppCommit),
      firstContent: round(data.firstContent),
      domContentLoaded: round(data.domContentLoaded),
      paintToCommit: fcp === null ? null : round(Math.max(0, (firstAppCommit ?? fcp) - fcp)),
      // Total blocking time until the app committed, the window a first visitor waits through.
      tbtToCommit: round(
        data.longTasks.filter((task) => firstAppCommit === null || task.time < firstAppCommit).reduce((total, task) => total + Math.max(0, task.duration - 50), 0),
      ),
      cls: Number(afterPaint.reduce((total, shift) => total + shift.value, 0).toFixed(4)),
      handoff: data.handoff,
      regionShifts,
      shifts: afterPaint.map((shift) => ({ ...shift, time: round(shift.time), value: Number(shift.value.toFixed(4)) })),
      scriptKB: Math.round(data.scriptBytes / 1024),
      scriptCount: data.scriptCount,
      resources: data.resources,
      blockedHosts: [...blocked].sort(),
      errors,
    };
  } finally {
    await bounded(context.close(), 'Context close');
  }
}

const report = {
  schemaVersion: 1,
  profile: options.profile,
  network: options.network,
  samples,
  viewport: config.viewport,
  startedAt: new Date().toISOString(),
  routes: {},
};
const server = await serveBuild();
process.stderr.write(`[load] serving ${buildDir} at ${server.origin}; profile ${options.profile}, network ${options.network}\n`);
let failed = false;
try {
  await withBrowser(packageRoot, !!options.headed, async (browser) => {
    report.browser = await browser.version();
    for (const route of routes) {
      const runs = [];
      for (let sample = 1; sample <= samples; sample += 1) {
        const run = await loadOnce(browser, server.origin, route);
        runs.push(run);
        process.stderr.write(
          `[load] ${route.name} #${sample}: fcp ${run.fcp} ms, app commit ${run.firstAppCommit} ms, content ${run.firstContent ?? '-'} ms, tbt ${run.tbtToCommit} ms, cls ${run.cls}, shifted before commit ${Object.keys(run.regionShifts.beforeCommit).join(',') || 'none'}, after ${Object.keys(run.regionShifts.afterCommit).join(',') || 'none'}\n`,
        );
      }
      const summary = {
        fcp: median(runs.map((run) => run.fcp)),
        firstAppCommit: median(runs.map((run) => run.firstAppCommit)),
        firstContent: median(runs.map((run) => run.firstContent)),
        paintToCommit: median(runs.map((run) => run.paintToCommit)),
        tbtToCommit: median(runs.map((run) => run.tbtToCommit)),
        cls: median(runs.map((run) => run.cls)),
        scriptKB: median(runs.map((run) => run.scriptKB)),
        shiftedBeforeCommit: [...new Set(runs.flatMap((run) => Object.keys(run.regionShifts.beforeCommit)))].sort(),
        shiftedAfterCommit: [...new Set(runs.flatMap((run) => Object.keys(run.regionShifts.afterCommit)))].sort(),
        // null when no static shell was shown for this route.
        shellMatchesFirstCommit: runs.some((run) => run.handoff) ? runs.every((run) => run.handoff?.matches) : null,
      };
      report.routes[route.name] = { summary, runs };
      console.log(`${route.name}: ${JSON.stringify(summary)}`);
      if (options.check && summary.shiftedBeforeCommit.length) {
        failed = true;
        console.error(`[load] ${route.name}: regions moved before React's first commit: ${summary.shiftedBeforeCommit.join(', ')}`);
      }
      if (options.check && route.staticShell === false && summary.shellMatchesFirstCommit !== null) {
        failed = true;
        console.error(`[load] ${route.name}: showed a static shell that this route's first frame cannot match`);
      }
      if (options.check && route.staticShell && summary.shellMatchesFirstCommit !== true) {
        failed = true;
        const mismatch = runs.find((run) => run.handoff && !run.handoff.matches)?.handoff;
        console.error(
          mismatch
            ? `[load] ${route.name}: static shell differs from React's first frame\n  shell:  ${mismatch.shell}\n  commit: ${mismatch.commit}`
            : `[load] ${route.name}: expected a static shell before React's first commit`,
        );
      }
    }
  });
} finally {
  await server.close();
  await writeFile(path.join(output, 'load.json'), JSON.stringify(report, null, 2));
  process.stderr.write(`[load] report: ${path.join(output, 'load.json')}\n`);
}
if (failed) process.exitCode = 1;
