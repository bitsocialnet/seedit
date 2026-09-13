#!/usr/bin/env node
// Checks that src/ imports follow the module boundaries described in src/AGENTS.md:
// one-way layer order, no view importing another view, no reach into another
// module's private files, and no import cycles.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

// Lower groups never import higher ones; folders in the same group may import each other.
const LAYER_GROUPS = [['constants', 'data'], ['lib', 'plugins'], ['stores'], ['hooks'], ['components'], ['views'], ['app']];
const LAYER_ORDER = LAYER_GROUPS.map((group) => group.join('/')).join(' -> ');
// Category folders are not modules; the first folder inside one is.
const CATEGORIES = ['lib/utils', 'lib', 'views', 'components', 'hooks', 'stores', 'constants', 'data', 'plugins'];
// Folders of static data are not modules either, so their files may be imported directly.
const DATA_CATEGORIES = new Set(['data']);
const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const CHECKED_TARGET = /\.(?:[cm]?[jt]sx?|css|json)$/;
const RESOLUTIONS = ['', '.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

const isTest = (file) => /(?:^|\/)__tests__\/|\.test\.[cm]?[jt]sx?$|(?:^|\/)test-utils?\//.test(file);

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath, files);
    else if (SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(entryPath);
  }
  return files;
}

function layerOf(file) {
  if (!file.includes('/')) return 'app';
  const [head] = file.split('/');
  return LAYER_GROUPS.findIndex((group) => group.includes(head));
}

function rankOf(file) {
  const layer = layerOf(file);
  return layer === 'app' ? LAYER_GROUPS.length - 1 : layer;
}

function layerName(file) {
  return file.includes('/') ? file.split('/')[0] : 'app';
}

// Splits "components/post/embed/index.ts" into { category: "components", inside: ["post", "embed", "index.ts"] }.
function locate(file) {
  const category = CATEGORIES.find((candidate) => file.startsWith(`${candidate}/`));
  if (!category) return null;
  return { category, inside: file.slice(category.length + 1).split('/') };
}

// Reads static imports, re-exports, dynamic import() and require() from the parsed AST,
// so comments, strings and multi-line clauses cannot produce phantom imports.
function readImports(file, source) {
  const { program, errors } = parseSync(file, source);
  if (errors.length) throw new Error(`Cannot parse ${file}: ${errors[0].message}`);
  const imports = [];
  const record = (literal) => {
    if (!literal || literal.type !== 'Literal' || typeof literal.value !== 'string') return;
    imports.push({ specifier: literal.value, line: source.slice(0, literal.start).split('\n').length });
  };
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') record(node.source);
    else if (node.type === 'ImportExpression') record(node.source);
    else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') record(node.arguments[0]);
    for (const key of Object.keys(node)) if (key !== 'type') visit(node[key]);
  };
  visit(program);
  return imports;
}

function resolveImport(srcDir, importer, specifier) {
  const cleaned = specifier.replace(/[?#].*$/, '');
  let base;
  if (cleaned.startsWith('.')) base = path.resolve(path.dirname(path.join(srcDir, importer)), cleaned);
  else if (cleaned.startsWith('@/')) base = path.join(srcDir, cleaned.slice(2));
  else return null;
  // TypeScript sources may be imported with their emitted .js extension.
  const candidates = [base, ...(/\.[cm]?jsx?$/.test(base) ? [base.replace(/\.([cm]?)jsx?$/, '.$1ts'), base.replace(/\.[cm]?jsx?$/, '.tsx')] : [])];
  for (const candidate of candidates) {
    for (const suffix of RESOLUTIONS) {
      const target = candidate + suffix;
      if (fs.existsSync(target) && fs.statSync(target).isFile()) {
        const relative = path.relative(srcDir, target).split(path.sep).join('/');
        return relative.startsWith('..') ? null : relative;
      }
    }
  }
  return null;
}

// Turns a strongly connected component into one real import path that starts and ends at its first member,
// following imports in file order so the message names the edges a reader will find.
function cyclePath(graph, component) {
  const members = new Set(component);
  const [start] = component;
  const visited = new Set([start]);
  const search = (node, trail) => {
    for (const next of graph.get(node)) {
      if (next === start) return [...trail, start];
      if (!members.has(next) || visited.has(next)) continue;
      visited.add(next);
      const found = search(next, [...trail, next]);
      if (found) return found;
    }
    return null;
  };
  return search(start, [start]) || [...component, start];
}

export function checkModuleBoundaries(srcDir) {
  const files = walk(srcDir).map((file) => path.relative(srcDir, file).split(path.sep).join('/'));
  const violations = [];
  const graph = new Map(files.map((file) => [file, new Set()]));
  let edges = 0;

  for (const importer of files) {
    const source = fs.readFileSync(path.join(srcDir, importer), 'utf8');
    for (const { specifier, line } of readImports(importer, source)) {
      const target = resolveImport(srcDir, importer, specifier);
      if (!target || target === importer) continue;
      edges += 1;
      if (graph.has(target)) graph.get(importer).add(target);
      if (isTest(importer) || !CHECKED_TARGET.test(target)) continue;
      // One finding per import: the layer rule explains the problem best, then view-to-view, then private-module.
      let reported = false;
      const report = (rule, message) => {
        if (reported) return;
        reported = true;
        violations.push({ file: importer, line, specifier, target, rule, message });
      };

      if (rankOf(importer) < rankOf(target)) {
        report('layer', `${layerName(importer)} must not import from ${layerName(target)}; dependencies flow ${LAYER_ORDER}`);
      }

      const from = locate(importer);
      const to = locate(target);
      if (from?.category === 'views' && to?.category === 'views' && from.inside[0] !== to.inside[0]) {
        report('view-to-view', 'a view must not import another view; move shared code to components/, hooks/, or lib/');
      }

      if (to && to.inside.length >= 2 && !DATA_CATEGORIES.has(to.category)) {
        const module = `${to.category}/${to.inside[0]}`;
        const targetDir = path.posix.dirname(target);
        const owner = to.inside.length === 2 ? module : path.posix.dirname(targetDir);
        const importerDir = path.posix.dirname(importer);
        const insideOwner = importerDir === owner || importerDir.startsWith(`${owner}/`);
        const entry = to.inside.length === 2 && /^index\.[cm]?[jt]sx?$/.test(to.inside[1]);
        if (!insideOwner && !entry) {
          report(
            'private-module',
            to.inside.length === 2
              ? `${module} exposes only its index; import the module, not ${to.inside[1]}`
              : `${targetDir} is private to ${owner}; promote it to ${to.category}/${path.posix.basename(targetDir)} if it is shared`,
          );
        }
      }
    }
  }

  // Tarjan's strongly connected components over non-test files.
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const cycles = [];
  let counter = 0;
  const connect = (node) => {
    index.set(node, counter);
    low.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node)) {
      if (isTest(next)) continue;
      if (!index.has(next)) {
        connect(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (onStack.has(next)) low.set(node, Math.min(low.get(node), index.get(next)));
    }
    if (low.get(node) !== index.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    if (component.length > 1) cycles.push(cyclePath(graph, component.sort()));
  };
  for (const file of files) if (!isTest(file) && !index.has(file)) connect(file);
  for (const cycle of cycles) {
    violations.push({ file: cycle[0], line: 0, specifier: '', target: '', rule: 'cycle', message: `import cycle: ${cycle.join(' -> ')}` });
  }

  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { files: files.length, edges, violations };
}

export function formatViolation(srcLabel, violation) {
  const location = violation.line ? `${srcLabel}/${violation.file}:${violation.line}` : `${srcLabel}/${violation.file}`;
  const detail = violation.specifier ? ` imports '${violation.specifier}': ` : ' ';
  return `${location}${detail}${violation.message} [${violation.rule}]`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const srcDir = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src'));
  const srcLabel = path.relative(process.cwd(), srcDir) || '.';
  const { files, edges, violations } = checkModuleBoundaries(srcDir);
  for (const violation of violations) console.error(formatViolation(srcLabel, violation));
  const summary = `[module boundaries] ${srcLabel}: ${files} files, ${edges} internal imports, ${violations.length} violation(s)`;
  if (violations.length) {
    console.error(`${summary}. See src/AGENTS.md, "Module boundaries".`);
    process.exitCode = 1;
  } else console.log(summary);
}
