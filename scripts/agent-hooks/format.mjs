#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const editTools = new Set(['Edit', 'Write', 'MultiEdit', 'apply_patch']);

export function editedPaths(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (payload.hook_event_name && payload.hook_event_name !== 'PostToolUse') return [];
  if (payload.tool_name && !editTools.has(payload.tool_name)) return [];
  if (payload.tool_response?.isError === true || payload.tool_response?.success === false) return [];

  const input = payload.tool_input;
  if (payload.tool_name !== 'apply_patch') {
    const filePath = input?.file_path ?? payload.file_path;
    if (typeof filePath === 'string') return [filePath];
  }
  if (payload.tool_name && payload.tool_name !== 'apply_patch') return [];
  if (typeof input?.command !== 'string') return [];

  const lines = input.command.trim().split(/\r?\n/);
  if (lines[0] !== '*** Begin Patch' || lines.at(-1) !== '*** End Patch') return [];

  const paths = [];
  let pendingPath;
  for (const line of lines.slice(1, -1)) {
    const file = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (file) {
      if (pendingPath) paths.push(pendingPath);
      pendingPath = file[1] === 'Delete' ? undefined : file[2];
    } else if (line.startsWith('*** Move to: ') && pendingPath) {
      pendingPath = line.slice('*** Move to: '.length);
    }
  }
  if (pendingPath) paths.push(pendingPath);
  return paths;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function formattingPaths(payload, root = repoRoot) {
  const realRoot = realpathSync(root);
  const editCwd = typeof payload?.cwd === 'string' && path.isAbsolute(payload.cwd) ? payload.cwd : root;
  const files = new Set();
  for (const candidate of editedPaths(payload)) {
    if (!candidate || candidate.includes('\0') || !/\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/.test(candidate)) continue;
    const absolute = path.resolve(editCwd, candidate);
    if (!isInside(path.resolve(root), absolute)) continue;
    try {
      // Resolve the final file too: a symlink in the repo may point outside it.
      const realFile = realpathSync(absolute);
      if (isInside(realRoot, realFile) && statSync(realFile).isFile()) files.add(realFile);
    } catch {
      // Deleted files and paths that do not exist are irrelevant to formatting.
    }
  }
  return [...files];
}

export function formatEditedFiles(payload, root = repoRoot, run) {
  const files = formattingPaths(payload, root);
  if (!files.length || !existsSync(path.join(root, 'node_modules/oxfmt/package.json'))) return;

  // Load only after the no-op checks, so a fresh checkout needs no dependencies.
  const spawnSync = run ?? require('cross-spawn').sync;
  const result = spawnSync('corepack', ['yarn', 'exec', 'oxfmt', '--write', ...files], {
    cwd: root,
    encoding: 'utf8',
    // Formatting must not bootstrap package managers or download dependencies.
    env: { ...process.env, COREPACK_ENABLE_NETWORK: '0' },
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: 8000,
  });
  if (result.error || result.status !== 0) {
    console.error(`[agent format] Formatting failed: ${result.error?.message || result.stderr?.trim() || `exit ${result.status}`}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    // Malformed or unknown hook input must not trigger work.
  }
  if (payload) formatEditedFiles(payload);
}
