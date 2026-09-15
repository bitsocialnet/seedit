// @vitest-environment jsdom

import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Domain from './domain';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({
  communityAddresses: ['initial.bso'],
  feed: [{ cid: 'first-post' }],
  hasMore: true,
  loadMore: vi.fn<() => void | Promise<void>>(),
  readFeed: vi.fn(),
  readCommunities: vi.fn(),
  sidebarRender: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useCommunities: (options: unknown) => {
    testState.readCommunities(options);
    return { communities: [{ updatedAt: 1 }] };
  },
}));
vi.mock('react-i18next', () => ({ Trans: () => null, useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ components, context }: { components: { Footer: ComponentType<{ context: unknown }> }; context?: unknown }) => {
    const Footer = components.Footer;
    return <Footer context={context} />;
  },
}));
vi.mock('../../hooks/use-default-subscriptions', () => ({ useDefaultSubscriptionAddresses: () => testState.communityAddresses }));
vi.mock('../../hooks/use-feed-pagination', () => ({ FEED_POSTS_PER_PAGE: 25, useInfiniteFeedEnabled: () => false }));
vi.mock('../../hooks/use-state-string', () => ({ useFeedStateString: () => '' }));
vi.mock('../../hooks/use-time-filter', () => ({
  default: () => ({ timeFilterName: '24h', timeFilterSeconds: 86400, sessionKey: 'domain' }),
  isValidTimeFilterName: () => true,
  isValidTopTimeFilterName: () => true,
}));
vi.mock('../../hooks/use-progressive-feed', () => ({
  default: (options: unknown) => {
    testState.readFeed(options);
    return { feed: testState.feed, hasMore: testState.hasMore, loadMore: testState.loadMore, requestKey: JSON.stringify(options) };
  },
}));
vi.mock('../../components/post', () => ({ default: () => null }));
vi.mock('../../components/empty-feed-message', () => ({ default: () => null }));
vi.mock('../../components/top-time-filter', () => ({ default: () => null }));
vi.mock('../../components/sidebar', () => ({
  default: function SidebarProbe() {
    testState.sidebarRender();
    return <aside>{useLocation().pathname}</aside>;
  },
}));

const createPendingLoad = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { loadMore: vi.fn(() => promise), resolve };
};

describe('Domain feed updates', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderDomain = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/domain/example.com']}>
          <Link to='/domain/second.test'>another domain</Link>
          <Routes>
            <Route path='/domain/:domain/:sortType?' element={<Domain />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    testState.communityAddresses = ['initial.bso'];
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

  it.each(['domain', 'default communities'])('resets pagination when %s changes and ignores the previous request completion', async (changedOption) => {
    const first = createPendingLoad();
    const destination = createPendingLoad();
    testState.loadMore = first.loadMore;
    await renderDomain();
    await act(async () => container.querySelector('button')?.click());
    expect(first.loadMore).toHaveBeenCalledOnce();
    expect(container.querySelector('button')).toBeNull();

    testState.loadMore = destination.loadMore;
    if (changedOption === 'domain') {
      await act(async () => container.querySelector('a')?.click());
    } else {
      testState.communityAddresses = ['destination.bso'];
      await renderDomain();
    }
    expect(container.querySelector('button')?.textContent).toBe('load_more');
    await act(async () => container.querySelector('button')?.click());
    expect(destination.loadMore).toHaveBeenCalledOnce();

    await act(async () => first.resolve());
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('looking_for_more_posts');
    await act(async () => destination.resolve());
    expect(container.querySelector('button')?.textContent).toBe('load_more');
  });

  it('preserves pending pagination for feed updates and keeps communities, domain filters, and sidebar routes current', async () => {
    let finishLoading!: () => void;
    const firstLoadMore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLoading = resolve;
        }),
    );
    testState.loadMore = firstLoadMore;
    await renderDomain();
    const initialFilter = testState.readFeed.mock.lastCall?.[0].feedOptions.filter;
    expect(initialFilter.key).toBe('domain-filter-example.com');
    expect(initialFilter.filter({ link: 'https://example.com/post' })).toBe(true);
    expect(initialFilter.filter({ link: 'https://sub.example.com/post' })).toBe(true);
    expect(initialFilter.filter({ link: 'https://notexample.com/post' })).toBe(false);
    expect(initialFilter.filter({ link: 'invalid-url' })).toBe(false);
    expect(container.querySelector('button')?.textContent).toBe('load_more');

    await act(async () => container.querySelector('button')?.click());
    expect(firstLoadMore).toHaveBeenCalledOnce();
    expect(container.querySelector('button')).toBeNull();

    const nextLoadMore = vi.fn();
    testState.loadMore = nextLoadMore;
    testState.feed = [...testState.feed, { cid: 'next-post' }];
    await renderDomain();

    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('looking_for_more_posts');
    expect(nextLoadMore).not.toHaveBeenCalled();
    expect(testState.sidebarRender).toHaveBeenCalledOnce();

    await act(async () => finishLoading());
    expect(container.querySelector('button')?.textContent).toBe('load_more');
    await act(async () => container.querySelector('button')?.click());
    expect(nextLoadMore).toHaveBeenCalledOnce();
    expect(firstLoadMore).toHaveBeenCalledOnce();

    testState.communityAddresses = ['updated.bso'];
    await renderDomain();
    expect(testState.readCommunities).toHaveBeenLastCalledWith({ communities: [{ name: 'updated.bso' }] });
    expect(testState.readFeed).toHaveBeenLastCalledWith(expect.objectContaining({ feedOptions: expect.objectContaining({ communities: [{ name: 'updated.bso' }] }) }));

    testState.hasMore = false;
    await renderDomain();
    expect(container.querySelector('button')).toBeNull();
    await act(async () => container.querySelector('a')?.click());
    expect(container.querySelector('aside')?.textContent).toBe('/domain/second.test');
    const nextFilter = testState.readFeed.mock.lastCall?.[0].feedOptions.filter;
    expect(nextFilter.key).toBe('domain-filter-second.test');
    expect(nextFilter.filter({ link: 'https://example.com/post' })).toBe(false);
    expect(nextFilter.filter({ link: 'https://second.test/post' })).toBe(true);
  });

  it('shows delayed no-results feedback and restores the feed when matching posts arrive', async () => {
    testState.feed = [];
    await renderDomain();
    await act(async () => vi.advanceTimersByTime(1999));
    expect(container.textContent).not.toContain('No posts found from');

    await act(async () => vi.advanceTimersByTime(1));
    expect(container.textContent).toContain('No posts found from example.com');
    expect(container.querySelector('button')).toBeNull();

    testState.feed = [{ cid: 'late-post' }];
    await renderDomain();
    expect(container.textContent).not.toContain('No posts found from');
    expect(container.querySelector('button')?.textContent).toBe('load_more');
  });
});
