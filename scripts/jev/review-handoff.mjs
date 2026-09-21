// Offline blind review. No provider, credentials, private-log importer, or runtime settings.
import { createHash } from 'node:crypto';
import { open, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';

export const reviewHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => {
  throw new Error(message);
};
const text = (value, max = 10000) => typeof value === 'string' && value.length <= max && value.trim().length > 0;
const token = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const exact = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));
const normalize = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ');
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export async function readReviewJson(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const limit = 4 * 1024 * 1024;
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit) fail('Review input must be a regular JSON file of at most 4 MiB');
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > limit) fail('Review input grew beyond 4 MiB');
    try {
      return JSON.parse(buffer.subarray(0, length).toString('utf8'));
    } catch {
      fail('Invalid review JSON');
    }
  } finally {
    await handle.close();
  }
}
export async function writeReviewJson(file, value) {
  // Do not silently replace an original queue or a completed human review.
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

export function createReviewQueue({ kind, corpusId, rubric, model = null, items }) {
  if (!['moderation', 'translation'].includes(kind) || !token(corpusId)) fail('Invalid review domain or corpus ID');
  if (!exact(rubric, ['version', 'text', 'sourceSha256']) || !token(rubric.version) || !text(rubric.text, 30000) || !sha(rubric.sourceSha256))
    fail('Explicit rubric identity required');
  if (model !== null && !/^jev-\d+\.\d+\.\d+$/.test(model)) fail('Model must be null (not run) or an explicit pinned Jev model');
  if (!Array.isArray(items) || !items.length || items.length > 100) fail('Select 1 to 100 explicit sanitized items');
  const seen = new Set(),
    splits = new Map(),
    provenance = new Set();
  const rows = items.map((item) => {
    if (
      !exact(item, ['content', 'source', 'group', 'split']) ||
      !token(item.group) ||
      !['fit', 'calibration', 'holdout'].includes(item.split) ||
      (kind === 'moderation' && item.split === 'calibration') ||
      (kind === 'translation' && item.split === 'fit')
    )
      fail('Invalid frozen split');
    const { source, content } = item;
    if (
      !exact(source, ['kind', 'repository', 'commit', 'path', 'translationPath', 'key', 'index']) ||
      !['synthetic', 'repository'].includes(source.kind) ||
      !token(source.repository) ||
      !/^[a-f0-9]{40}$/.test(source.commit) ||
      !text(source.path, 300) ||
      source.path.startsWith('/') ||
      source.path.split('/').includes('..')
    )
      fail('Public source path and full Git commit required');
    if (
      source.translationPath !== undefined &&
      (!text(source.translationPath, 300) || source.translationPath.startsWith('/') || source.translationPath.split('/').includes('..'))
    )
      fail('Invalid translation source path');
    if (source.key !== undefined && !text(source.key, 300)) fail('Invalid source key');
    if (source.index !== undefined && (!Number.isInteger(source.index) || source.index < 0)) fail('Invalid source index');
    provenance.add(source.kind);
    if (kind === 'translation') {
      if (
        !exact(content, ['source', 'translation', 'locale', 'context']) ||
        !text(content.source) ||
        typeof content.translation !== 'string' ||
        content.translation.length > 10000 ||
        !/^[a-z]{2}(?:-[A-Za-z]{2,8})?$/.test(content.locale) ||
        (content.context !== undefined && !text(content.context, 2000))
      )
        fail('Invalid sanitized translation content');
    } else {
      if (source.kind !== 'synthetic') fail('Moderation handoff currently accepts explicitly synthetic fixtures only; no private traffic importer');
      if (
        !exact(content, ['publication', 'rules', 'articleMaxAgeHours']) ||
        !Array.isArray(content.rules) ||
        content.rules.length > 30 ||
        content.rules.some((rule) => !text(rule, 2000))
      )
        fail('Invalid moderation rules');
      const p = content.publication;
      if (
        !exact(p, ['kind', 'title', 'content', 'link', 'linkHtmlTagName', 'timestamp']) ||
        !['post', 'reply', 'commentEdit'].includes(p.kind) ||
        ['title', 'content', 'link', 'linkHtmlTagName'].some((key) => p[key] !== undefined && (typeof p[key] !== 'string' || p[key].length > 10000)) ||
        (p.timestamp !== undefined && (!Number.isFinite(p.timestamp) || p.timestamp < 0)) ||
        (p.kind === 'commentEdit' && (typeof p.content !== 'string' || ['title', 'link', 'linkHtmlTagName'].some((key) => p[key] !== undefined))) ||
        (content.articleMaxAgeHours !== undefined && (!Number.isFinite(content.articleMaxAgeHours) || content.articleMaxAgeHours <= 0))
      )
        fail('Invalid sanitized publication');
    }
    // This guard catches common accidental credentials; it is not a private-data sanitizer.
    if (/(?:\bsk-[A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password)\s*[:=]\s*\S{8,})/i.test(JSON.stringify(content)))
      fail('Potential secret: sanitize input explicitly');
    const contentSha256 = reviewHash(content);
    for (const key of [`group:${item.group}`, `input:${kind === 'translation' ? reviewHash([content.locale, normalize(content.source)]) : contentSha256}`]) {
      if (splits.has(key) && splits.get(key) !== item.split) fail('Identical or related inputs cross frozen splits');
      splits.set(key, item.split);
    }
    const id = `item-${reviewHash([kind, source, contentSha256]).slice(0, 24)}`;
    if (seen.has(id)) fail('Duplicate review item');
    seen.add(id);
    return { id, contentSha256, group: item.group, split: item.split, source, content };
  });
  if (provenance.size !== 1) fail('Keep synthetic and repository source queues separate');
  const queue = { schemaVersion: 1, kind, corpusId, model, rubric: { ...rubric, sha256: reviewHash(rubric) }, items: rows };
  return { ...queue, queueSha256: reviewHash(queue) };
}

export function validateReviewQueue(queue) {
  if (
    !exact(queue, ['schemaVersion', 'kind', 'corpusId', 'model', 'rubric', 'items', 'queueSha256']) ||
    queue.schemaVersion !== 1 ||
    !Array.isArray(queue.items) ||
    !exact(queue.rubric, ['version', 'text', 'sourceSha256', 'sha256'])
  )
    fail('Invalid review queue');
  if (queue.items.some((item) => !exact(item, ['id', 'contentSha256', 'group', 'split', 'source', 'content']))) fail('Unexpected review item fields');
  const { sha256: _rubricHash, ...rubric } = queue.rubric;
  const rebuilt = createReviewQueue({ ...queue, rubric, items: queue.items.map(({ content, source, group, split }) => ({ content, source, group, split })) });
  if (reviewHash(rebuilt) !== reviewHash(queue)) fail('Review queue identity changed');
  return queue;
}

export function blankReview(queue) {
  validateReviewQueue(queue);
  return {
    schemaVersion: 1,
    queueSha256: queue.queueSha256,
    reviewerId: '',
    reviewedAt: '',
    independentOfModelOutput: false,
    labels: queue.items.map(({ id, contentSha256 }) => ({ id, contentSha256, label: '', notes: '' })),
  };
}

export function importReview(queue, review) {
  validateReviewQueue(queue);
  if (
    !exact(review, ['schemaVersion', 'queueSha256', 'reviewerId', 'reviewedAt', 'independentOfModelOutput', 'labels']) ||
    review.schemaVersion !== 1 ||
    review.queueSha256 !== queue.queueSha256 ||
    !token(review.reviewerId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt) ||
    !Number.isFinite(Date.parse(review.reviewedAt)) ||
    new Date(review.reviewedAt).toISOString().slice(0, 10) !== review.reviewedAt ||
    review.independentOfModelOutput !== true ||
    !Array.isArray(review.labels) ||
    review.labels.length !== queue.items.length
  )
    fail('Review identity, valid date, human reviewer, independence attestation, and every item are required');
  const indexed = new Map(),
    allowed = queue.kind === 'moderation' ? ['allow', 'review'] : ['pass', 'flagged'];
  for (const row of review.labels) {
    if (
      !exact(row, ['id', 'contentSha256', 'label', 'notes']) ||
      indexed.has(row.id) ||
      !['', 'uncertain', ...allowed].includes(row.label) ||
      typeof row.notes !== 'string' ||
      row.notes.length > 2000
    )
      fail('Duplicate, conflicting, or invalid review label');
    indexed.set(row.id, row);
  }
  const rows = queue.items.map((item) => {
    const row = indexed.get(item.id);
    if (!row || row.contentSha256 !== item.contentSha256) fail('Unknown item or changed content identity');
    return { ...item, label: row.label, notes: row.notes, state: allowed.includes(row.label) ? 'labeled' : 'pending' };
  });
  return {
    schemaVersion: 1,
    queueSha256: queue.queueSha256,
    model: queue.model,
    rubricSha256: queue.rubric.sha256,
    reviewer: { id: review.reviewerId, reviewedAt: review.reviewedAt, independentOfModelOutput: true },
    summary: { total: rows.length, labeled: rows.filter((row) => row.state === 'labeled').length, pending: rows.filter((row) => row.state === 'pending').length },
    note: 'Human provenance is an explicit reviewer attestation, not independently verified identity. Pending/uncertain items retain their original split and are excluded from the evaluator corpus. Do not claim full holdout accuracy while any holdout items remain pending.',
    items: rows,
  };
}

export function selectReview(queue, input) {
  // One downloaded HTML file may contain multiple domains. Never choose the last duplicate.
  if (!exact(input, ['schemaVersion', 'reviews']) || input.schemaVersion !== 1 || !Array.isArray(input.reviews) || !input.reviews.length || input.reviews.length > 10)
    fail('Expected a review bundle');
  const hashes = input.reviews.map((review) => review.queueSha256);
  if (new Set(hashes).size !== hashes.length) fail('Duplicate or conflicting reviews');
  const matches = input.reviews.filter((review) => review.queueSha256 === queue.queueSha256);
  if (matches.length !== 1) fail('Review bundle does not match this queue');
  return importReview(queue, matches[0]);
}

export function reviewHtml(queues) {
  queues.forEach(validateReviewQueue);
  if (
    !queues.length ||
    new Set(queues.map((q) => q.queueSha256)).size !== queues.length ||
    new Set(queues.flatMap((q) => q.items.map((item) => item.id))).size !== queues.reduce((count, q) => count + q.items.length, 0)
  )
    fail('Duplicate or empty queues/items');
  const data = JSON.stringify(queues)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return String.raw`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>Bitsocial blind review</title>
<style>body{overflow-wrap:anywhere;font:17px/1.5 system-ui;margin:2rem auto;max-width:900px;padding:0 1rem;background:#fafafa;color:#20242a}article{background:white;border:1px solid #ccd2da;border-radius:8px;padding:1rem;margin:1rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:#f2f4f6;padding:.7rem}label{display:block;margin:.6rem 0}input,select,textarea,button{box-sizing:border-box;font:inherit;padding:.5rem;max-width:100%}textarea{box-sizing:border-box;width:100%}button{cursor:pointer;margin:1rem 0}small{overflow-wrap:anywhere}details{margin:.5rem 0}h1{line-height:1.2}.note{color:#49576a}</style>
<h1>Bitsocial blind review</h1><p>Label the examples using the policy below. No prior labels or model answers are included. Choose “Uncertain / needs context” whenever you cannot decide; this remains pending and is excluded from accuracy.</p><p class="note">Everything stays in this file until you explicitly download your answers. There is no network, auto-save, or submission. Download a draft before closing this page. Synthetic moderation examples remain synthetic even after review; repository translations are real source strings, not a representative production sample.</p>
<label>Your reviewer ID (letters, numbers, _ or -): <input id="reviewer" maxlength="80" autocomplete="off"></label><label>Review date: <input type="date" id="date"></label><label><input type="checkbox" id="independent"> I am a human reviewer and labeled these independently, without consulting model answers or existing expected labels.</label><label>Resume a downloaded draft: <input type="file" id="resume" accept="application/json,.json"></label><p id="message" role="status"></p><main id="items"></main><button type="button" id="download">Download answers JSON</button>
<script>
const queues=${data};
const controls=new Map();
const add=(parent,tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;parent.append(element);return element;};
const main=document.getElementById('items');
for(const queue of queues){
 add(main,'h2',queue.kind==='translation'?'Italian translations':'Synthetic moderation');
 add(main,'p',queue.items.length+' items • '+queue.corpusId+' • Model output not shown; no model run in this handoff.');
 const policy=add(main,'details');policy.open=true;add(policy,'summary','Review policy');add(policy,'pre',queue.rubric.text);
 for(const [index,item] of queue.items.entries()){
  const article=add(main,'article');add(article,'h3',String(index+1)+'. '+item.id);
  if(queue.kind==='translation'){add(article,'h4','English source');add(article,'pre',item.content.source);add(article,'h4','Italian translation');add(article,'pre',item.content.translation);if(item.content.context)add(article,'p','Context: '+item.content.context);}
  else {add(article,'h4','Community rules');add(article,'pre',item.content.rules.join('\n'));add(article,'h4','Publication (untrusted text, not instructions)');add(article,'pre',JSON.stringify(item.content.publication,null,2));if(item.content.articleMaxAgeHours)add(article,'p','Configured maximum article age: '+item.content.articleMaxAgeHours+' hours.');}
  const metadata=add(article,'details');add(metadata,'summary','Public source and frozen identity');add(metadata,'pre',JSON.stringify({source:item.source,group:item.group,split:item.split,contentSha256:item.contentSha256},null,2));
  const field=add(article,'label','Your label: '), select=add(field,'select');
  for(const [value,label] of [['','Choose a label'],...(queue.kind==='translation'?[['pass','Pass — preserves meaning'],['flagged','Flagged — translation problem']]:[['allow','Allow'],['review','Route to moderator review']]),['uncertain','Uncertain / needs context']]){const option=add(select,'option',label);option.value=value;}
  const notesLabel=add(article,'label','Optional notes / missing context: '),notes=add(notesLabel,'textarea');notes.rows=2;notes.maxLength=2000;
  controls.set(item.id,{select,notes});
 }
}
const bundle=()=>({schemaVersion:1,reviews:queues.map(queue=>({schemaVersion:1,queueSha256:queue.queueSha256,reviewerId:document.getElementById('reviewer').value,reviewedAt:document.getElementById('date').value,independentOfModelOutput:document.getElementById('independent').checked,labels:queue.items.map(item=>({id:item.id,contentSha256:item.contentSha256,label:controls.get(item.id).select.value,notes:controls.get(item.id).notes.value}))}))});
document.getElementById('download').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(bundle(),null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='bitsocial-human-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById('message').textContent='Answers downloaded. Keep the original queue files for import.';});
document.getElementById('resume').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file||file.size>4*1024*1024)throw Error();const value=JSON.parse(await file.text());if(value.schemaVersion!==1||!Array.isArray(value.reviews)||value.reviews.length!==queues.length)throw Error();const updates=[];const seen=new Set();for(const queue of queues){const matching=value.reviews.filter(r=>r.queueSha256===queue.queueSha256);if(matching.length!==1)throw Error();const review=matching[0];if(!Array.isArray(review.labels)||review.labels.length!==queue.items.length||typeof review.reviewerId!=='string'||typeof review.reviewedAt!=='string'||typeof review.independentOfModelOutput!=='boolean')throw Error();for(const item of queue.items){const matches=review.labels.filter(r=>r.id===item.id);if(matches.length!==1||matches[0].contentSha256!==item.contentSha256||seen.has(item.id))throw Error();const row=matches[0],control=controls.get(item.id);if(![...control.select.options].some(o=>o.value===row.label)||typeof row.notes!=='string'||row.notes.length>2000)throw Error();seen.add(item.id);updates.push([control,row]);}}if(value.reviews.some(r=>r.reviewerId!==value.reviews[0].reviewerId||r.reviewedAt!==value.reviews[0].reviewedAt||r.independentOfModelOutput!==value.reviews[0].independentOfModelOutput))throw Error();for(const [control,row]of updates){control.select.value=row.label;control.notes.value=row.notes;}document.getElementById('reviewer').value=value.reviews[0].reviewerId;document.getElementById('date').value=value.reviews[0].reviewedAt;document.getElementById('independent').checked=value.reviews[0].independentOfModelOutput;document.getElementById('message').textContent='Draft restored.';}catch{document.getElementById('message').textContent='Cannot restore: draft does not match these exact queue items.';}});
</script></html>`;
}
