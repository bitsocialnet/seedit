import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { generatedFiles, listFiles, readFrontmatter } from '../ai-workflow-files.mjs';
import { validateWorkflow } from '../validate-ai-workflow.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seedit-workflow-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relative of ['.agents', '.codex/config.toml', '.codex/hooks.json', '.codex/hooks', '.claude/settings.json', '.claude/hooks', 'CLAUDE.md']) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(repository, relative), target, { recursive: true });
  }
  for (const [relative, content] of generatedFiles(root)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

test('shared sources generate valid, deterministic harness outputs', (t) => {
  const root = fixture(t);
  const before = generatedFiles(root);
  assert.deepEqual(generatedFiles(root), before);
  assert.equal(fs.existsSync(path.join(root, '.cursor')), false);
  const result = validateWorkflow(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.roles, 5);
  const codexTranslator = before.get('.codex/agents/translator.toml');
  assert.match(codexTranslator, /name = ['"]translator['"]/);
  assert.doesNotMatch(codexTranslator, /(?:^|\n)model\s*=/);
  assert.equal(readFrontmatter(before.get('.claude/agents/translator.md')).metadata.model, undefined);
});

test('validation detects a missing agent and obsolete compatibility files', (t) => {
  const root = fixture(t);
  fs.unlinkSync(path.join(root, '.codex/agents/reviewer.toml'));
  fs.writeFileSync(path.join(root, '.claude/agents/obsolete.md'), 'old role');
  const errors = validateWorkflow(root).errors;
  assert.ok(errors.some((error) => error.includes('reviewer.toml')));
  assert.ok(errors.some((error) => error.includes('Obsolete generated file')));
});

test('validation rejects Stop mutations even when JSON parses', (t) => {
  const root = fixture(t);
  const file = path.join(root, '.codex/hooks.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  config.hooks.Stop = [{ hooks: [{ type: 'command', command: 'git fetch --prune' }] }];
  fs.writeFileSync(file, JSON.stringify(config));
  assert.ok(validateWorkflow(root).errors.some((error) => error.includes('no Stop')));
});

test('manual invocation needs the documented Codex policy as well as Claude frontmatter', (t) => {
  const root = fixture(t);
  fs.unlinkSync(path.join(root, '.agents/skills/commit/agents/openai.yaml'));
  assert.ok(validateWorkflow(root).errors.some((error) => error.includes('Manual skill needs Codex invocation policy')));
});

test('unknown role metadata fails instead of silently changing model inheritance', (t) => {
  const root = fixture(t);
  const file = path.join(root, '.agents/roles/translator.md');
  const content = fs.readFileSync(file, 'utf8').replace('name: translator', 'name: translator\nmodel: undocumented-model');
  fs.writeFileSync(file, content);
  assert.throws(() => generatedFiles(root), /Unsupported role field model/);
});

test('duplicate legacy skill roots fail validation', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.codex/skills'));
  assert.ok(validateWorkflow(root).errors.some((error) => error.includes('Duplicate skill root')));
});

test('shared skills cannot link to retired Cursor skill paths', (t) => {
  const root = fixture(t);
  const file = '.agents/skills/commit/SKILL.md';
  fs.appendFileSync(path.join(root, file), '\nSee [commit](../../../.cursor/skills/commit/SKILL.md).\n');
  assert.ok(validateWorkflow(root).errors.includes(`Skill must reference canonical source paths: ${file}`));
});

test('logical paths use forward slashes and skill assets retain their bytes', (t) => {
  const root = fixture(t);
  const relative = '.agents/skills/commit/assets/example.bin';
  const bytes = Buffer.from([0, 255, 128, 13, 10]);
  fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  fs.writeFileSync(path.join(root, relative), bytes);
  assert.ok(listFiles(root).includes(relative));
  const outputs = generatedFiles(root);
  assert.ok([...outputs.keys()].every((key) => !key.includes('\\')));
  assert.deepEqual(outputs.get('.claude/skills/commit/assets/example.bin'), bytes);
});

test('edit hooks and wrappers reject appended lifecycle commands', (t) => {
  const root = fixture(t);
  for (const harness of ['.codex', '.claude']) {
    const configPath = path.join(root, harness, harness === '.claude' ? 'settings.json' : 'hooks.json');
    const original = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(original);
    const handler = config.hooks.PostToolUse[0].hooks[0];
    handler.command += '; git fetch --prune';
    fs.writeFileSync(configPath, JSON.stringify(config));
    assert.ok(validateWorkflow(root).errors.some((error) => error.includes('only its formatter wrapper')));
    fs.writeFileSync(configPath, original);
    const wrapper = path.join(root, harness, 'hooks/format.sh');
    const originalWrapper = fs.readFileSync(wrapper, 'utf8');
    fs.appendFileSync(wrapper, '\ngit fetch --prune\n');
    assert.ok(validateWorkflow(root).errors.some((error) => error.includes('only the shared formatter invocation')));
    fs.writeFileSync(wrapper, originalWrapper);
  }
});

test('role sources reject model settings and invalid sandbox values', (t) => {
  const root = fixture(t);
  const file = path.join(root, '.agents/roles/translator.md');
  const original = fs.readFileSync(file, 'utf8');
  for (const key of ['model', 'model_reasoning_effort', 'claude-model']) {
    fs.writeFileSync(file, original.replace('name: translator', `name: translator\n${key}: inherit`));
    assert.throws(() => generatedFiles(root), /Unsupported role field/);
  }
  fs.writeFileSync(file, original.replace('name: translator', 'name: translator\nsandbox-mode: false'));
  assert.throws(() => generatedFiles(root), /Unsupported role sandbox/);
});
