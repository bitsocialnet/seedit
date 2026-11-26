// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernSearch from './modern-search';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  page: {} as Record<string, unknown>,
  navigate: vi.fn(),
  loadMorePosts: vi.fn(),
  showMoreCommunities: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => createElement('div', { 'data-navigate': to }),
  useNavigate: () => testState.navigate,
}));
vi.mock('../../hooks/use-search-page', () => ({ default: () => testState.page }));
vi.mock('../../hooks/use-community-display-name', () => ({ default: () => (address: string) => `s/${address}` }));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));
vi.mock('../../components/modern-user-profile', () => ({
  ModernUserFeedStatus: ({ text }: { text: string }) => createElement('p', { 'data-status': true }, text),
}));
vi.mock('../../components/modern-community-row', () => ({ default: ({ address }: { address: string }) => createElement('div', { 'data-community': address }) }));
vi.mock('../../components/modern-post-card', () => ({ default: ({ post }: { post: { cid: string } }) => createElement('article', { 'data-post': post.cid }) }));
vi.mock('../../components/modern-reply-card', () => ({ default: ({ reply }: { reply: { cid: string } }) => createElement('article', { 'data-reply': reply.cid }) }));

let container: HTMLDivElement;
let root: Root;

const render = (page: Record<string, unknown> = {}) => {
  testState.page = {
    rawQuery: 'cats',
    checkboxOptions: {},
    restrictedCommunity: undefined,
    nsfw: false,
    shownCommunities: [],
    hasMoreCommunities: false,
    showMoreCommunities: testState.showMoreCommunities,
    comments: [],
    error: null,
    hasMore: false,
    loading: false,
    loadingMore: false,
    provider: null,
    total: 0,
    loadMorePosts: testState.loadMorePosts,
    retry: vi.fn(),
    ...page,
  };
  return act(async () => root.render(createElement(ModernSearch)));
};

describe('ModernSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows matching communities, then posts and replies, with more of each on request', async () => {
    await render({
      shownCommunities: [{ address: 'cats.bso' }],
      hasMoreCommunities: true,
      comments: [{ cid: 'post' }, { cid: 'reply', parentCid: 'post' }],
      hasMore: true,
    });
    expect(container.querySelector('[data-community]')?.getAttribute('data-community')).toBe('cats.bso');
    expect(container.querySelector('[data-post]')?.getAttribute('data-post')).toBe('post');
    expect(container.querySelector('[data-reply]')?.getAttribute('data-reply')).toBe('reply');

    const loadMoreButtons = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === 'load_more');
    expect(loadMoreButtons).toHaveLength(2);
    await act(async () => loadMoreButtons[0].click());
    await act(async () => loadMoreButtons[1].click());
    expect(testState.showMoreCommunities).toHaveBeenCalledTimes(1);
    expect(testState.loadMorePosts).toHaveBeenCalledTimes(1);
  });

  it('turns sort, time, NSFW, and community choices into search urls', async () => {
    await render({ restrictedCommunity: 'cats.bso', checkboxOptions: { community: 'cats.bso' } });
    const [sortSelect, timeSelect] = Array.from(container.querySelectorAll('select'));

    await act(async () => {
      sortSelect.value = 'new';
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(testState.navigate).toHaveBeenLastCalledWith('/search?q=cats&community=cats.bso&sort=new');

    await act(async () => {
      timeSelect.value = 'week';
      timeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(testState.navigate).toHaveBeenLastCalledWith('/search?q=cats&community=cats.bso&t=week');

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-pressed]')!.click());
    expect(testState.navigate).toHaveBeenLastCalledWith('/search?q=cats&community=cats.bso&nsfw=1');

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="remove"]')!.click());
    expect(testState.navigate).toHaveBeenLastCalledWith('/search?q=cats');
  });

  it('searches for seedit when the url has no query', async () => {
    await render({ rawQuery: '' });
    expect(container.querySelector('[data-navigate]')?.getAttribute('data-navigate')).toBe('/search?q=seedit');
  });
});
