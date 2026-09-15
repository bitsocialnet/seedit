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
    return { feed: testState.feed, hasMore: testState.hasMore, loadMore: testState.loadMore, requestKey: JSON.stringify(options) };
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

const createPendingLoad = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { loadMore: vi.fn(() => promise), resolve };
};

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

  it.each(['sort', 'default communities'])('resets pagination when %s changes and ignores the previous request completion', async (changedOption) => {
    const first = createPendingLoad();
    const destination = createPendingLoad();
    testState.loadMore = first.loadMore;
    await renderAll();
    await act(async () => container.querySelector('button')?.click());
    expect(first.loadMore).toHaveBeenCalledOnce();
    expect(container.querySelector('button')).toBeNull();

    testState.loadMore = destination.loadMore;
    if (changedOption === 'sort') {
      await act(async () => container.querySelector('a')?.click());
    } else {
      testState.communityAddresses = ['destination.bso'];
      await renderAll();
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

  it('preserves pending pagination for feed updates and keeps default communities and sidebar routes current', async () => {
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
    await renderAll();

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
    await renderAll();
    expect(testState.readCommunities).toHaveBeenLastCalledWith({ communities: [{ name: 'updated.bso' }] });
    expect(testState.readFeed).toHaveBeenLastCalledWith(expect.objectContaining({ feedOptions: expect.objectContaining({ communities: [{ name: 'updated.bso' }] }) }));

    testState.hasMore = false;
    await renderAll();
    expect(container.querySelector('button')).toBeNull();
    await act(async () => container.querySelector('a')?.click());
    expect(container.querySelector('aside')?.textContent).toBe('/s/all/new');
    expect(testState.readFeed).toHaveBeenLastCalledWith(expect.objectContaining({ feedOptions: expect.objectContaining({ sortType: 'new' }) }));
  });
});
