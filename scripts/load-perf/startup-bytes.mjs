// Deterministic ratchet on what a first visit downloads before the app renders: index.html itself
// (with its inlined startup CSS and static shell) plus the files it loads, which is the entry script
// and the preload tags written by scripts/vite-app-preload.mjs for the deferred index and app graphs.
// Disabled stylesheet links (inlined, never fetched) are skipped. Images, icons, and the manifest are
// not counted: they do not block the first paint or commit. Raw bytes are the gate because gzip
// output varies with the zlib version; gzip is reported for context.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const budgetFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'startup-bytes-budget.json');
const args = process.argv.slice(2);
const update = args.includes('--update');
const buildIndex = args.indexOf('--build');
const buildDir = path.resolve(packageRoot, buildIndex === -1 ? 'build' : args[buildIndex + 1]);
if (args.includes('--help')) {
  console.log(
    'perf:startup-bytes [--build DIR] [--update]\nFails when the startup assets referenced by DIR/index.html exceed the checked-in ceiling.\n--update lowers the ceiling to the current size; it never raises it. Raise it by editing startup-bytes-budget.json in the same change, with the reason.',
  );
  process.exit(0);
}

const html = await readFile(path.join(buildDir, 'index.html'), 'utf8');
const fetchedAsset = (tag) => {
  if (/^<link\b/.test(tag) && (!/\brel=["'](?:modulepreload|stylesheet|preload)["']/.test(tag) || /\sdisabled\b/.test(tag))) return undefined;
  const url = tag.match(/\b(?:src|href)=["']([^"']+\.(?:js|css))["']/)?.[1];
  return url && !/^[a-z]+:/i.test(url) ? url : undefined;
};
const files = [...new Set([...html.matchAll(/<(?:script|link)\b[^>]*>/g)].map(([tag]) => fetchedAsset(tag)).filter(Boolean))];
let rawBytes = Buffer.byteLength(html);
let gzipBytes = gzipSync(html).length;
const sizes = [{ href: 'index.html', raw: rawBytes, gzip: gzipBytes }];
for (const href of files) {
  const content = await readFile(path.join(buildDir, href.replace(/^(\.\/|\/)/, '')));
  const gzip = gzipSync(content).length;
  rawBytes += content.length;
  gzipBytes += gzip;
  sizes.push({ href, raw: content.length, gzip });
}
sizes.sort((a, b) => b.raw - a.raw);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(`Startup assets for ${path.relative(packageRoot, buildDir)}/index.html: index.html + ${files.length} files, ${kb(rawBytes)} raw, ${kb(gzipBytes)} gzip`);
for (const { href, raw, gzip } of sizes.slice(0, 8)) console.log(`  ${kb(raw).padStart(10)} raw ${kb(gzip).padStart(10)} gzip  ${href}`);

let budget;
try {
  budget = JSON.parse(await readFile(budgetFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (update) {
  if (budget && rawBytes >= budget.maxRawBytes) {
    console.log(`Ceiling unchanged at ${budget.maxRawBytes} bytes (current ${rawBytes}).`);
  } else {
    await writeFile(budgetFile, `${JSON.stringify({ ...budget, maxRawBytes: rawBytes }, null, 2)}\n`);
    console.log(`Ceiling lowered to ${rawBytes} bytes.`);
  }
} else if (!budget) {
  console.error(`Missing ${path.relative(packageRoot, budgetFile)}; run with --update to create it.`);
  process.exitCode = 1;
} else {
  // An optional allowance covers startup content the build fetches rather than the repository
  // pins; allowanceReason says what it is.
  const allowance = budget.allowanceBytes || 0;
  const limit = budget.maxRawBytes + allowance;
  const allowanceNote = allowance ? ` plus a ${allowance}-byte allowance (${budget.allowanceReason})` : '';
  if (rawBytes > limit) {
    console.error(
      `Startup assets grew to ${rawBytes} bytes, over the ${budget.maxRawBytes}-byte ceiling${allowanceNote} (+${rawBytes - budget.maxRawBytes}). Load the new code after the first render (lazy import), or raise the ceiling in ${path.relative(packageRoot, budgetFile)} with the reason.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`Within the ${budget.maxRawBytes}-byte ceiling${allowanceNote}: ${rawBytes} bytes. Run with --update to lower the ceiling when this shrinks.`);
  }
}
