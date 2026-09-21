import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createReviewQueue,
  validateReviewQueue,
  blankReview,
  importReview,
  selectReview,
  reviewHash,
  reviewHtml,
  writeReviewJson,
  readReviewJson,
} from '../review-handoff.mjs';

const item = (changes = {}) => ({
  source: {
    kind: 'repository',
    repository: 'test-repo',
    commit: 'a'.repeat(40),
    path: 'public/translations/en/default.json',
    translationPath: 'public/translations/it/default.json',
    key: 'test',
  },
  content: { locale: 'it', source: 'Do not share your password.', translation: 'Non condividere la tua password.' },
  group: 'group-one',
  split: 'calibration',
  ...changes,
});
const create = (items = [item()]) =>
  createReviewQueue({
    kind: 'translation',
    corpusId: 'blind-test',
    rubric: { version: 'test-v1', text: 'Check semantic meaning.', sourceSha256: 'b'.repeat(64) },
    items,
  });
const reviewed = (queue, label = 'pass') => ({
  ...blankReview(queue),
  reviewerId: 'test-human',
  reviewedAt: '2026-09-21',
  independentOfModelOutput: true,
  labels: queue.items.map(({ id, contentSha256 }) => ({ id, contentSha256, label, notes: '' })),
});

test('queue and blank export contain no prior expectations or provider answers', () => {
  const queue = create();
  assert.equal(validateReviewQueue(queue), queue);
  assert.equal(queue.model, null);
  assert.equal(blankReview(queue).labels[0].label, '');
  assert.equal(blankReview(queue).independentOfModelOutput, false);
  assert.throws(() => create([item({ content: { ...item().content, expected: 'pass', answers: {} } })]), /sanitized/);
  assert.throws(() => create([item({ expected: 'pass' })]), /split/);
});
test('same normalized English source across repositories cannot cross split', () => {
  const second = item({
    source: { ...item().source, repository: 'other' },
    content: { ...item().content, source: ' Do not share   your password. ' },
    group: 'other',
    split: 'holdout',
  });
  assert.throws(() => create([item(), second]), /cross frozen splits/);
  second.split = 'calibration';
  assert.equal(create([item(), second]).items.length, 2);
});
test('related groups remain in one split, duplicate items rejected', () => {
  assert.throws(() => create([item(), item()]), /Duplicate/);
  assert.throws(() => create([item(), item({ content: { ...item().content, source: 'Other source' }, split: 'holdout' })]), /cross frozen splits/);
});
test('queue content, model, rubric and split identities cannot change under an existing review', () => {
  const queue = create(),
    response = reviewed(queue);
  for (const alter of [
    (q) => (q.model = 'jev-9.0.0'),
    (q) => (q.items[0].split = 'holdout'),
    (q) => (q.items[0].content.translation = 'Changed'),
    (q) => (q.rubric.text = 'Changed'),
  ]) {
    const changed = structuredClone(queue);
    alter(changed);
    assert.throws(() => importReview(changed, response), /identity changed/);
  }
  const newQueue = create([item({ split: 'holdout' })]);
  assert.throws(() => importReview(newQueue, response), /identity/);
});
test('human provenance requires reviewer/date and independent attestation', () => {
  const queue = create();
  for (const changes of [{ reviewerId: '' }, { reviewerId: 'has spaces' }, { reviewedAt: '2026-02-30' }, { independentOfModelOutput: false }])
    assert.throws(() => importReview(queue, { ...reviewed(queue), ...changes }), /attestation/);
});
test('uncertain and blank remain pending with their original holdout identity', () => {
  const queue = create([item({ split: 'holdout' })]);
  for (const label of ['', 'uncertain']) {
    const result = importReview(queue, reviewed(queue, label));
    assert.deepEqual(result.summary, { total: 1, labeled: 0, pending: 1 });
    assert.equal(result.items[0].split, 'holdout');
    assert.equal(result.items[0].contentSha256, queue.items[0].contentSha256);
  }
});
test('missing, unknown, duplicate, and conflicting labels do not silently pass', () => {
  const queue = create([item(), item({ source: { ...item().source, key: 'other' } })]);
  let response = reviewed(queue);
  response.labels.pop();
  assert.throws(() => importReview(queue, response), /every item/);
  response = reviewed(queue);
  response.labels[1] = { ...response.labels[0], label: 'flagged' };
  assert.throws(() => importReview(queue, response), /Duplicate/);
  response = reviewed(queue);
  response.labels[0].id = 'unknown';
  assert.throws(() => importReview(queue, response), /Unknown item/);
  response = reviewed(queue);
  response.labels[0].contentSha256 = 'c'.repeat(64);
  assert.throws(() => importReview(queue, response), /content identity/);
  assert.throws(() => selectReview(queue, { schemaVersion: 1, reviews: [reviewed(queue), reviewed(queue, 'flagged')] }), /conflicting/);
});
test('source provenance is preserved and synthetic/source mixing is refused', () => {
  const synthetic = item({ source: { ...item().source, kind: 'synthetic' } });
  const queue = create([synthetic]);
  assert.equal(importReview(queue, reviewed(queue)).items[0].source.kind, 'synthetic');
  assert.throws(() => create([item(), synthetic]), /separate/);
});
test('HTML is offline, escaped, syntactically valid, and has no model label leak', () => {
  const queue = create([item({ content: { ...item().content, translation: '</script><img src=x onerror=alert(1)>' } })]);
  const html = reviewHtml([queue]);
  assert.equal(html.includes('</script><img'), false);
  assert.equal(html.includes('innerHTML'), false);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.equal((html.match(/<script>/g) || []).length, 1);
  new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
});
test('obvious secrets and unbounded inputs are rejected without reading credentials', () => {
  assert.throws(() => create([item({ content: { ...item().content, source: 'api_key=abcdefghijklmno' } })]), /secret/);
  assert.throws(() => create(Array.from({ length: 101 }, item)), /100/);
});
test('JSON writes refuse overwrite of original or submitted review files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blind-review-'));
  try {
    const file = join(directory, 'review.json');
    await writeReviewJson(file, { test: true });
    assert.deepEqual(await readReviewJson(file), { test: true });
    await assert.rejects(writeReviewJson(file, {}), { code: 'EEXIST' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rendered page exports importer-compatible answers and safely restores a draft', async () => {
  const { createContext } = await import('node:vm');
  const q = create(),
    html = reviewHtml([q]);
  const elements = [];
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.listeners = {};
      this.value = '';
      this.checked = false;
      elements.push(this);
    }
    append(child) {
      this.children.push(child);
    }
    get options() {
      return this.children;
    }
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    }
    click() {}
  }
  const ids = Object.fromEntries(['items', 'reviewer', 'date', 'independent', 'download', 'message', 'resume'].map((id) => [id, new Element(id)]));
  let downloaded;
  const context = createContext({
    document: { getElementById: (id) => ids[id], createElement: (tag) => new Element(tag) },
    Blob,
    URL: {
      createObjectURL: (blob) => {
        downloaded = blob;
        return 'blob:local';
      },
      revokeObjectURL() {},
    },
    setTimeout: (callback) => callback(),
  });
  new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]).runInContext(context);
  ids.reviewer.value = 'test-human';
  ids.date.value = '2026-09-21';
  ids.independent.checked = true;
  elements.find((element) => element.tag === 'select').value = 'uncertain';
  ids.download.listeners.click();
  const draft = JSON.parse(await downloaded.text());
  assert.equal(selectReview(q, draft).summary.pending, 1);
  ids.reviewer.value = '';
  await ids.resume.listeners.change({ target: { files: [{ size: 2000, text: async () => JSON.stringify(draft) }] } });
  assert.equal(ids.reviewer.value, 'test-human');
  assert.equal(ids.message.textContent, 'Draft restored.');
  draft.reviews[0].labels[0].contentSha256 = 'c'.repeat(64);
  await ids.resume.listeners.change({ target: { files: [{ size: 2000, text: async () => JSON.stringify(draft) }] } });
  assert.match(ids.message.textContent, /Cannot restore/);
});

test('bounded JSON reader rejects oversized files, symlinks, directories, and FIFOs', async () => {
  const { writeFile, symlink } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'review-reader-'));
  try {
    const file = join(directory, 'data.json');
    await writeFile(file, 'x'.repeat(4 * 1024 * 1024 + 1));
    await assert.rejects(readReviewJson(file), /4 MiB/);
    await writeFile(file, '{}');
    await symlink(file, join(directory, 'alias.json'));
    await assert.rejects(readReviewJson(join(directory, 'alias.json')));
    await assert.rejects(readReviewJson(directory), /regular/);
    if (process.platform !== 'win32') {
      const fifo = join(directory, 'pipe');
      execFileSync('mkfifo', [fifo]);
      await assert.rejects(readReviewJson(fifo), /regular/);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('combined HTML rejects a repeated item even in differently named queues', () => {
  const q = create();
  const other = createReviewQueue({
    kind: q.kind,
    corpusId: 'other-corpus',
    rubric: { version: 'test-v1', text: 'Check semantic meaning.', sourceSha256: 'b'.repeat(64) },
    items: [item()],
  });
  assert.throws(() => reviewHtml([q, other]), /Duplicate/);
});
