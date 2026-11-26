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
    // The modern interface's left navigation and right rail.
    nav: '[class*="_nav_"]',
    rail: '[class*="_rail_"]',
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
    { name: 'home-content-options', hash: '/', staticShell: false, storage: { 'content-options': '{"state":{"hideDefaultCommunities":true},"version":1}' } },
    // The shell's navigation is expanded, so a visitor who collapsed it loads without the shell.
    { name: 'home-nav-collapsed', hash: '/', staticShell: false, storage: { modernNavCollapsed: 'true' } },
    { name: 'community', hash: '/s/seedit.bso', staticShell: false, content: '[class*="_title_"] a' },
    // The shell shows the default interface, so a visitor who chose the old one loads without it.
    { name: 'home-old', hash: '/', staticShell: false, storage: { uiMode: 'old' }, content: '[class*="_title_"] a' },
    { name: 'community-old', hash: '/s/seedit.bso', staticShell: false, storage: { uiMode: 'old' }, content: '[class*="_title_"] a' },
  ],
};
