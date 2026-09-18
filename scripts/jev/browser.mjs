#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createJevClient, JevError } from './client.mjs';
import { validatePlan, runBrowserPlan } from './browser-plan.mjs';
import { createPlaywrightDriver } from './browser-playwright.mjs';

export async function main(args = process.argv.slice(2)) {
  if (!args.length || args.includes('--help')) {
    process.stdout.write(
      'Usage: node scripts/jev/browser.mjs --plan plan.json [--live] [--baseline] [--model jev-X.Y.Z]\nWithout --live, validates the plan offline. --baseline executes the same plan without AI calls.\nLive Jev requires TYPESAFE_API_KEY and JEV_MODEL (or --model). JSON result, exit 0 complete/valid, 2 incomplete/invalid.\n',
    );
    return 0;
  }
  try {
    const options = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (['--live', '--baseline'].includes(arg) && options[arg] === undefined) options[arg] = true;
      else if (['--plan', '--model'].includes(arg) && options[arg] === undefined && args[i + 1] && !args[i + 1].startsWith('--')) options[arg] = args[++i];
      else throw new JevError('invalid_arguments');
    }
    if (!options['--plan']) throw new JevError('plan_required');
    const source = await readFile(options['--plan'], 'utf8');
    if (Buffer.byteLength(source) > 64_000) throw new JevError('plan_too_large');
    const rawPlan = JSON.parse(source);
    const plan = validatePlan(rawPlan);
    if (!options['--live']) {
      process.stdout.write(
        JSON.stringify({ status: 'validated', networkCalls: 0, origin: plan.origin, actions: plan.actions.length, assertions: plan.assertions.length }) + '\n',
      );
      return 0;
    }
    const client = options['--baseline']
      ? null
      : createJevClient({
          live: true,
          model: options['--model'] || process.env.JEV_MODEL,
          maxRequests: plan.limits.maxSteps + (plan.semanticChecks?.length || 0),
          maxCostUsd: plan.limits.maxCostUsd,
          deadlineMs: plan.limits.deadlineMs,
          maxInputBytes: Math.min(128_000, plan.limits.maxSnapshotBytes + 30_000),
        });
    const result = await runBrowserPlan(rawPlan, { driver: createPlaywrightDriver(), client, baseline: !!options['--baseline'] });
    process.stdout.write(JSON.stringify(result) + '\n');
    return result.status === 'completed' ? 0 : 2;
  } catch (error) {
    process.stdout.write(JSON.stringify({ status: 'incomplete', reason: error instanceof JevError ? error.code : 'invalid_or_unreadable_plan' }) + '\n');
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
