import { spawnSync } from 'node:child_process';
import { browserDriver } from './browser.mjs';

const args = ['install', 'chromium', ...process.argv.slice(2)];
const result = spawnSync(process.execPath, [browserDriver().install, ...args], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
