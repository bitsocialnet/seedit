import fs from 'node:fs';
import path from 'node:path';
import { load as loadYaml, dump as dumpYaml } from 'js-yaml';
import { stringify as stringifyToml } from 'smol-toml';

export function readFrontmatter(content, label) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`Missing YAML frontmatter: ${label}`);
  const metadata = loadYaml(match[1]);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`Expected frontmatter mapping: ${label}`);
  }
  return { metadata, body: content.slice(match[0].length).trim() };
}

export function listFiles(root, relative = '') {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const name = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Use portable generated copies, not symlinks: ${path.join(root, name)}`);
      return entry.isDirectory() ? listFiles(root, name) : [name];
    });
}

export function generatedFiles(root) {
  const files = new Map();
  const skills = path.join(root, '.agents/skills');
  for (const relative of listFiles(skills)) {
    let content = fs.readFileSync(path.join(skills, relative));
    if (path.basename(relative) === 'SKILL.md') {
      content = content.toString('utf8');
      readFrontmatter(content, relative);
      content = content.replace(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/, `$1\n<!-- Generated from .agents/skills/${relative}; run yarn ai-workflow:sync. -->\n`);
    }
    files.set(path.posix.join('.claude/skills', relative), content);
  }
  const roles = path.join(root, '.agents/roles');
  for (const relative of listFiles(roles)) {
    if (!relative.endsWith('.md')) throw new Error(`Unexpected role source: ${relative}`);
    const { metadata, body } = readFrontmatter(fs.readFileSync(path.join(roles, relative), 'utf8'), relative);
    const allowed = new Set(['name', 'description', 'sandbox-mode']);
    for (const key of Object.keys(metadata)) {
      if (!allowed.has(key)) throw new Error(`Unsupported role field ${key}: ${relative}`);
    }
    if ('sandbox-mode' in metadata && !['read-only', 'workspace-write'].includes(metadata['sandbox-mode'])) {
      throw new Error(`Unsupported role sandbox: ${relative}`);
    }
    const { name, description } = metadata;
    if (name !== path.basename(relative, '.md') || !/^[a-z][a-z0-9-]*$/.test(name) || typeof description !== 'string' || !description.trim() || !body) {
      throw new Error(`Role needs a matching name, description and instructions: ${relative}`);
    }
    const source = `.agents/roles/${relative}`;
    const codex = { name, description, developer_instructions: body };
    if (metadata['sandbox-mode']) codex.sandbox_mode = metadata['sandbox-mode'];
    files.set(`.codex/agents/${name}.toml`, `# Generated from ${source}; run yarn ai-workflow:sync.\n${stringifyToml(codex)}`);
    const frontmatter = { name, description };
    if (metadata['sandbox-mode'] === 'read-only') frontmatter.tools = 'Bash, Read, Grep, Glob';
    files.set(
      `.claude/agents/${name}.md`,
      `---\n${dumpYaml(frontmatter, { lineWidth: -1 }).trimEnd()}\n---\n\n<!-- Generated from ${source}; run yarn ai-workflow:sync. -->\n\n${body}\n`,
    );
  }
  return files;
}
