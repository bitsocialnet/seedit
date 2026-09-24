// Preload the dynamically imported startup chunk graphs from index.html.
//
// src/bootstrap.ts imports src/index.tsx, which imports the app after configuring polyfills
// and P2P client options. Vite only writes HTML preload tags for bootstrap's static imports.
// Preload both deferred graphs so index-only dependencies and global/theme CSS are discovered
// alongside the app chunks. Preloading fetches them without changing their execution order.

export const APP_PRELOAD_ATTRIBUTE = 'data-seedit-app-preload';

const toPosix = (filePath) => filePath.replaceAll('\\', '/');

export function findChunkByFacade(bundle, facadeSuffix) {
  return Object.values(bundle).find(
    (output) => output.type === 'chunk' && typeof output.facadeModuleId === 'string' && toPosix(output.facadeModuleId).endsWith(facadeSuffix),
  );
}

// Same traversal and order as Vite's own dynamic-import dependency list (vite:build-import-analysis),
// so the injected stylesheets keep the cascade order the runtime helper would have produced.
export function collectDynamicEntryDependencies(bundle, entryFileName, { ownerFileName } = {}) {
  const dependencies = new Set();
  const analyzed = new Set();
  const addDependencies = (fileName) => {
    if (fileName === ownerFileName || analyzed.has(fileName)) {
      return;
    }
    analyzed.add(fileName);
    const output = bundle[fileName];
    if (!output) {
      return;
    }
    dependencies.add(output.fileName);
    if (output.type === 'chunk') {
      output.imports.forEach(addDependencies);
      output.viteMetadata?.importedCss?.forEach((cssFileName) => dependencies.add(cssFileName));
    }
  };
  addDependencies(entryFileName);
  return [...dependencies];
}

export function createDynamicEntryPreloadTags({ bundle, html, base, entryFacadeSuffix, ownerFacadeSuffix }) {
  const entry = findChunkByFacade(bundle, entryFacadeSuffix);
  if (!entry) {
    return [];
  }
  const owner = ownerFacadeSuffix ? findChunkByFacade(bundle, ownerFacadeSuffix) : undefined;
  const files = [
    ...new Set([
      ...(owner ? collectDynamicEntryDependencies(bundle, owner.fileName) : []),
      ...collectDynamicEntryDependencies(bundle, entry.fileName, { ownerFileName: owner?.fileName }),
    ]),
  ];
  return (
    files
      // Bootstrap and any shared static dependencies already have Vite's HTML tags.
      .filter((fileName) => !html.includes(fileName))
      .map((fileName) => ({
        tag: 'link',
        // Stylesheets stay `preload` rather than `stylesheet`: the runtime helper still inserts them
        // in dependency order and waits for them, exactly as before, but from the preload cache.
        attrs: fileName.endsWith('.css')
          ? { rel: 'preload', as: 'style', crossorigin: true, href: `${base}${fileName}`, [APP_PRELOAD_ATTRIBUTE]: true }
          : { rel: 'modulepreload', crossorigin: true, href: `${base}${fileName}`, [APP_PRELOAD_ATTRIBUTE]: true },
        injectTo: 'head',
      }))
  );
}

export function dynamicEntryPreloadPlugin({ entryFacadeSuffix = '/src/app.tsx', ownerFacadeSuffix = '/src/index.tsx' } = {}) {
  let base = '/';
  return {
    name: 'seedit-app-entry-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.bundle) {
          return;
        }
        return createDynamicEntryPreloadTags({ bundle: context.bundle, html, base, entryFacadeSuffix, ownerFacadeSuffix });
      },
    },
  };
}
