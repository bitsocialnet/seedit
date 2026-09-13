import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkModuleBoundaries, formatViolation } from '../check-module-boundaries.mjs';

function fixture(t, files) {
  const root = mkdtempSync(path.join(tmpdir(), 'module-boundaries-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

const rules = (result) => result.violations.map((violation) => `${violation.rule} ${violation.file}:${violation.line} -> ${violation.target}`);

test('accepts one-way imports that enter modules through their index', (t) => {
  const src = fixture(t, {
    'app.tsx': "import Home from './views/home';\nimport { useHomeFeed } from '@/hooks/use-home-feed';\nconst Changelog = lazy(() => import('./views/changelog'));\n",
    'views/home/index.ts': "export { default } from './home';\n",
    'views/home/home.tsx':
      "import styles from './home.module.css';\nimport Post from '../../components/post';\nimport { useHomeFeed } from '../../hooks/use-home-feed';\nimport { sortTypes } from '../../constants/sort-types';\nimport { upload } from '../../plugins/file-uploader';\n",
    'views/home/home.module.css': '.feed {}\n',
    'views/changelog/index.ts': 'export default () => null;\n',
    'views/settings/settings.tsx': "import AccountSettings from './account-settings';\nimport AddressSettings from './address-settings';\n",
    'views/settings/account-settings/index.ts': "export { default } from './account-settings';\n",
    'views/settings/account-settings/account-settings.tsx':
      "import { format } from '../../../lib/utils/time-utils';\nimport AddressSettings from '../address-settings';\n",
    'views/settings/address-settings/index.ts': 'export default () => null;\n',
    'components/post/index.ts': "export { default } from './post';\n",
    'components/post/post.tsx': "import Thumbnail from './thumbnail';\nimport { useVote } from '../../hooks/use-vote';\n",
    'components/post/thumbnail/index.ts': "export { default } from './thumbnail';\n",
    'components/post/thumbnail/thumbnail.tsx': "import { isImage } from '../../../lib/utils/media-utils';\n",
    'hooks/use-home-feed.ts': "import { useFeedStore } from '../stores/use-feed-store';\n",
    'hooks/use-vote.ts': 'export const useVote = () => {};\n',
    'stores/use-feed-store.ts': "import { sortTypes } from '../constants/sort-types';\nimport { lists } from '../lib/utils/vendored-lists';\n",
    'lib/utils/time-utils.ts': 'export const format = () => {};\n',
    'lib/utils/media-utils.ts': "import { format } from './time-utils';\nimport { push } from '../push';\n",
    'lib/utils/vendored-lists.ts':
      "import list from '../../data/lists/first.json';\nimport centroids from '../../data/centroids';\nexport const lists = [list, centroids];\n",
    'lib/push/index.ts': "export { push } from './web';\n",
    'lib/push/web.ts': "import { common } from './common';\nexport const push = common;\n",
    'lib/push/common.ts': 'export const common = 1;\n',
    'plugins/file-uploader.ts': "import { format } from '../lib/utils/time-utils';\nexport const upload = format;\n",
    'data/lists/first.json': '[]\n',
    'data/centroids.ts': "import { sortTypes } from '../constants/sort-types';\nexport default sortTypes;\n",
    'constants/sort-types.ts': 'export const sortTypes = [];\n',
    'globals.d.ts': 'declare module "*.css";\n',
  });
  const result = checkModuleBoundaries(src);
  assert.deepEqual(result.violations, []);
  assert.equal(result.files, 24);
  assert.equal(result.edges, 30);
});

test('reports layer, view-to-view, private-module, and cycle violations once per import', (t) => {
  const src = fixture(t, {
    'app.tsx': "import DirectoryAbout from './views/about/directory-about';\n",
    'views/about/index.ts': "export { default } from './about';\n",
    'views/about/about.tsx': "import Sidebar from '../../components/sidebar';\nimport styles from './about.module.css';\n",
    'views/about/about.module.css': '.faq {}\n',
    'views/about/directory-about.tsx': 'export default () => null;\n',
    'views/gold/gold.tsx': "import styles from '../about/about.module.css';\nimport About from '@/views/about';\n",
    'components/sidebar/index.ts': "export { default } from './sidebar';\n",
    'components/sidebar/sidebar.tsx': "import { FAQ } from '../../views/about/about';\n",
    'components/reply/reply.tsx': "import Label from '../post/label';\n",
    'components/post/label/index.ts': 'export default () => null;\n',
    'lib/utils/media-utils.ts':
      "import { canEmbed } from '../../components/post/embed';\nexport const load = () => import('../../stores/use-feed-store');\nconst legacy = require('../../hooks/use-vote.js');\n",
    'components/post/embed/index.ts': 'export const canEmbed = () => true;\n',
    'stores/use-feed-store.ts': 'export const useFeedStore = () => {};\n',
    'hooks/use-vote.ts': 'export const useVote = () => {};\n',
  });
  const result = checkModuleBoundaries(src);
  assert.deepEqual(rules(result), [
    'private-module app.tsx:1 -> views/about/directory-about.tsx',
    'private-module components/reply/reply.tsx:1 -> components/post/label/index.ts',
    'cycle components/sidebar/index.ts:0 -> ',
    'layer components/sidebar/sidebar.tsx:1 -> views/about/about.tsx',
    'layer lib/utils/media-utils.ts:1 -> components/post/embed/index.ts',
    'layer lib/utils/media-utils.ts:2 -> stores/use-feed-store.ts',
    'layer lib/utils/media-utils.ts:3 -> hooks/use-vote.ts',
    'view-to-view views/gold/gold.tsx:1 -> views/about/about.module.css',
    'view-to-view views/gold/gold.tsx:2 -> views/about/index.ts',
  ]);
  const cycle = result.violations.find((violation) => violation.rule === 'cycle');
  assert.equal(
    formatViolation('src', cycle),
    'src/components/sidebar/index.ts import cycle: components/sidebar/index.ts -> components/sidebar/sidebar.tsx -> views/about/about.tsx -> components/sidebar/index.ts [cycle]',
  );
  const layer = result.violations.find((violation) => violation.file === 'components/sidebar/sidebar.tsx');
  assert.equal(
    formatViolation('src', layer),
    "src/components/sidebar/sidebar.tsx:1 imports '../../views/about/about': components must not import from views; dependencies flow constants/data -> lib/plugins -> stores -> hooks -> components -> views -> app [layer]",
  );
});

test('prints a cycle as a real import path, one per cycle', (t) => {
  const src = fixture(t, {
    'lib/a.ts': "import './c';\nimport './d';\n",
    'lib/c.ts': "import './b';\n",
    'lib/b.ts': "import './a';\n",
    'lib/d.ts': "import './a';\n",
    'lib/e.ts': "import './f';\n",
    'lib/f.ts': "import './e';\n",
  });
  const messages = checkModuleBoundaries(src).violations.map((violation) => violation.message);
  assert.deepEqual(messages, ['import cycle: lib/a.ts -> lib/c.ts -> lib/b.ts -> lib/a.ts', 'import cycle: lib/e.ts -> lib/f.ts -> lib/e.ts']);
});

test('reads every import form the parser sees and nothing from comments or strings', (t) => {
  const src = fixture(t, {
    'lib/utils/a.ts': [
      "import { t } from './time'; import { x } from '../../views/home/home';",
      "export * from '../../components/foo/inner.js';",
      "export { y } from '../../hooks/use-y';",
      "// nothing here: import z from '../../views/about/about'",
      'const s = "from \'../../views/about/about\'";',
      '/* import w from "../../views/about/about" */',
    ].join('\n'),
    'lib/utils/time.ts': 'export const t = 1;\n',
    'views/home/home.ts': 'export const x = 1;\n',
    'views/about/about.ts': 'export default 1;\n',
    'components/foo/inner.ts': 'export const inner = 1;\n',
    'hooks/use-y.ts': 'export const y = 1;\n',
  });
  const result = checkModuleBoundaries(src);
  assert.equal(result.edges, 4);
  assert.deepEqual(rules(result), [
    'layer lib/utils/a.ts:1 -> views/home/home.ts',
    'layer lib/utils/a.ts:2 -> components/foo/inner.ts',
    'layer lib/utils/a.ts:3 -> hooks/use-y.ts',
  ]);
});

test('checks json targets by layer but lets data folders be imported directly', (t) => {
  const src = fixture(t, {
    'lib/utils/a.ts': "import feed from '../../views/home/feed.json';\nimport list from '../../data/lists/first.json';\n",
    'views/home/feed.json': '{}\n',
    'data/lists/first.json': '[]\n',
  });
  assert.deepEqual(rules(checkModuleBoundaries(src)), ['layer lib/utils/a.ts:1 -> views/home/feed.json']);
});

test('ignores packages, assets, files outside src, and test importers', (t) => {
  const src = fixture(t, {
    'components/version/version.tsx':
      "import packageJson from '../../../package.json';\nimport { useState } from 'react';\nimport icon from '../../views/about/icon.svg';\nconst changelog = await import('../../../CHANGELOG.md?raw');\n",
    'components/version/version.test.tsx': "import Version from './version';\nimport About from '../../views/about/about';\n",
    'components/version/__tests__/render.tsx': "import About from '../../../views/about/about';\n",
    'views/about/about.tsx': "import { helper } from '../../components/version/test-utils/helper';\n",
    'views/about/icon.svg': '<svg />\n',
    'components/version/test-utils/helper.ts': "import About from '../../../views/about/about';\n",
  });
  const result = checkModuleBoundaries(src);
  assert.deepEqual(rules(result), ['private-module views/about/about.tsx:1 -> components/version/test-utils/helper.ts']);
  assert.equal(result.edges, 6);
});
