import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { STATIC_SHELL_ATTRIBUTE, STATIC_SHELL_VARIANTS, injectStaticShell, inlineStartupStylesheets } from '../vite-static-shell.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ATTRIBUTE = 'data-seedit-app-preload';

test('inlines startup stylesheets in place and keeps a disabled link for the runtime helper', () => {
  const html = [
    `<link rel="modulepreload" crossorigin href="./assets/app-A.js" ${ATTRIBUTE}>`,
    `<link rel="preload" as="style" crossorigin href="./assets/app-B.css" ${ATTRIBUTE}>`,
    '<link rel="stylesheet" href="./assets/other.css">',
  ].join('');
  const css = '.a{background:url(../assets/buttons/x.png)}.b{background:url("data:image/png;base64,AA")}.c{background:url(/abs.png)}';
  const output = inlineStartupStylesheets(html, ATTRIBUTE, './', (fileName) => {
    assert.equal(fileName, 'assets/app-B.css');
    return css;
  });
  assert.equal(
    output,
    [
      `<link rel="modulepreload" crossorigin href="./assets/app-A.js" ${ATTRIBUTE}>`,
      '<style>.a{background:url(assets/buttons/x.png)}.b{background:url("data:image/png;base64,AA")}.c{background:url(/abs.png)}</style>',
      `<link rel="stylesheet" crossorigin href="./assets/app-B.css" ${ATTRIBUTE} disabled>`,
      '<link rel="stylesheet" href="./assets/other.css">',
    ].join(''),
  );
  assert.throws(() => inlineStartupStylesheets(html, ATTRIBUTE, './', () => '</style><script>'), /cannot be inlined/);
});

test('adds the shell templates and insertion script after an empty root', () => {
  const output = injectStaticShell('<body><div id="root"></div></body>', { 'desktop-light': '<div class="app">shell</div>' }, 'modern');
  assert.match(output, /<div id="root"><\/div><template id="static-shell-desktop-light"><div class="app">shell<\/div><\/template><script>/);
  assert.throws(() => injectStaticShell('<body><div id="root">x</div></body>', {}, 'modern'), /no empty/);
  assert.throws(() => injectStaticShell('<body><div id="root"></div></body>', {}, undefined), /unknown ui mode/);
  assert.throws(() => injectStaticShell('<body><div id="root"></div></body>', { 'desktop-light': '' }, 'modern'), /desktop-light variant rendered nothing/);
});

const variants = { 'desktop-light': 'desktop light', 'desktop-dark': 'desktop dark', 'mobile-light': 'mobile light', 'mobile-dark': 'mobile dark' };

const loadWithShell = ({ search = '', hash = '', storage = {}, languages = ['en-US'], width = 1280, uiMode = 'modern' } = {}) => {
  const markup = Object.fromEntries(Object.entries(variants).map(([name, text]) => [name, `<div class="app">${text}</div>`]));
  const html = injectStaticShell('<!doctype html><html><body><div id="root"></div></body></html>', markup, uiMode);
  const dom = new JSDOM(html, { url: `https://seedit.test/${search}${hash}`, runScripts: 'outside-only' });
  for (const [key, value] of Object.entries(storage)) dom.window.localStorage.setItem(key, value);
  Object.defineProperty(dom.window.navigator, 'languages', { value: languages });
  Object.defineProperty(dom.window, 'innerWidth', { value: width });
  // Run the inline script as the parser would, now that storage and the viewport are set.
  dom.window.eval(dom.window.document.querySelector('body > script').textContent);
  const shell = dom.window.document.getElementById('root').firstElementChild;
  return shell?.hasAttribute(STATIC_SHELL_ATTRIBUTE) ? `${shell.textContent} / body ${dom.window.document.body.className}` : 'no shell';
};

test('shows the shell variant matching the visitor on the home page', () => {
  assert.equal(loadWithShell(), 'desktop light / body light');
  assert.equal(loadWithShell({ hash: '#/', storage: { theme: 'dark' } }), 'desktop dark / body dark');
  assert.equal(loadWithShell({ width: 375 }), 'mobile light / body light');
  assert.equal(loadWithShell({ storage: { i18nextLng: 'en' }, languages: ['fr-FR'] }), 'desktop light / body light');
  assert.equal(loadWithShell({ storage: { uiMode: 'modern' } }), 'desktop light / body light');
  assert.equal(loadWithShell({ uiMode: 'old', storage: { uiMode: 'old' } }), 'desktop light / body light');
  assert.equal(loadWithShell({ storage: { modernNavCollapsed: 'false' } }), 'desktop light / body light');
  assert.equal(loadWithShell({ uiMode: 'old', storage: { uiMode: 'old', modernNavCollapsed: 'true' } }), 'desktop light / body light');
});

test('skips the shell when the first frame would differ', () => {
  assert.equal(loadWithShell({ hash: '#/s/all' }), 'no shell');
  assert.equal(loadWithShell({ languages: ['de-DE', 'en'] }), 'no shell');
  assert.equal(loadWithShell({ storage: { i18nextLng: 'de' } }), 'no shell');
  assert.equal(loadWithShell({ storage: { theme: 'sepia' } }), 'no shell');
  assert.equal(loadWithShell({ storage: { uiMode: 'old' } }), 'no shell');
  assert.equal(loadWithShell({ uiMode: 'old', storage: { uiMode: 'modern' } }), 'no shell');
  assert.equal(loadWithShell({ search: '?ui=old' }), 'no shell');
  assert.equal(loadWithShell({ storage: { 'content-options': '{"state":{"hideDefaultCommunities":true},"version":0}' } }), 'no shell');
  assert.equal(loadWithShell({ storage: { modernNavCollapsed: 'true' } }), 'no shell');
});

test('renders the shell in a build:profile environment', () => {
  const variant = { 'desktop-light': STATIC_SHELL_VARIANTS['desktop-light'] };
  const output = execFileSync(process.execPath, [path.join(packageRoot, 'scripts/static-shell/render.mjs'), JSON.stringify(variant)], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: { ...process.env, REACT_PERF_PROFILE: '1' },
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.match(JSON.parse(output).variants['desktop-light'], /^<div class="[^"]*\blight\b/);
});
