// @vitest-environment jsdom

import { act, useSyncExternalStore, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './home';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({
  account: { author: { address: 'account-address', displayName: 'Alice' }, subscriptions: ['community.bso'] },
  accountListeners: new Set<() => void>(),
  feed: [{ cid: 'first-post' }],
  hasMore: true,
  loadMore: vi.fn<() => void | Promise<void>>(),
  reset: vi.fn(),
  sidebarRender: vi.fn(),
  directoryNoticeRender: vi.fn(),
  starterNoticeRender: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () =>
    useSyncExternalStore(
      (listener) => {
        testState.accountListeners.add(listener);
        return () => testState.accountListeners.delete(listener);
      },
      () => testState.account,
    ),
  useCommunities: () => ({ communities: [{ updatedAt: 1 }] }),
}));

vi.mock('react-i18next', () => ({
  Trans: () => null,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ components, context, totalCount }: { components: { Footer: ComponentType<{ context: unknown }> }; context?: unknown; totalCount: number }) => {
    const Footer = components.Footer;
    return (
      <div data-testid='feed' data-count={totalCount}>
        <Footer context={context} />
      </div>
    );
  },
}));

vi.mock('../../stores/use-auto-subscribe-store', () => ({ useAutoSubscribeStore: () => ({ isCheckingAccount: () => false }) }));
vi.mock('../../hooks/use-default-subscriptions', () => ({ useStarterCommunityList: () => ({ loading: false }) }));
vi.mock('../../hooks/use-redirect-to-default-sort', () => ({ default: () => undefined }));
vi.mock('../../hooks/use-feed-pagination', () => ({ FEED_POSTS_PER_PAGE: 25, useInfiniteFeedEnabled: () => false }));
vi.mock('../../hooks/use-state-string', () => ({ useFeedStateString: () => '' }));
vi.mock('../../hooks/use-time-filter', () => ({
  default: () => ({ timeFilterName: '24h', timeFilterSeconds: 86400, sessionKey: 'home' }),
  isValidTimeFilterName: () => true,
  isValidTopTimeFilterName: () => true,
}));
vi.mock('../../hooks/use-progressive-feed', () => ({
  default: () => ({ feed: testState.feed, hasMore: testState.hasMore, loadMore: testState.loadMore, reset: testState.reset }),
}));

vi.mock('../../components/post', () => ({ default: () => null }));
vi.mock('../../components/empty-feed-message', () => ({ default: () => null }));
vi.mock('../../components/development-feed-reset-button', () => ({ default: () => null }));
vi.mock('../../components/top-time-filter', () => ({ default: () => null }));
vi.mock('../../components/sidebar', () => ({
  default: function SidebarProbe() {
    testState.sidebarRender();
    return <aside data-testid='sidebar'>{useAccount()?.author.displayName}</aside>;
  },
}));
vi.mock('../../components/directory-subscription-updates-notice', () => ({
  default: function DirectoryNoticeProbe() {
    testState.directoryNoticeRender();
    return <div data-testid='directory-notice'>{useAccount()?.author.displayName}</div>;
  },
}));
vi.mock('../../components/starter-subscriptions-notice', () => ({
  default: function StarterNoticeProbe() {
    testState.starterNoticeRender();
    return <div data-testid='starter-notice'>{useAccount()?.author.displayName}</div>;
  },
}));

describe('Home feed updates', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderHome = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      );
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    testState.account = { author: { address: 'account-address', displayName: 'Alice' }, subscriptions: ['community.bso'] };
    testState.feed = [{ cid: 'first-post' }];
    testState.hasMore = true;
    testState.loadMore = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('preserves pending manual pagination when the feed updates and uses the latest pagination props', async () => {
    let finishLoading!: () => void;
    const firstLoadMore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLoading = resolve;
        }),
    );
    testState.loadMore = firstLoadMore;
    await renderHome();
    expect(container.querySelector('button')?.textContent).toBe('load_more');

    await act(async () => container.querySelector('button')?.click());
    expect(firstLoadMore).toHaveBeenCalledOnce();
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('looking_for_more_posts');

    const nextLoadMore = vi.fn();
    testState.loadMore = nextLoadMore;
    testState.feed = [...testState.feed, { cid: 'next-post' }];
    await renderHome();

    expect(container.querySelector('[data-testid="feed"]')?.getAttribute('data-count')).toBe('2');
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('looking_for_more_posts');
    expect(nextLoadMore).not.toHaveBeenCalled();

    await act(async () => finishLoading());
    expect(container.querySelector('button')?.textContent).toBe('load_more');
    await act(async () => container.querySelector('button')?.click());
    expect(nextLoadMore).toHaveBeenCalledOnce();
    expect(firstLoadMore).toHaveBeenCalledOnce();

    testState.hasMore = false;
    await renderHome();
    expect(container.querySelector('button')).toBeNull();
  });

  it('isolates notices and the sidebar from feed updates while preserving their account subscriptions', async () => {
    await renderHome();
    const renderSpies = [testState.sidebarRender, testState.directoryNoticeRender, testState.starterNoticeRender];
    for (const renderSpy of renderSpies) expect(renderSpy).toHaveBeenCalledOnce();

    testState.feed = [...testState.feed, { cid: 'next-post' }];
    await renderHome();
    for (const renderSpy of renderSpies) expect(renderSpy).toHaveBeenCalledOnce();

    await act(async () => {
      testState.account = { ...testState.account, author: { ...testState.account.author, displayName: 'Bob' } };
      for (const listener of testState.accountListeners) listener();
    });

    for (const testId of ['sidebar', 'directory-notice', 'starter-notice']) {
      expect(container.querySelector(`[data-testid="${testId}"]`)?.textContent).toBe('Bob');
    }
    for (const renderSpy of renderSpies) expect(renderSpy).toHaveBeenCalledTimes(2);
  });
});
