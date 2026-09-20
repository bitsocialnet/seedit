#!/usr/bin/env node
// Explicit, development-only comparison against a retained pre-change helper tree.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createPlaywrightDriver, findPlaywrightCli } from './browser-playwright.mjs';
import { runBrowserPlan, validatePlan } from './browser-plan.mjs';
import { createJevClient } from './client.mjs';

const execute = promisify(execFile);
export async function readBenchmarkPlan(file) {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 100_000) throw new Error('invalid_benchmark_plan');
    const bytes = Buffer.alloc(100_001);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead > 100_000) throw new Error('invalid_benchmark_plan');
    return JSON.parse(bytes.subarray(0, bytesRead).toString('utf8'));
  } finally {
    await handle.close();
  }
}
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null;
};

export function summarizePairs(runs) {
  const pairs = new Map();
  for (const run of runs.filter((run) => !run.warmup)) {
    const id = JSON.stringify([run.case, run.sample, run.mode]);
    if (!pairs.has(id)) pairs.set(id, {});
    pairs.get(id)[run.transport] = run;
  }
  const summaries = [];
  for (const mode of ['deterministic', 'jev']) {
    const selected = [...pairs.values()].filter((pair) => (pair.old || pair.combined)?.mode === mode);
    const comparable = selected.filter(
      ({ old, combined }) =>
        old?.status === 'completed' &&
        combined?.status === 'completed' &&
        JSON.stringify(old.actions) === JSON.stringify(combined.actions) &&
        JSON.stringify(old.assertions) === JSON.stringify(combined.assertions),
    );
    if (!selected.length) continue;
    summaries.push({
      mode,
      pairs: selected.length,
      comparablePairs: comparable.length,
      combinedAdapterModes: [...new Set(selected.map((pair) => pair.combined?.adapterMode).filter(Boolean))],
      oldMedianMs: median(comparable.map((pair) => pair.old.lifecycleMs)),
      combinedMedianMs: median(comparable.map((pair) => pair.combined.lifecycleMs)),
      medianPairedReductionFraction: median(comparable.map((pair) => 1 - pair.combined.lifecycleMs / pair.old.lifecycleMs)),
      oldMedianControlCalls: median(comparable.map((pair) => pair.old.controlCalls)),
      combinedMedianControlCalls: median(comparable.map((pair) => pair.combined.controlCalls)),
    });
  }
  return summaries;
}

export async function benchmarkRun(plan, { createDriver, runPlan, client, baseline }) {
  let controlCalls = 0;
  let controlMs = 0;
  let modelMs = 0;
  const components = {};
  const before = client?.stats();
  const usage = () => {
    if (!client) return null;
    const after = client.stats();
    const difference = Object.fromEntries(
      ['requests', 'inputTokens', 'outputTokens', 'usageMissing', 'reservedInputTokens', 'knownCostSubtotalUsd', 'reservedMaxCostUsd'].map((key) => [
        key,
        after[key] - before[key],
      ]),
    );
    return { ...difference, estimatedCostUsd: difference.usageMissing ? null : difference.knownCostSubtotalUsd };
  };
  const raw = createDriver({
    execute: async (...args) => {
      const started = performance.now();
      controlCalls++;
      try {
        return await execute(...args);
      } finally {
        controlMs += performance.now() - started;
      }
    },
  });
  const driver = new Proxy(raw, {
    get(target, key) {
      if (typeof target[key] !== 'function') return target[key];
      return async (...args) => {
        const phase = key === 'observe' && args[0] ? 'observeWithAssertions' : key;
        const started = performance.now();
        try {
          return await target[key](...args);
        } finally {
          components[phase] ||= { calls: 0, elapsedMs: 0 };
          components[phase].calls++;
          components[phase].elapsedMs += performance.now() - started;
        }
      };
    },
  });
  const measuredClient = client && {
    stats: usage,
    ask: async (request) => {
      const started = performance.now();
      try {
        return await client.ask(request);
      } finally {
        modelMs += performance.now() - started;
      }
    },
  };
  const started = performance.now();
  const report = await runPlan(plan, { driver, client: measuredClient, baseline });
  return {
    status: report.status,
    reason: report.reason,
    flowCompleted: report.flowCompleted,
    actions: report.actions,
    assertions: report.assertions,
    staleReplans: report.staleReplans,
    adapterMode: report.adapterMode || 'legacy-separate',
    lifecycleMs: performance.now() - started,
    controlCalls,
    controlMs,
    modelMs,
    components,
    usage: usage(),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      plan: { type: 'string', multiple: true },
      'baseline-root': { type: 'string' },
      live: { type: 'boolean', default: false },
      jev: { type: 'boolean', default: false },
      samples: { type: 'string', default: '3' },
      warmups: { type: 'string', default: '1' },
      'max-requests': { type: 'string', default: '100' },
      'max-cost-usd': { type: 'string', default: '0.02' },
      evidence: { type: 'string', default: 'fixture' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/jev/browser-benchmark.mjs --plan task-plan.json [--plan another.json] --baseline-root /retained/repo [--live] [--jev] [--samples 3 --warmups 1] [--evidence fixture|real-app] [--max-requests 100 --max-cost-usd 0.02]\nOffline validates plans only. --live runs real isolated browsers; --jev additionally makes budgeted model requests. Baseline root must be trusted local code retaining scripts/jev and scripts/pw-session.sh. No server starts or dependency installs. JSON goes to stdout, progress to stderr.',
    );
    return 0;
  }
  const samples = Number(values.samples),
    warmups = Number(values.warmups),
    maxRequests = Number(values['max-requests']),
    maxCostUsd = Number(values['max-cost-usd']);
  if (
    !values.plan?.length ||
    values.plan.length > 10 ||
    new Set(values.plan).size !== values.plan.length ||
    !values['baseline-root'] ||
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 10 ||
    !Number.isInteger(warmups) ||
    warmups < 0 ||
    warmups > 2 ||
    !Number.isInteger(maxRequests) ||
    maxRequests < 1 ||
    maxRequests > 500 ||
    !Number.isFinite(maxCostUsd) ||
    maxCostUsd <= 0 ||
    maxCostUsd > 0.02 ||
    !['fixture', 'real-app'].includes(values.evidence)
  )
    throw new Error('invalid_benchmark_options');
  const plans = [];
  for (const file of values.plan) {
    const plan = await readBenchmarkPlan(file);
    validatePlan(plan);
    plans.push({ id: `case_${plans.length + 1}`, file: path.basename(file), plan });
  }
  if (!values.live) {
    console.log(JSON.stringify({ offline: true, plans: plans.map(({ id, file }) => ({ id, file })), requests: 0 }));
    return 0;
  }
  const baselineRoot = path.resolve(values['baseline-root']);
  const oldDriver = await import(pathToFileURL(path.join(baselineRoot, 'scripts/jev/browser-playwright.mjs')).href);
  const oldPlan = await import(pathToFileURL(path.join(baselineRoot, 'scripts/jev/browser-plan.mjs')).href);
  const cli = await findPlaywrightCli();
  process.env.PLAYWRIGHT_CLI_BIN = cli;
  const client = values.jev ? createJevClient({ live: true, maxRequests, maxCostUsd, maxInputTokens: 450_000, deadlineMs: 600_000 }) : undefined;
  const model = client?.assertReady().model ?? null;
  const variants = {
    old: { createDriver: oldDriver.createPlaywrightDriver, runPlan: oldPlan.runBrowserPlan },
    combined: { createDriver: createPlaywrightDriver, runPlan: runBrowserPlan },
  };
  const runs = [];
  for (const entry of plans)
    for (let sample = -warmups; sample < samples; sample++) {
      const order = (sample + warmups) % 2 ? ['combined', 'old'] : ['old', 'combined'];
      for (const transport of order) {
        const result = await benchmarkRun(entry.plan, { ...variants[transport], client, baseline: !values.jev });
        const run = {
          case: entry.id,
          plan: entry.file,
          sample: Math.max(sample, 0),
          warmup: sample < 0,
          evidence: values.evidence,
          mode: values.jev ? 'jev' : 'deterministic',
          transport,
          ...result,
        };
        runs.push(run);
        console.error(
          JSON.stringify({
            case: run.case,
            sample,
            transport,
            status: run.status,
            reason: run.reason,
            adapterMode: run.adapterMode,
            lifecycleMs: Math.round(run.lifecycleMs),
            controlCalls: run.controlCalls,
          }),
        );
        if (['browser_slot_busy', 'cleanup_failed'].includes(run.reason)) {
          console.log(JSON.stringify({ runs, summary: summarizePairs(runs), interrupted: run.reason, usage: client?.stats() || null }, null, 2));
          return 2;
        }
      }
    }
  console.log(
    JSON.stringify(
      {
        version: 1,
        node: process.version,
        cli,
        model,
        evidence: values.evidence,
        samples,
        warmups,
        note: 'Lifecycle includes browser setup, navigation, exact assertions, and owned-session cleanup. Control calls count helper subprocess invocations (wrapper open/close each count once), not CDP messages. Components overlap control time and must not be added to it. Warmups retained but excluded; only completed pairs with identical actions and assertions enter timing summaries. Small local measurements, not general browser speed claims.',
        runs,
        summary: summarizePairs(runs),
        usage: client?.stats() || null,
      },
      null,
      2,
    ),
  );
  return runs.every((run) => run.status === 'completed') ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      console.error('browser_benchmark_unavailable');
      process.exitCode = 2;
    });
