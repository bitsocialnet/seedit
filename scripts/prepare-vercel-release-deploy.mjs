#!/usr/bin/env node

// Stages a release's seedit-html zip as a Vercel prebuilt output (.vercel/output) so the
// release workflow can deploy the exact published archive to production. Prints the staged
// directory on stdout for `vercel deploy --prebuilt`.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const MANIFEST_FILE = 'seedit-release-manifest.json';
const SIGNATURE_FILE = 'seedit-release-manifest.sig.json';

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      throw new Error(`Unexpected argument: ${item}`);
    }
    const key = item.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
};

const resolvePath = (value) => path.resolve(repoRoot, value);

const readProjectJson = () => {
  const projectJsonPath = path.join(repoRoot, '.vercel', 'project.json');
  if (!fs.existsSync(projectJsonPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
};

const copyStaticFiles = (sourceDir, targetDir) => {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === '.vercel' || entry.name === 'vercel.json') {
      continue;
    }
    fs.cpSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), { recursive: true });
  }
};

const headersToMap = (headers) => Object.fromEntries(headers.map((header) => [header.key, header.value]));

const routeSourceForHeader = (source) => {
  if (source === '/') {
    return '^/$';
  }
  if (/^\/[A-Za-z0-9_.-]+$/.test(source)) {
    return `^${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
  }
  return source;
};

const findAppDir = (unpackDir, version) => {
  const expectedDir = path.join(unpackDir, `seedit-html-${version}`);
  if (fs.existsSync(path.join(expectedDir, 'index.html'))) {
    return expectedDir;
  }

  if (fs.existsSync(path.join(unpackDir, 'index.html'))) {
    return unpackDir;
  }

  const candidates = fs
    .readdirSync(unpackDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(unpackDir, entry.name))
    .filter((candidate) => fs.existsSync(path.join(candidate, 'index.html')));

  if (candidates.length !== 1) {
    throw new Error(`Could not find exactly one release app directory in ${unpackDir}`);
  }

  return candidates[0];
};

// Translates vercel.json headers and rewrites into Build Output API routes, since a prebuilt
// deploy ignores vercel.json.
const writeBuildOutputConfig = (outputDir) => {
  const repoConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
  const routes = [];

  for (const headerRule of repoConfig.headers || []) {
    routes.push({
      src: routeSourceForHeader(headerRule.source),
      headers: headersToMap(headerRule.headers),
      continue: true,
    });
  }

  routes.push({ handle: 'filesystem' });

  for (const rewriteRule of repoConfig.rewrites || []) {
    routes.push({
      src: rewriteRule.source,
      dest: rewriteRule.destination,
    });
  }

  fs.writeFileSync(path.join(outputDir, 'config.json'), `${JSON.stringify({ version: 3, routes }, null, 2)}\n`);
};

const writeProjectLink = (deployDir) => {
  const project = readProjectJson();
  const orgId = process.env.VERCEL_ORG_ID || project.orgId;
  const projectId = process.env.VERCEL_PROJECT_ID || project.projectId;
  const projectName = process.env.VERCEL_PROJECT_NAME || project.projectName || 'seedit';

  if (!orgId || !projectId) {
    throw new Error('VERCEL_ORG_ID and VERCEL_PROJECT_ID are required to link the staged deploy.');
  }

  const vercelDir = path.join(deployDir, '.vercel');
  fs.mkdirSync(vercelDir, { recursive: true });
  fs.writeFileSync(path.join(vercelDir, 'project.json'), `${JSON.stringify({ orgId, projectId, projectName }, null, 2)}\n`);
};

const validateRelease = (appDir, tag, version) => {
  for (const file of ['index.html', MANIFEST_FILE, SIGNATURE_FILE]) {
    if (!fs.existsSync(path.join(appDir, file))) {
      throw new Error(`Release HTML archive is missing ${file}`);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(appDir, MANIFEST_FILE), 'utf8'));
  if (manifest.version !== version || manifest.releaseTag !== tag) {
    throw new Error(`${MANIFEST_FILE} is for ${manifest.releaseTag} (${manifest.version}), expected ${tag} (${version})`);
  }
};

const stagePrebuiltDeploy = (appDir, outDir) => {
  const deployDir = path.join(outDir, 'prebuilt');
  const outputDir = path.join(deployDir, '.vercel', 'output');
  const staticDir = path.join(outputDir, 'static');

  copyStaticFiles(appDir, staticDir);
  writeBuildOutputConfig(outputDir);
  writeProjectLink(deployDir);

  return deployDir;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const tag = args.tag || process.env.GITHUB_REF_NAME;
  if (!tag?.startsWith('v')) {
    throw new Error('Pass --tag vX.Y.Z or set GITHUB_REF_NAME to a release tag.');
  }

  const version = tag.slice(1);
  const assetPath = resolvePath(args.asset || `dist/seedit-html-${version}.zip`);
  if (!fs.existsSync(assetPath)) {
    throw new Error(`Release HTML archive not found: ${assetPath}`);
  }

  const outDir = args['out-dir'] ? resolvePath(args['out-dir']) : fs.mkdtempSync(path.join(os.tmpdir(), 'seedit-vercel-release-'));
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const unpackDir = path.join(outDir, 'unpacked');
  fs.mkdirSync(unpackDir, { recursive: true });
  execFileSync('unzip', ['-q', assetPath, '-d', unpackDir], { stdio: 'inherit' });

  const appDir = findAppDir(unpackDir, version);
  validateRelease(appDir, tag, version);
  const deployDir = stagePrebuiltDeploy(appDir, outDir);

  console.error(`Prepared ${tag} release deployment from ${path.relative(repoRoot, assetPath)}`);
  console.error(`Staged Vercel prebuilt directory: ${deployDir}`);
  process.stdout.write(`${deployDir}\n`);
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
