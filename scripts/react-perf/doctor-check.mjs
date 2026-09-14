import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = (await import('./config.mjs')).default;
// react-doctor exports its CLI, but deliberately does not export package.json.
const cliPackage = path.resolve(path.dirname(require.resolve('react-doctor')), '../package.json');
const metadata = JSON.parse(readFileSync(cliPackage, 'utf8'));
const bin = typeof metadata.bin === 'string' ? metadata.bin : metadata.bin['react-doctor'];
const arguments_ = process.argv.slice(2);
const baseIndex = arguments_.indexOf('--base');
let base = baseIndex >= 0 ? arguments_[baseIndex + 1] : process.env.PERF_BASE;
if (baseIndex >= 0 && !base) throw new Error('--base requires a Git revision');
if (!base) {
  const candidate = spawnSync('git', ['rev-parse', '--verify', 'origin/master'], { cwd: root, encoding: 'utf8' });
  if (candidate.status === 0) base = 'origin/master';
}
if (base && /^0+$/.test(base)) base = undefined;
if (base && spawnSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { cwd: root, stdio: 'ignore' }).status !== 0)
  throw new Error(`Unknown Doctor comparison base: ${base}`);
// A push checkout often makes origin/master equal HEAD. Do a useful full scan
// when no changed range exists, rather than silently checking zero files.
if (base) {
  const revision = (ref) => spawnSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).stdout?.trim();
  if (revision(base) === revision('HEAD')) base = undefined;
}
let failed = false;
for (const project of config.doctorProjects || [{ cwd: '.' }]) {
  const cwd = path.resolve(root, project.cwd);
  const args = [path.resolve(path.dirname(cliPackage), bin), '.', '-y', '--verbose', '--blocking', 'none', '--no-parallel', '--no-telemetry'];
  if (base) args.push('--scope', 'changed', '--base', base, '--include-untracked');
  console.log(`[doctor:check] ${cwd}; ${base ? `changes since ${base}` : 'full source scan (no comparison base available)'}`);
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  failed ||= result.status !== 0;
}
process.exitCode = failed ? 1 : 0;
