// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernProfile from './modern-profile';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  pathname: '/profile',
  votes: [] as { commentCid: string; vote: number }[],
  account: { blockedCids: {} as Record<string, boolean>, savedComments: [] as string[] },
  accountCommentsOptions: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => testState.account,
  useAccountComments: (options: Record<string, unknown>) => {
    testState.accountCommentsOptions = options;
    return { accountComments: [] };
  },
  // Pages the matching votes the way the hooks library does.
  useAccountVotes: ({ vote, page = 0, pageSize }: { vote: number; page?: number; pageSize: number }) => {
    const votes = testState.votes.filter((accountVote) => accountVote.vote === vote);
    return { accountVotes: votes.slice(page * pageSize, page * pageSize + pageSize) };
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => createElement('a', { href: to, ...props }, children),
  useLocation: () => ({ pathname: testState.pathname }),
}));
vi.mock('../../hooks/use-author-profile', () => ({
  default: () => ({ address: 'me', shortAddress: 'me', postKarma: 1, commentKarma: 0, oldestCommentTimestamp: 1, moderatedCommunities: [] }),
}));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));
vi.mock('../../components/modern-user-profile', () => ({
  ModernUserHeader: () => null,
  ModernModeratorOf: () => null,
  ModernUserTabs: ({ tabs, children }: { tabs: { path: string; isActive: boolean }[]; children?: React.ReactNode }) =>
    createElement('nav', { 'data-active': tabs.find((tab) => tab.isActive)?.path }, children),
  ModernUserFeed: ({ stateKey }: { stateKey: string }) => createElement('div', { 'data-feed': stateKey }),
  ModernCidList: ({ cids, hasMore, onLoadMore }: { cids: string[]; hasMore: boolean; onLoadMore: () => void }) =>
    createElement('div', { 'data-cids': cids.join(',') }, hasMore && createElement('button', { 'data-load-more': true, onClick: onLoadMore })),
}));

let container: HTMLDivElement;
let root: Root;

const render = async (pathname: string) => {
  testState.pathname = pathname;
  await act(async () => root.render(createElement(ModernProfile, { key: pathname })));
};
const cids = () => container.querySelector('[data-cids]')?.getAttribute('data-cids')?.split(',').filter(Boolean) ?? [];
const loadMore = () => act(async () => container.querySelector<HTMLButtonElement>('[data-load-more]')!.click());

describe('ModernProfile', () => {
  beforeEach(() => {
    testState.votes = [];
    testState.account = { blockedCids: {}, savedComments: [] };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('picks the tab from the route and filters the account comments to posts', async () => {
    await render('/profile/submitted');
    expect(container.querySelector('nav')?.getAttribute('data-active')).toBe('/profile/submitted');
    expect(container.querySelector('[data-feed]')?.getAttribute('data-feed')).toBe('profile|submitted|new');
    const filter = testState.accountCommentsOptions?.filter as (publication: object) => boolean;
    expect(filter({ parentCid: undefined })).toBe(true);
    expect(filter({ parentCid: 'parent' })).toBe(false);

    await render('/profile/unknown');
    expect(container.querySelector('nav')?.getAttribute('data-active')).toBe('/profile');
  });

  it('pages upvoted comments ten at a time until none are left', async () => {
    testState.votes = [...Array.from({ length: 12 }, (_, index) => ({ commentCid: `up-${index}`, vote: 1 })), { commentCid: 'down-0', vote: -1 }];
    await render('/profile/upvoted');
    expect(cids()).toHaveLength(10);
    expect(cids()).not.toContain('down-0');

    await loadMore();
    expect(cids()).toHaveLength(12);
    expect(container.querySelector('[data-load-more]')).toBeNull();
  });

  it('lists hidden and saved comments without a sort', async () => {
    testState.account = { blockedCids: { hidden: true }, savedComments: ['saved'] };
    await render('/profile/hidden');
    expect(cids()).toEqual(['hidden']);
    expect(container.querySelector('select')).toBeNull();

    await render('/profile/saved');
    expect(cids()).toEqual(['saved']);
  });
});
