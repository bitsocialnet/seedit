import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_PRELOAD_ATTRIBUTE, collectDynamicEntryDependencies, createDynamicEntryPreloadTags, dynamicEntryPreloadPlugin } from '../vite-app-preload.mjs';

const chunk = (fileName, { facadeModuleId, imports = [], dynamicImports = [], importedCss = [] } = {}) => ({
  type: 'chunk',
  fileName,
  facadeModuleId,
  imports,
  dynamicImports,
  viteMetadata: { importedCss: new Set(importedCss), importedAssets: new Set() },
});

const createBundle = () => ({
  'assets/index-AAAAAAAA.js': chunk('assets/index-AAAAAAAA.js', {
    facadeModuleId: '/repo/src/index.tsx',
    imports: ['assets/vendor-BBBBBBBB.js'],
    dynamicImports: ['assets/app-CCCCCCCC.js'],
    importedCss: ['assets/index-DDDDDDDD.css'],
  }),
  'assets/vendor-BBBBBBBB.js': chunk('assets/vendor-BBBBBBBB.js'),
  'assets/app-CCCCCCCC.js': chunk('assets/app-CCCCCCCC.js', {
    facadeModuleId: '/repo/src/app.tsx',
    imports: ['assets/vendor-BBBBBBBB.js', 'assets/index-AAAAAAAA.js', 'assets/hooks-EEEEEEEE.js', 'assets/posts-FFFFFFFF.js'],
    dynamicImports: ['assets/reply-modal-GGGGGGGG.js'],
    importedCss: ['assets/app-HHHHHHHH.css'],
  }),
  'assets/hooks-EEEEEEEE.js': chunk('assets/hooks-EEEEEEEE.js', { imports: ['assets/crypto-IIIIIIII.js'], dynamicImports: ['assets/pkc-js-JJJJJJJJ.js'] }),
  'assets/crypto-IIIIIIII.js': chunk('assets/crypto-IIIIIIII.js'),
  'assets/posts-FFFFFFFF.js': chunk('assets/posts-FFFFFFFF.js', { imports: ['assets/crypto-IIIIIIII.js'], importedCss: ['assets/posts-KKKKKKKK.css'] }),
  'assets/reply-modal-GGGGGGGG.js': chunk('assets/reply-modal-GGGGGGGG.js', { importedCss: ['assets/reply-modal-LLLLLLLL.css'] }),
  'assets/pkc-js-JJJJJJJJ.js': chunk('assets/pkc-js-JJJJJJJJ.js'),
  'assets/app-HHHHHHHH.css': { type: 'asset', fileName: 'assets/app-HHHHHHHH.css' },
});

const html = `<head><script type="module" crossorigin src="./assets/index-AAAAAAAA.js"></script><link rel="modulepreload" crossorigin href="./assets/vendor-BBBBBBBB.js"><link rel="stylesheet" crossorigin href="./assets/index-DDDDDDDD.css"></head>`;

const createBootstrapBundle = () => {
  const bundle = createBundle();
  bundle['assets/bootstrap-MMMMMMMM.js'] = chunk('assets/bootstrap-MMMMMMMM.js', {
    facadeModuleId: '/repo/src/bootstrap.ts',
    imports: ['assets/vendor-BBBBBBBB.js'],
    dynamicImports: ['assets/index-AAAAAAAA.js'],
  });
  bundle['assets/index-AAAAAAAA.js'].imports.push('assets/polyfills-NNNNNNNN.js');
  bundle['assets/polyfills-NNNNNNNN.js'] = chunk('assets/polyfills-NNNNNNNN.js');
  return bundle;
};

test('preloads bootstrap -> index -> app, including index-only dependencies and theme CSS', () => {
  for (const base of ['./', '/nested/']) {
    const bootstrapHtml = `<head><script type="module" crossorigin src="${base}assets/bootstrap-MMMMMMMM.js"></script><link rel="modulepreload" crossorigin href="${base}assets/vendor-BBBBBBBB.js"></head>`;
    const plugin = dynamicEntryPreloadPlugin();
    plugin.configResolved({ base });
    const tags = plugin.transformIndexHtml.handler(bootstrapHtml, { bundle: createBootstrapBundle() });
    assert.deepEqual(
      tags.map((tag) => [tag.attrs.rel, tag.attrs.href]),
      [
        ['modulepreload', `${base}assets/index-AAAAAAAA.js`],
        ['modulepreload', `${base}assets/polyfills-NNNNNNNN.js`],
        ['preload', `${base}assets/index-DDDDDDDD.css`],
        ['modulepreload', `${base}assets/app-CCCCCCCC.js`],
        ['modulepreload', `${base}assets/hooks-EEEEEEEE.js`],
        ['modulepreload', `${base}assets/crypto-IIIIIIII.js`],
        ['modulepreload', `${base}assets/posts-FFFFFFFF.js`],
        ['preload', `${base}assets/posts-KKKKKKKK.css`],
        ['preload', `${base}assets/app-HHHHHHHH.css`],
      ],
    );
    assert.equal(new Set(tags.map((tag) => tag.attrs.href)).size, tags.length);
    assert.ok(tags.every((tag) => tag.attrs.rel !== 'stylesheet'));
  }
});

test('collects the static graph of the app chunk in Vite dependency order, skipping dynamic imports', () => {
  const files = collectDynamicEntryDependencies(createBundle(), 'assets/app-CCCCCCCC.js', { ownerFileName: 'assets/index-AAAAAAAA.js' });
  assert.deepEqual(files, [
    'assets/app-CCCCCCCC.js',
    'assets/vendor-BBBBBBBB.js',
    'assets/hooks-EEEEEEEE.js',
    'assets/crypto-IIIIIIII.js',
    'assets/posts-FFFFFFFF.js',
    'assets/posts-KKKKKKKK.css',
    'assets/app-HHHHHHHH.css',
  ]);
});

test('handles circular static imports and missing dependency chunks without adding lazy imports', () => {
  const bundle = createBundle();
  bundle['assets/crypto-IIIIIIII.js'].imports.push('assets/hooks-EEEEEEEE.js', 'assets/missing-OOOOOOOO.js');
  assert.deepEqual(
    collectDynamicEntryDependencies(bundle, 'assets/app-CCCCCCCC.js', { ownerFileName: 'assets/index-AAAAAAAA.js' }),
    collectDynamicEntryDependencies(createBundle(), 'assets/app-CCCCCCCC.js', { ownerFileName: 'assets/index-AAAAAAAA.js' }),
  );
});

test('emits preload tags only for files the HTML does not already reference', () => {
  const tags = createDynamicEntryPreloadTags({ bundle: createBundle(), html, base: './', entryFacadeSuffix: '/src/app.tsx', ownerFacadeSuffix: '/src/index.tsx' });
  assert.deepEqual(
    tags.map((tag) => [tag.attrs.rel, tag.attrs.href]),
    [
      ['modulepreload', './assets/app-CCCCCCCC.js'],
      ['modulepreload', './assets/hooks-EEEEEEEE.js'],
      ['modulepreload', './assets/crypto-IIIIIIII.js'],
      ['modulepreload', './assets/posts-FFFFFFFF.js'],
      ['preload', './assets/posts-KKKKKKKK.css'],
      ['preload', './assets/app-HHHHHHHH.css'],
    ],
  );
  for (const tag of tags) {
    assert.equal(tag.tag, 'link');
    assert.equal(tag.injectTo, 'head');
    // Module scripts and the runtime-inserted stylesheets are fetched with CORS, so the preloads must match.
    assert.equal(tag.attrs.crossorigin, true);
    assert.equal(tag.attrs[APP_PRELOAD_ATTRIBUTE], true);
    if (tag.attrs.rel === 'preload') assert.equal(tag.attrs.as, 'style');
  }
});

test('returns nothing when the app chunk is missing from the bundle', () => {
  const bundle = createBundle();
  delete bundle['assets/app-CCCCCCCC.js'];
  assert.deepEqual(createDynamicEntryPreloadTags({ bundle, html, base: './', entryFacadeSuffix: '/src/app.tsx', ownerFacadeSuffix: '/src/index.tsx' }), []);
});

test('the plugin only transforms build HTML that carries a bundle', () => {
  const plugin = dynamicEntryPreloadPlugin();
  assert.equal(plugin.apply, 'build');
  plugin.configResolved({ base: '/' });
  assert.equal(plugin.transformIndexHtml.handler(html, {}), undefined);
  const tags = plugin.transformIndexHtml.handler(html, { bundle: createBundle() });
  assert.equal(tags[0].attrs.href, '/assets/app-CCCCCCCC.js');
});
