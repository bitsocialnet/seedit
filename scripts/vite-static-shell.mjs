// Puts a static copy of the home page's first frame into build/index.html so a first visit paints
// the page while the startup JavaScript is still downloading (several seconds on a slow phone).
//
// scripts/static-shell/render.mjs renders the real App (src/static-shell.tsx) in jsdom for each
// theme and layout breakpoint. Each result goes into a <template>; a small inline script inserts
// the one matching the visitor before first paint, and React replaces it on its first commit.
// The script only inserts a shell when that commit will render the same frame: the home route,
// an English UI, a known theme, and default content options. Everyone else sees exactly what they
// saw before.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATIC_SHELL_ATTRIBUTE = 'data-static-shell';

// Keys are `${layout}-${theme}`; the inline script picks the layout with the same 640px
// breakpoint as src/stores/use-window-dimensions-store.ts.
export const STATIC_SHELL_VARIANTS = {
  'desktop-light': { theme: 'light', width: 1280, height: 900 },
  'desktop-dark': { theme: 'dark', width: 1280, height: 900 },
  'mobile-light': { theme: 'light', width: 375, height: 812 },
  'mobile-dark': { theme: 'dark', width: 375, height: 812 },
};

// Mirrors the startup state the shell was rendered for: src/stores/use-theme-store.ts reads
// localStorage "theme", i18next-browser-languagedetector checks ?lng=, the i18next cookie, then
// cached i18nextLng values before the browser languages, and the persisted content options store
// ("content-options", written only once a user changes an option) filters the top bar's links.
const insertShellScript = `(function () {
  try {
    if (location.hash && location.hash !== '#' && location.hash !== '#/') return;
    var theme = localStorage.getItem('theme') || 'light';
    if (theme !== 'light' && theme !== 'dark') return;
    if (localStorage.getItem('content-options') !== null) return;
    var cookie = document.cookie.match(/(?:^|;\\s*)i18next=([^;]*)/);
    var language =
      new URLSearchParams(location.search).get('lng') ||
      (cookie && cookie[1]) ||
      localStorage.getItem('i18nextLng') ||
      sessionStorage.getItem('i18nextLng') ||
      (navigator.languages && navigator.languages[0]) ||
      navigator.language ||
      '';
    if (!/^en(-|$)/i.test(language)) return;
    var root = document.getElementById('root');
    var template = document.getElementById('static-shell-' + (window.innerWidth < 640 ? 'mobile' : 'desktop') + '-' + theme);
    if (!root || !template || root.firstChild) return;
    root.appendChild(template.content.cloneNode(true));
    root.firstElementChild.setAttribute('${STATIC_SHELL_ATTRIBUTE}', '');
    document.body.classList.add(theme);
  } catch (error) {
    // Without the shell the page loads exactly as it did before.
  }
})();`;

// Relative url() references in a stylesheet resolve against its own directory; once inlined they
// resolve against the document, so rewrite them to the same files.
const rebaseCssUrls = (css, stylesheetDirectory) =>
  css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, url) =>
    /^(?:[a-z]+:|\/|#)/i.test(url) ? match : `url(${quote}${path.posix.normalize(path.posix.join(stylesheetDirectory, url))}${quote})`,
  );

// The shell needs its styles for the first paint. Fetching the startup stylesheets would make that
// paint wait for them behind the startup JavaScript, so their rules are inlined in the same order.
// Each keeps a disabled <link> with its URL: disabled stylesheets are not fetched, and Vite's runtime
// helper skips inserting a stylesheet that is already linked, so the file is never loaded twice.
export function inlineStartupStylesheets(html, preloadAttribute, base, readAsset) {
  return html.replace(new RegExp(`<link\\b[^>]*\\s${preloadAttribute}\\b[^>]*>`, 'g'), (tag) => {
    if (!/\brel="preload" as="style"/.test(tag)) return tag;
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (!href?.startsWith(base)) throw new Error(`static shell: unexpected stylesheet URL ${href}`);
    const fileName = href.slice(base.length);
    const css = rebaseCssUrls(readAsset(fileName), path.posix.dirname(fileName));
    if (css.includes('</style')) throw new Error(`static shell: ${fileName} cannot be inlined`);
    return `<style>${css}</style>${tag.replace(/\brel="preload" as="style"/, 'rel="stylesheet"').replace(/>$/, ' disabled>')}`;
  });
}

export function injectStaticShell(html, variants) {
  if (!html.includes('<div id="root"></div>')) throw new Error('static shell: index.html has no empty <div id="root"></div>');
  const templates = Object.entries(variants)
    .map(([name, markup]) => `<template id="static-shell-${name}">${markup}</template>`)
    .join('');
  // A replacer function keeps `$` sequences in the rendered markup literal.
  return html.replace('<div id="root"></div>', () => `<div id="root"></div>${templates}<script>${insertShellScript}</script>`);
}

export function staticShellPlugin({ preloadAttribute }) {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let base = '/';
  return {
    name: 'seedit-static-shell',
    apply: 'build',
    // After vite:build-html has emitted index.html with every plugin's tags.
    enforce: 'post',
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') return;
      const output = execFileSync(process.execPath, [path.join(packageRoot, 'scripts/static-shell/render.mjs'), JSON.stringify(STATIC_SHELL_VARIANTS)], {
        cwd: packageRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      const { variants } = JSON.parse(output);
      const readAsset = (fileName) => {
        const asset = bundle[fileName];
        if (!asset || asset.type !== 'asset') throw new Error(`static shell: ${fileName} is not in the bundle`);
        return String(asset.source);
      };
      index.source = injectStaticShell(inlineStartupStylesheets(String(index.source), preloadAttribute, base, readAsset), variants);
    },
  };
}
