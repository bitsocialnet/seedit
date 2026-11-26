// Renders src/static-shell.tsx for every variant and prints { variants, uiMode } as JSON.
// It runs in its own process because it installs jsdom browser globals, which must not leak
// into the Vite build that invokes it (scripts/vite-static-shell.mjs).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createServer, loadConfigFromFile } from 'vite';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const variants = JSON.parse(process.argv[2] || '{}');

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', { url: 'http://localhost/#/', pretendToBeVisual: true });
// jsdom has neither matchMedia nor ResizeObserver, and components use them on mount (boneyard-js's skeleton
// listens for OS theme changes and measures its container). No media query matches, as for a visitor with no
// reduced-motion or color-scheme preference, and nothing resizes during the render.
dom.window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
dom.window.matchMedia = (media) => ({
  matches: false,
  media,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
});
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (!(key in globalThis)) globalThis[key] = dom.window[key];
}
for (const key of ['window', 'self', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, key, { value: key === 'window' || key === 'self' ? dom.window : dom.window[key], configurable: true, writable: true });
}
// React's first commit in the browser happens before bitsocial-react-hooks has loaded or generated an
// account. The library skips its import-time account initialization when this flag is set, so the
// shell keeps that empty state instead of baking a build-time account into index.html.
dom.window.BITSOCIAL_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZED_ONCE = true;

// App modules log on import (notification setup, deprecation notices); only the JSON result belongs on stdout.
const write = process.stdout.write.bind(process.stdout);
console.log = console.info = console.warn = console.debug = () => {};
process.on('unhandledRejection', () => {
  // Storage-backed stores start async initialization on import; jsdom has no IndexedDB and the render does not need it.
});

// The browser build aliases Node built-ins to polyfills; under Node the built-ins work natively.
const { config } = await loadConfigFromFile({ command: 'serve', mode: 'production' }, path.join(packageRoot, 'vite.config.js'));
const nodeBuiltinAliases = new Set(['stream', 'crypto', 'buffer', 'util/', 'util', 'assert', 'node-fetch']);
const server = await createServer({
  configFile: false,
  root: packageRoot,
  mode: 'production',
  plugins: [(await import('@vitejs/plugin-react')).default()],
  // build:profile also aliases react-dom/client to react-dom/profiling for the browser bundle; the SSR module
  // runner would inline that CommonJS entry and fail on `module`, and the shell does not need profiling.
  resolve: { alias: config.resolve.alias.filter((entry) => !nodeBuiltinAliases.has(entry.find) && entry.replacement !== 'react-dom/profiling') },
  define: config.define,
  css: config.css,
  server: { middlewareMode: true, hmr: false, watch: null, ws: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { renderStaticShell, STATIC_SHELL_UI_MODE } = await server.ssrLoadModule('/src/static-shell.tsx');
  const rendered = {};
  for (const [name, variant] of Object.entries(variants)) rendered[name] = await renderStaticShell(variant);
  write(JSON.stringify({ variants: rendered, uiMode: STATIC_SHELL_UI_MODE }));
} finally {
  await server.close();
}
process.exit(0);
