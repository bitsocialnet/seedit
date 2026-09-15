// @vitest-environment jsdom

import { act, useSyncExternalStore, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useContentOptionsStore from '../../stores/use-content-options-store';
import { usePinnedPostsStore } from '../../stores/use-pinned-posts-store';
import CommunityView from './community';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.hoisted(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Storage);
});

afterAll(() => vi.unstubAllGlobals());

const testState = vi.hoisted(() => ({
  resolvedAddress: 'first.bso',
  community: { title: 'First community', updatedAt: 1, createdAt: 1, started: true, settings: {} },
  directoryList: { revision: 1 },
  accountComments: [] as Comment[],
  feed: [{ cid: 'first-post' }] as Comment[],
  hasMore: true,
  isOffline: false,
  isNsfw: false,
  blocked: false,
  block: vi.fn(),
  unblock: vi.fn(),
  loadMore: vi.fn<() => void | Promise<void>>(),
  reset: vi.fn(),
  viewRender: vi.fn(),
  sidebarRender: vi.fn(),
  sidebarLabel: 'original subscription',
  sidebarListeners: new Set<() => void>(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccountComments: () => ({ accountComments: testState.accountComments }),
  useCommunity: () => testState.community,
  useBlock: ({ address }: { address: string }) => ({
    blocked: testState.blocked,
    block: () => testState.block(address),
    unblock: () => testState.unblock(address),
  }),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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

vi.mock('../../hooks/use-feed-pagination', () => ({ FEED_POSTS_PER_PAGE: 25, useInfiniteFeedEnabled: () => false }));
vi.mock('../../hooks/use-state-string', () => ({ useFeedStateString: () => '' }));
vi.mock('../../hooks/use-is-community-offline', () => ({ default: () => ({ isOffline: testState.isOffline }) }));
vi.mock('../../hooks/use-is-nsfw-community', () => ({ useIsNsfwCommunity: () => testState.isNsfw }));
vi.mock('../../hooks/use-resolved-community-route', () => ({
  default: () => ({ communityAddress: testState.resolvedAddress, directoryCode: 'news', directoryList: testState.directoryList }),
}));
vi.mock('../../hooks/use-time-filter', () => ({
  default: () => ({ timeFilterName: '24h', timeFilterSeconds: 86400, sessionKey: 'community' }),
  isValidTimeFilterName: () => true,
  isValidTopTimeFilterName: () => true,
}));
vi.mock('../../hooks/use-progressive-feed', () => ({
  default: () => {
    testState.viewRender();
    return { feed: testState.feed, hasMore: testState.hasMore, loadMore: testState.loadMore, reset: testState.reset };
  },
}));

vi.mock('../../components/post', () => ({ default: () => null }));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/empty-feed-message', () => ({ default: () => <span>empty feed</span> }));
vi.mock('../../components/over-18-warning', () => ({ default: () => <span>NSFW warning</span> }));
vi.mock('../../components/development-feed-reset-button', () => ({ default: () => null }));
vi.mock('../../components/top-time-filter', () => ({ default: () => null }));
vi.mock('../../components/sidebar', () => ({
  default: function SidebarProbe({
    community,
    communityAddress,
    directoryRevision,
  }: {
    community?: { title?: string };
    communityAddress?: string;
    directoryRevision?: number;
  }) {
    testState.sidebarRender();
    const label = useSyncExternalStore(
      (listener) => {
        testState.sidebarListeners.add(listener);
        return () => testState.sidebarListeners.delete(listener);
      },
      () => testState.sidebarLabel,
    );
    return <aside data-testid='sidebar'>{[community?.title, communityAddress, directoryRevision, label].join(' / ')}</aside>;
  },
}));

describe('Community feed updates', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderCommunity = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/s/news/hot']}>
          <Routes>
            <Route path='/s/:communityAddress/:sortType' element={<CommunityView />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  };

  const clickText = async (label: string) => {
    const control = [...container.querySelectorAll('span')].find((node) => node.textContent === label);
    expect(control).toBeDefined();
    await act(async () => control?.click());
  };

  beforeEach(() => {
    vi.clearAllMocks();
    testState.resolvedAddress = 'first.bso';
    testState.community = { title: 'First community', updatedAt: 1, createdAt: 1, started: true, settings: {} };
    testState.directoryList = { revision: 1 };
    testState.accountComments = [];
    testState.feed = [{ cid: 'first-post' }] as Comment[];
    testState.hasMore = true;
    testState.isOffline = false;
    testState.isNsfw = false;
    testState.blocked = false;
    testState.loadMore = vi.fn();
    testState.sidebarLabel = 'original subscription';
    useContentOptionsStore.setState({ hideNsfwCommunities: false, blurNsfwThumbnails: true });
    usePinnedPostsStore.setState({ pinnedPostsCount: 0 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('preserves pending pagination through feed updates and then uses the latest callback', async () => {
    let finishLoading!: () => void;
    const firstLoadMore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLoading = resolve;
        }),
    );
    testState.loadMore = firstLoadMore;
    await renderCommunity();
    expect(container.querySelector('button')?.textContent).toBe('load_more');
    await act(async () => container.querySelector('button')?.click());
    expect(firstLoadMore).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('looking_for_more_posts');

    const nextLoadMore = vi.fn();
    testState.loadMore = nextLoadMore;
    testState.feed = [...testState.feed, { cid: 'next-post' } as Comment];
    await renderCommunity();

    expect(container.querySelector('[data-testid="feed"]')?.getAttribute('data-count')).toBe('2');
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('looking_for_more_posts');
    expect(nextLoadMore).not.toHaveBeenCalled();

    await act(async () => finishLoading());
    await act(async () => container.querySelector('button')?.click());
    expect(nextLoadMore).toHaveBeenCalledOnce();
    expect(firstLoadMore).toHaveBeenCalledOnce();
  });

  it('preserves an unblock confirmation for the same community and resets it when the directory resolves to another address', async () => {
    testState.blocked = true;
    await renderCommunity();
    await clickText('unblock_community');
    expect(container.textContent).toContain('are_you_sure');

    testState.feed = [...testState.feed, { cid: 'next-post' } as Comment];
    await renderCommunity();
    expect(container.textContent).toContain('are_you_sure');

    testState.resolvedAddress = 'second.bso';
    await renderCommunity();
    expect(container.textContent).not.toContain('are_you_sure');
    expect(container.textContent).toContain('unblock_community');
    expect(testState.unblock).not.toHaveBeenCalled();

    await clickText('unblock_community');
    await clickText('yes');
    expect(testState.unblock).toHaveBeenCalledOnce();
    expect(testState.unblock).toHaveBeenCalledWith('second.bso');
    expect(testState.block).not.toHaveBeenCalled();
    expect(testState.reset).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('are_you_sure');
  });

  it('counts optimistic posts for display but requires online protocol posts for manual pagination', async () => {
    testState.feed = [];
    testState.accountComments = [
      { cid: 'local-post', postCid: 'local-post', communityAddress: 'first.bso', state: 'succeeded', timestamp: Date.now() / 1000 } as Comment,
    ];
    await renderCommunity();
    expect(container.querySelector('[data-testid="feed"]')?.getAttribute('data-count')).toBe('1');
    expect(container.querySelector('button')).toBeNull();

    testState.feed = [{ cid: 'peer-post' } as Comment];
    await renderCommunity();
    expect(container.querySelector('[data-testid="feed"]')?.getAttribute('data-count')).toBe('2');
    expect(container.querySelector('button')?.textContent).toBe('load_more');

    testState.isOffline = true;
    await renderCommunity();
    expect(container.querySelector('button')).toBeNull();
    testState.isOffline = false;
    await renderCommunity();
    expect(container.querySelector('button')?.textContent).toBe('load_more');
    testState.hasMore = false;
    await renderCommunity();
    expect(container.querySelector('button')).toBeNull();
  });

  it('isolates the sidebar from feed updates while updating its props and subscriptions', async () => {
    await renderCommunity();
    expect(testState.sidebarRender).toHaveBeenCalledOnce();
    testState.feed = [...testState.feed, { cid: 'next-post' } as Comment];
    await renderCommunity();
    expect(testState.sidebarRender).toHaveBeenCalledOnce();

    testState.community = { ...testState.community, title: 'Updated community' };
    testState.directoryList = { revision: 2 };
    await renderCommunity();
    expect(testState.sidebarRender).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="sidebar"]')?.textContent).toContain('Updated community / first.bso / 2');

    await act(async () => {
      testState.sidebarLabel = 'updated subscription';
      for (const listener of testState.sidebarListeners) listener();
    });
    expect(testState.sidebarRender).toHaveBeenCalledTimes(3);
    expect(container.querySelector('[data-testid="sidebar"]')?.textContent).toContain('updated subscription');
  });

  it('ignores pinned-count and unrelated content-option changes while retaining the NSFW preference subscription', async () => {
    testState.isNsfw = true;
    await renderCommunity();
    const initialRenders = testState.viewRender.mock.calls.length;
    await act(async () => {
      usePinnedPostsStore.getState().setPinnedPostsCount(2);
      useContentOptionsStore.getState().setBlurNsfwThumbnails(false);
    });
    expect(testState.viewRender).toHaveBeenCalledTimes(initialRenders);
    expect(container.textContent).not.toContain('NSFW warning');

    await act(async () => useContentOptionsStore.getState().setHideNsfwCommunities(true));
    expect(container.textContent).toContain('NSFW warning');
    expect(container.querySelector('[data-testid="feed"]')).toBeNull();
  });
});
