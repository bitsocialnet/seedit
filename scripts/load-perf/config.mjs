// Production class names are CSS-module hashes (`_<local>_<hash>_<line>`), so regions
// match on the stable local name.
export default {
  viewport: { width: 1280, height: 900 },
  // A cold load must commit within commitTimeoutMs; layout changes are then observed for settleMs.
  commitTimeoutMs: 90000,
  settleMs: 5000,
  regions: {
    topbar: '[class*="_headerArea_"]',
    accountBar: '[class*="_content_"]:has(> [class*="_user_"])',
    header: '[class^="_header_"]',
    sidebar: '[class*="_sidebar_"]',
    feed: '[class*="_feed_"]',
    footer: 'footer',
  },
  // `storage` seeds localStorage before the app loads; `viewport` and `locale` override the defaults.
  // `staticShell: true` routes must show scripts/vite-static-shell.mjs's shell, identical to React's
  // first frame; `staticShell: false` routes must not show it.
  routes: [
    { name: 'home', hash: '/', staticShell: true, content: '[class*="_title_"] a' },
    { name: 'home-dark', hash: '/', staticShell: true, storage: { theme: 'dark' } },
    { name: 'home-mobile', hash: '/', staticShell: true, viewport: { width: 375, height: 812 } },
    { name: 'home-german', hash: '/', staticShell: false, locale: 'de-DE' },
    { name: 'community', hash: '/s/seedit.bso', staticShell: false, content: '[class*="_title_"] a' },
  ],
};
