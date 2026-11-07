import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vendoredDirectoryLists } from '../utils/vendored-directory-lists';

const sdk = vi.hoisted(() => ({ inject: vi.fn(), pageview: vi.fn(), track: vi.fn() }));
vi.mock('@vercel/analytics', () => sdk);

type TestWindow = { location: URL; isElectron?: boolean; electronApi?: { isElectron: boolean }; Capacitor?: { isNativePlatform: () => boolean } };
const setLocation = (url: string, extra: Omit<TestWindow, 'location'> = {}) => vi.stubGlobal('window', { location: new URL(url), isElectron: false, ...extra });
const settle = () => vi.dynamicImportSettled();

const memes = vendoredDirectoryLists.memes.communities[0];
const memesKey = memes.publicKey as string;
const memesShorthand = memes.address.replace(/\.bso$/, '');

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('PROD', true);
  setLocation('https://seedit.app/#/');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// Every route in app.tsx, with sample paths and the path each one is sent as.
const ROUTES: Record<string, Array<[input: string, sent: string]>> = {
  '/about': [['/about', '/about']],
  '/changelog': [['/changelog', '/changelog']],
  '/gold': [['/gold', '/gold']],
  '/submit': [['/submit', '/submit']],
  '/s/:communityAddress/comments/:commentCid': [
    [`/s/${memes.address}/comments/bafyprivatecid`, '/s/memes/comments'],
    ['/s/memes/comments/bafyprivatecid', '/s/memes/comments'],
    ['/s/private-community.bso/comments/bafyprivatecid/', '/s/other/comments'],
  ],
  '/s/:communityAddress/comments/:commentCid/about': [
    [`/s/${memesKey}/comments/bafyprivatecid/about`, '/s/memes/comments/about'],
    ['/s/private-community.bso/comments/bafyprivatecid/about', '/s/other/comments/about'],
  ],
  '/s/:communityAddress/submit': [
    ['/s/memes/submit', '/s/memes/submit'],
    [`/s/${memes.address}/submit`, '/s/memes/submit'],
    ['/s/private-community.bso/submit', '/s/other/submit'],
  ],
  '/s/:communityAddress/about': [
    ['/s/memes/about', '/s/memes/about'],
    ['/s/private-community.bso/about', '/s/other/about'],
    ['/s/all/about', '/s/all/about'],
  ],
  '/settings': [['/settings', '/settings']],
  '/s/:communityAddress/settings': [
    [`/s/${memes.address}/settings`, '/s/community/settings'],
    ['/s/private-community.bso/settings', '/s/community/settings'],
  ],
  '/s/:communityAddress/settings/editor': [['/s/private-community.bso/settings/editor', '/s/community/settings']],
  '/settings/advanced': [['/settings/advanced', '/settings']],
  '/settings/p2p-stats': [['/settings/p2p-stats', '/settings']],
  '/settings/content-options': [['/settings/content-options', '/settings']],
  // Development builds only; production builds render not found here.
  '/settings/debug': [['/settings/debug', '/not-found']],
  '/settings/account-data': [['/settings/account-data', '/settings']],
  '/profile/about': [['/profile/about', '/profile/about']],
  '/u/:authorAddress/comments/:commentCid/about': [['/u/private-author.bso/comments/bafyprivatecid/about', '/u/author/about']],
  '/inbox': [['/inbox', '/inbox']],
  '/inbox/unread': [['/inbox/unread', '/inbox/unread']],
  '/inbox/commentreplies': [['/inbox/commentreplies', '/inbox/commentreplies']],
  '/inbox/postreplies': [['/inbox/postreplies', '/inbox/postreplies']],
  '/communities': [['/communities', '/communities']],
  '/communities/defaults': [['/communities/defaults', '/communities/defaults']],
  '/communities/subscriber': [['/communities/subscriber', '/communities/subscriber']],
  '/communities/moderator': [['/communities/moderator', '/communities/moderator']],
  '/communities/admin': [['/communities/admin', '/communities/admin']],
  '/communities/owner': [['/communities/owner', '/communities/owner']],
  DIRECTORY_INDEX_PATH: [['/communities/directories', '/communities/directories']],
  '${DIRECTORY_INDEX_PATH}/about': [['/communities/directories/about', '/communities/directories/about']],
  '${DIRECTORY_INDEX_PATH}/:directoryCode': [
    ['/communities/directories/memes', '/communities/directories/memes'],
    ['/communities/directories/private-code', '/not-found'],
  ],
  '${DIRECTORY_INDEX_PATH}/:directoryCode/about': [['/communities/directories/memes/about', '/communities/directories/memes/about']],
  // Legacy routes report as the directory route they redirect to, so the redirect is one view.
  '/communities/vote': [['/communities/vote', '/communities/directories']],
  '/communities/vote/passing': [['/communities/vote/passing', '/communities/directories']],
  '/communities/vote/rejecting': [['/communities/vote/rejecting', '/communities/directories']],
  '/communities/vote/:directoryCode': [
    ['/communities/vote/memes', '/communities/directories/memes'],
    ['/communities/vote/private-code', '/not-found'],
  ],
  '/communities/create': [['/communities/create', '/communities/create']],
  '/search': [
    ['/search', '/search'],
    ['/search/', '/search'],
  ],
  '/:sortType?/:timeFilterName?': [
    ['/', '/'],
    ['/hot', '/'],
    ['/new/3d', '/'],
    ['/top/1w', '/'],
    ['/topAll/all', '/'],
    ['/top/2w', '/not-found'],
    ['/hot/badfilter', '/not-found'],
    ['/private-words', '/not-found'],
  ],
  '/s/all/:sortType?/:timeFilterName?': [
    ['/s/all', '/s/all'],
    ['/s/all/new/24h', '/s/all'],
  ],
  '/s/mod/:sortType?/:timeFilterName?': [['/s/mod/active', '/s/mod']],
  '/s/:communityAddress/:sortType?/:timeFilterName?': [
    ['/s/memes', '/s/memes'],
    ['/s/memes/top/1y', '/s/memes'],
    [`/s/${memes.address}`, '/s/memes'],
    [`/s/${memes.address.toUpperCase()}`, '/s/memes'],
    [`/s/${memesShorthand}`, '/s/memes'],
    [`/s/${memesKey}/new`, '/s/memes'],
    ['/s/private-community.bso', '/s/other'],
    ['/s/12D3KooWPrivateCommunityPublicKeyNotInAnyDirectory', '/s/other'],
    ['/s/private-community.bso/private-words', '/not-found'],
  ],
  '/domain/:domain/:sortType?/:timeFilterName?': [
    ['/domain/private-site.example', '/domain'],
    ['/domain/private-site.example/top/1m', '/domain'],
  ],
  '/profile/:accountCommentIndex': [['/profile/7', '/profile/pending']],
  '/profile': [['/profile', '/profile']],
  upvoted: [['/profile/upvoted', '/profile/upvoted']],
  downvoted: [['/profile/downvoted', '/profile/downvoted']],
  hidden: [['/profile/hidden', '/profile/hidden']],
  saved: [['/profile/saved', '/profile/saved']],
  comments: [['/profile/comments', '/profile/comments']],
  submitted: [['/profile/submitted', '/profile/submitted']],
  '/u/:authorAddress/comments/:commentCid?/:sortType?/:timeFilterName?': [
    ['/u/private-author.bso/comments', '/u/author'],
    ['/u/12D3KooWPrivateAuthor/comments/bafyprivatecid/new/1w', '/u/author'],
  ],
  '/u/:authorAddress/comments/:commentCid?/comments/:sortType?/:timeFilterName?': [
    ['/u/private-author.bso/comments/bafyprivatecid/comments', '/u/author/comments'],
    ['/u/private-author.bso/comments/comments/top/all', '/u/author/comments'],
  ],
  '/u/:authorAddress/comments/:commentCid?/submitted/:sortType?/:timeFilterName?': [
    ['/u/private-author.bso/comments/bafyprivatecid/submitted/new', '/u/author/submitted'],
  ],
  '*': [
    ['/s', '/not-found'],
    ['/u/private-author.bso', '/not-found'],
    ['/profile/7/private', '/not-found'],
    ['/invalid/private/path/here', '/not-found'],
    ['/%E0%A4%A', '/not-found'],
  ],
  '/not-found': [['/not-found', '/not-found']],
};

describe('analytics page paths', () => {
  it('maps every route in app.tsx to a deliberate sent path', () => {
    const source = readFileSync(new URL('../../app.tsx', import.meta.url), 'utf8');
    const routePaths = [...source.matchAll(/\bpath=(?:'([^']*)'|\{`([^`]*)`\}|\{(\w+)\})/g)].map(([, quoted, template, identifier]) => quoted ?? template ?? identifier);
    expect([...new Set(routePaths)].sort()).toEqual(Object.keys(ROUTES).sort());
  });

  it.each(Object.entries(ROUTES).flatMap(([route, samples]) => samples.map(([input, sent]) => [route, input, sent])))(
    '%s: sends %s as %s, which maps to itself',
    async (_route, input, sent) => {
      const { getAnalyticsPath } = await import('./client');
      expect(getAnalyticsPath(input)).toBe(sent);
      expect(getAnalyticsPath(sent)).toBe(sent);
    },
  );

  it.each([
    ['/', '/'],
    ['/s/memes', '/s/[community]'],
    ['/s/memes/comments', '/s/[community]/comments'],
    ['/s/other/comments/about', '/s/[community]/comments/about'],
    ['/s/other/submit', '/s/[community]/submit'],
    ['/s/all', '/s/all'],
    ['/s/mod', '/s/mod'],
    ['/s/all/about', '/s/all/about'],
    ['/s/community/settings', '/s/community/settings'],
    ['/communities/directories/memes', '/communities/directories/[directory]'],
    ['/communities/directories/memes/about', '/communities/directories/[directory]/about'],
    ['/communities/directories/about', '/communities/directories/about'],
    ['/u/author', '/u/author'],
    ['/settings', '/settings'],
  ])('routes %s as %s so custom events, which carry the route, never name a community', async (path, route) => {
    const { getAnalyticsRoute } = await import('./client');
    expect(getAnalyticsRoute(path)).toBe(route);
  });

  it('keeps a directory published after this release out of the route', async () => {
    const { getAnalyticsPath, getAnalyticsRoute } = await import('./client');
    const { setPublishedDirectoryCodes } = await import('../utils/directory-codes');
    expect(getAnalyticsPath('/s/newdir')).toBe('/s/other');
    setPublishedDirectoryCodes(['newdir']);
    expect(getAnalyticsPath('/s/newdir/comments/QmCid')).toBe('/s/newdir/comments');
    expect(getAnalyticsRoute('/s/newdir/comments')).toBe('/s/[community]/comments');
    expect(getAnalyticsPath('/communities/directories/newdir')).toBe('/communities/directories/newdir');
    expect(getAnalyticsRoute('/communities/directories/newdir')).toBe('/communities/directories/[directory]');
  });
});

describe('analytics transport', () => {
  it('sanitizes both pageview and custom-event URLs at the transport boundary', async () => {
    setLocation('https://seedit.app/?token=private#/s/private-community.bso/comments/private-cid');
    const { sanitizeAnalyticsEvent } = await import('./client');
    expect(sanitizeAnalyticsEvent({ type: 'pageview', url: 'https://seedit.app/s/private-community.bso/comments/private-cid?secret=value#anchor' })).toEqual({
      type: 'pageview',
      url: 'https://seedit.app/s/other/comments',
    });
    expect(sanitizeAnalyticsEvent({ type: 'pageview', url: 'https://seedit.app/u/private-author.bso/comments/private-cid' })).toEqual({
      type: 'pageview',
      url: 'https://seedit.app/u/author',
    });
    expect(sanitizeAnalyticsEvent({ type: 'event', url: 'https://seedit.app/s/memes/submit?token=private#/secret' })).toEqual({
      type: 'event',
      url: 'https://seedit.app/',
    });
    expect(sanitizeAnalyticsEvent({ type: 'pageview', url: 'invalid url' })).toBeNull();
  });

  it('drops every event from an automated browser', async () => {
    vi.stubGlobal('navigator', { webdriver: true });
    const { sanitizeAnalyticsEvent } = await import('./client');
    expect(sanitizeAnalyticsEvent({ type: 'pageview', url: 'https://seedit.app/s/memes' })).toBeNull();
    expect(sanitizeAnalyticsEvent({ type: 'event', url: 'https://seedit.app/' })).toBeNull();
  });

  it('sends only the post or reply kind with a posting event', async () => {
    const { trackPostingEvent } = await import('.');
    trackPostingEvent('post_challenge_failed', { kind: 'post' });
    trackPostingEvent('post_upload_failed', { kind: 'reply' });
    await settle();
    expect(sdk.track.mock.calls).toEqual([
      ['post_challenge_failed', { kind: 'post' }],
      ['post_upload_failed', { kind: 'reply' }],
    ]);
  });
});

describe('analytics initialization', () => {
  it('initializes once with automatic pageviews disabled and preserves distinct post visits', async () => {
    const { trackPageView } = await import('.');
    const { sanitizeAnalyticsEvent } = await import('./client');
    trackPageView('/s/memes/comments/first-cid');
    trackPageView('/s/memes/comments/second-cid');
    await settle();
    expect(sdk.inject).toHaveBeenCalledExactlyOnceWith({ disableAutoTrack: true, beforeSend: sanitizeAnalyticsEvent, mode: 'production' });
    expect(sdk.pageview.mock.calls).toEqual([
      [{ path: '/s/memes/comments', route: '/s/[community]/comments' }],
      [{ path: '/s/memes/comments', route: '/s/[community]/comments' }],
    ]);
  });

  it('counts a redirect that replaces the entry with the same page once', async () => {
    const { trackPageView } = await import('.');
    trackPageView('/');
    trackPageView('/hot', { replace: true });
    trackPageView(`/s/${memesShorthand}`);
    trackPageView(`/s/${memes.address}`, { replace: true });
    trackPageView('/s/memes/submit');
    trackPageView(`/s/${memes.address}/submit`, { replace: true });
    // A replacing navigation to another page is a view of that page.
    trackPageView('/not-found', { replace: true });
    await settle();
    expect(sdk.pageview.mock.calls.map(([{ path }]) => path)).toEqual(['/', '/s/memes', '/s/memes/submit', '/not-found']);
  });

  it.each<[string, Omit<TestWindow, 'location'>, boolean]>([
    ['http://localhost:3000/#/s/memes', {}, true],
    ['https://seedit.localhost/#/s/memes', {}, true],
    ['https://seedit-git-branch.vercel.app/#/s/memes', {}, true],
    ['https://seedit.eth.limo/#/s/memes', {}, true],
    ['https://bafybeiexample.ipfs.dweb.link/#/s/memes', {}, true],
    ['file:///app/build/index.html#/s/memes', { isElectron: true }, true],
    ['https://seedit.app/#/s/memes', { isElectron: true }, true],
    ['https://seedit.app/#/s/memes', { electronApi: { isElectron: true } }, true],
    ['https://localhost/#/s/memes', { Capacitor: { isNativePlatform: () => true } }, true],
    ['https://seedit.app/#/s/memes', { Capacitor: { isNativePlatform: () => true } }, true],
    ['https://seedit.app/#/s/memes', {}, false],
    ['http://seedit.app/#/s/memes', {}, true],
  ])('never initializes or tracks on an excluded environment (%s, %o, production=%s)', async (url, extra, production) => {
    setLocation(url, extra);
    vi.stubEnv('PROD', production);
    const { trackPageView, trackPostingEvent } = await import('.');
    const { sanitizeAnalyticsEvent } = await import('./client');
    trackPageView('/s/memes');
    trackPostingEvent('post_publish_failed', { kind: 'post' });
    await settle();
    expect(sdk.inject).not.toHaveBeenCalled();
    expect(sdk.pageview).not.toHaveBeenCalled();
    expect(sdk.track).not.toHaveBeenCalled();
    expect(sanitizeAnalyticsEvent({ type: 'event', url })).toBeNull();
  });

  it('keeps the code of a directory published after this build for its community, so its redirect counts once', async () => {
    const { setPublishedDirectoryCodes } = await import('../utils/directory-codes');
    setPublishedDirectoryCodes(['newdir']);
    const directoryLists = [
      {
        schemaVersion: 1 as const,
        revision: 1,
        directoryCode: 'newdir',
        communities: [{ address: 'NewDir-Winner.bso', publicKey: '12D3KooWNewDirWinnerPubKeyAbcdefghijkmnopqrstuvwxyz' }],
      },
    ];
    const { trackPageView } = await import('.');
    trackPageView('/s/newdir/submit', { directoryLists });
    trackPageView('/s/newdir-winner.bso/submit', { replace: true, directoryLists });
    trackPageView('/s/12D3KooWNewDirWinnerPubKeyAbcdefghijkmnopqrstuvwxyz/comments/QmCid', { directoryLists });
    trackPageView('/s/unlisted.bso', { directoryLists });
    await settle();
    expect(sdk.pageview.mock.calls).toEqual([
      [{ path: '/s/newdir/submit', route: '/s/[community]/submit' }],
      [{ path: '/s/newdir/comments', route: '/s/[community]/comments' }],
      [{ path: '/s/other', route: '/s/[community]' }],
    ]);
  });

  it('supports the www production hostname', async () => {
    setLocation('https://www.seedit.app/#/s/memes');
    const { trackPageView } = await import('.');
    trackPageView('/s/memes');
    await settle();
    expect(sdk.pageview).toHaveBeenCalledExactlyOnceWith({ path: '/s/memes', route: '/s/[community]' });
  });

  it('does not throw or reject into the app if analytics initialization or tracking fails', async () => {
    const { trackPageView, trackPostingEvent } = await import('.');
    sdk.inject.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    expect(() => trackPageView('/s/memes')).not.toThrow();
    expect(() => trackPostingEvent('post_publish_failed', { kind: 'post' })).not.toThrow();
    await settle();
    expect(sdk.pageview).not.toHaveBeenCalled();
    expect(sdk.track).not.toHaveBeenCalled();
  });

  it('isolates errors from event dispatch after successful initialization', async () => {
    const { trackPageView, trackPostingEvent } = await import('.');
    sdk.pageview.mockImplementation(() => {
      throw new Error('blocked');
    });
    sdk.track.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => trackPageView('/s/memes')).not.toThrow();
    expect(() => trackPostingEvent('post_publish_failed', { kind: 'reply' })).not.toThrow();
    await settle();
    expect(sdk.inject).toHaveBeenCalledOnce();
  });
});
