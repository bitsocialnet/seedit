// @vitest-environment jsdom

import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import All from './all';

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
  default: () => ({ timeFilterName: '24h', timeFilterSeconds: 86400, sessionKey: 'all' }),
  isValidTimeFilterName: () => true,
  isValidTopTimeFilterName: () => true,
}));
vi.mock('../../hooks/use-progressive-feed', () => ({
  default: (options: unknown) => {
    testState.readFeed(options);
    return { feed: testState.feed, hasMore: testState.hasMore, loadMore: testState.loadMore };
  },
}));
vi.mock('../../components/post', () => ({ default: () => null }));
vi.mock('../../components/empty-feed-message', () => ({ default: () => null }));
vi.mock('../../components/development-feed-reset-button', () => ({ default: () => null }));
vi.mock('../../components/top-time-filter', () => ({ default: () => null }));
vi.mock('../../components/sidebar', () => ({
  default: function SidebarProbe() {
    testState.sidebarRender();
    return <aside>{useLocation().pathname}</aside>;
  },
}));

describe('All feed updates', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderAll = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/s/all']}>
          <Link to='/s/all/new'>new posts</Link>
          <Routes>
            <Route path='/s/all/:sortType?' element={<All />} />
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

  it('preserves pending pagination across default-community updates and keeps sidebar route updates live', async () => {
    let finishLoading!: () => void;
    const firstLoadMore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLoading = resolve;
        }),
    );
    testState.loadMore = firstLoadMore;
    await renderAll();
    expect(container.querySelector('button')?.textContent).toBe('load_more');

    await act(async () => container.querySelector('button')?.click());
    expect(firstLoadMore).toHaveBeenCalledOnce();
    expect(container.querySelector('button')).toBeNull();

    const nextLoadMore = vi.fn();
    testState.loadMore = nextLoadMore;
    testState.feed = [...testState.feed, { cid: 'next-post' }];
    testState.communityAddresses = ['updated.bso'];
    await renderAll();

    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('looking_for_more_posts');
    expect(nextLoadMore).not.toHaveBeenCalled();
    expect(testState.sidebarRender).toHaveBeenCalledOnce();
    expect(testState.readCommunities).toHaveBeenLastCalledWith({ communities: [{ name: 'updated.bso' }] });
    expect(testState.readFeed).toHaveBeenLastCalledWith(expect.objectContaining({ feedOptions: expect.objectContaining({ communities: [{ name: 'updated.bso' }] }) }));

    await act(async () => finishLoading());
    expect(container.querySelector('button')?.textContent).toBe('load_more');
    await act(async () => container.querySelector('button')?.click());
    expect(nextLoadMore).toHaveBeenCalledOnce();
    expect(firstLoadMore).toHaveBeenCalledOnce();

    testState.hasMore = false;
    await renderAll();
    expect(container.querySelector('button')).toBeNull();
    await act(async () => container.querySelector('a')?.click());
    expect(container.querySelector('aside')?.textContent).toBe('/s/all/new');
    expect(testState.readFeed).toHaveBeenLastCalledWith(expect.objectContaining({ feedOptions: expect.objectContaining({ sortType: 'new' }) }));
  });
});
