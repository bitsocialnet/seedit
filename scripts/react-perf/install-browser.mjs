import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { browserChannel, browserDriver } from './browser.mjs';

const driver = browserDriver();
const options = process.argv.slice(2);
if (browserChannel === 'chrome' && options.length === 0) {
  // Match the launch driver's system paths without starting a privileged installer.
  const { registry } = createRequire(driver.install)('playwright-core/lib/coreBundle').registry;
  const installed = registry.findExecutable('chrome').executablePath();
  if (installed) {
    console.log(`Using system Chrome at ${installed}`);
  } else {
    console.error('Google Chrome is missing. Install it with your system package manager or run yarn perf:install --force to install it system-wide.');
    process.exitCode = 1;
  }
} else {
  const result = spawnSync(process.execPath, [driver.install, 'install', browserChannel, ...options], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
