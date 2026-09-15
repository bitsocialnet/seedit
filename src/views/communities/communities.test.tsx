// @vitest-environment jsdom

import { act, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useErrorStore from '../../stores/use-error-store';
import Communities from './communities';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type TestCommunity = { address: string; title: string; settings: Record<string, never> };

const testState = vi.hoisted(() => ({
  account: { author: { address: 'account-address' }, subscriptions: ['first.bso', 'second.bso'] },
  accountCommunitySnapshot: { accountCommunities: {} as Record<string, TestCommunity>, error: undefined as Error | undefined },
  accountCommunityListeners: new Set<() => void>(),
  communities: [] as TestCommunity[],
  defaults: [
    { address: 'first.bso', tags: ['other'] },
    { address: 'second.bso', tags: ['selected'] },
  ],
  accountRender: vi.fn(),
  rowRender: vi.fn(),
  sidebarRender: vi.fn(),
  directoryRender: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => {
    testState.accountRender();
    return testState.account;
  },
  useAccountCommunities: () =>
    useSyncExternalStore(
      (listener) => {
        testState.accountCommunityListeners.add(listener);
        return () => testState.accountCommunityListeners.delete(listener);
      },
      () => testState.accountCommunitySnapshot,
    ),
  useCommunities: () => ({ communities: testState.communities, error: undefined }),
}));

vi.mock('react-i18next', () => ({
  Trans: () => null,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../hooks/use-default-subscriptions', () => ({ useDefaultSubscriptions: () => testState.defaults }));
vi.mock('../../components/sidebar', () => ({
  default: () => {
    testState.sidebarRender();
    return <aside>sidebar</aside>;
  },
}));
vi.mock('./directory-vote', () => ({
  DirectoryVoteNotice: () => null,
  DirectoryCandidates: () => null,
  DirectoryIndex: () => {
    testState.directoryRender();
    return <div>directory index</div>;
  },
}));
vi.mock('./community-item', () => ({
  default: function CommunityItemProbe({ community, index }: { community: TestCommunity; index: number }) {
    testState.rowRender();
    const [expanded, setExpanded] = useState(false);
    return (
      <div data-community-address={community.address} data-rank={index + 1}>
        {community.title}
        <button onClick={() => setExpanded(!expanded)}>{expanded ? 'expanded' : 'collapsed'}</button>
      </div>
    );
  },
  NoCommunitiesMessage: () => <div>nothing found</div>,
}));

describe('Communities rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderCommunities = async (path: string) => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Link data-testid='tag-filter' to='/communities/moderator?tag=selected'>
            filter
          </Link>
          <Communities />
        </MemoryRouter>,
      );
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useErrorStore.getState().clearAllErrors();
    const first = { address: 'first.bso', title: 'First community', settings: {} };
    const second = { address: 'second.bso', title: 'Second community', settings: {} };
    testState.accountCommunitySnapshot = { accountCommunities: { [first.address]: first, [second.address]: second }, error: undefined };
    testState.communities = [first, second];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    useErrorStore.getState().clearAllErrors();
    vi.restoreAllMocks();
  });

  it.each([
    ['/communities', 'AllAccountCommunities_useCommunities'],
    ['/communities/subscriber', 'SubscriberCommunities_useCommunities'],
    ['/communities/moderator', 'AccountCommunities_useAccountCommunities'],
    ['/communities/admin', 'AccountCommunities_useAccountCommunities'],
    ['/communities/owner', 'AccountCommunities_useAccountCommunities'],
  ])('keeps unchanged rows quiet when errors are published and cleared in %s', async (path, source) => {
    await renderCommunities(path);
    expect(container.querySelectorAll('[data-community-address]')).toHaveLength(2);
    vi.clearAllMocks();

    await act(async () => {
      useErrorStore.getState().setError(source, new Error('Visible list error'));
      useErrorStore.getState().setError('unrelated-source', new Error('Unrelated error'));
    });
    expect(container.textContent).toContain('error: Visible list error');
    expect(container.textContent).not.toContain('Unrelated error');

    await act(async () => useErrorStore.getState().clearAllErrors());
    expect(container.textContent).not.toContain('Visible list error');
    expect(testState.rowRender).not.toHaveBeenCalled();
    expect(testState.accountRender).not.toHaveBeenCalled();
    expect(testState.sidebarRender).not.toHaveBeenCalled();
  });

  it('still publishes and clears hook errors without a second render of the unchanged list', async () => {
    await renderCommunities('/communities/moderator');
    testState.rowRender.mockClear();

    await act(async () => {
      testState.accountCommunitySnapshot = { ...testState.accountCommunitySnapshot, error: new Error('Account lookup failed') };
      for (const listener of testState.accountCommunityListeners) listener();
    });
    expect(container.textContent).toContain('error: Account lookup failed');
    expect(testState.rowRender).toHaveBeenCalledTimes(2);
    testState.rowRender.mockClear();

    await act(async () => {
      testState.accountCommunitySnapshot = { ...testState.accountCommunitySnapshot, error: undefined };
      for (const listener of testState.accountCommunityListeners) listener();
    });
    expect(container.textContent).not.toContain('Account lookup failed');
    expect(testState.rowRender).toHaveBeenCalledTimes(2);
  });

  it('keeps account-community row state attached to its address when reordered and filtered', async () => {
    await renderCommunities('/communities/moderator');
    const secondRow = container.querySelector<HTMLElement>('[data-community-address="second.bso"]');
    expect(secondRow).not.toBeNull();
    await act(async () => secondRow?.querySelector('button')?.click());

    await act(async () => {
      const first = testState.accountCommunitySnapshot.accountCommunities['first.bso'];
      const second = testState.accountCommunitySnapshot.accountCommunities['second.bso'];
      testState.accountCommunitySnapshot = { accountCommunities: { [second.address]: second, [first.address]: first }, error: undefined };
      for (const listener of testState.accountCommunityListeners) listener();
    });
    expect(Array.from(container.querySelectorAll('[data-community-address]')).map((row) => row.getAttribute('data-community-address'))).toEqual([
      'second.bso',
      'first.bso',
    ]);
    expect(container.querySelector('[data-community-address="second.bso"]')).toBe(secondRow);
    expect(secondRow?.querySelector('button')?.textContent).toBe('expanded');

    await act(async () => container.querySelector<HTMLAnchorElement>('[data-testid="tag-filter"]')?.click());
    expect(container.querySelectorAll('[data-community-address]')).toHaveLength(1);
    expect(container.querySelector('[data-community-address="second.bso"]')).toBe(secondRow);
    expect(secondRow?.querySelector('button')?.textContent).toBe('expanded');
    expect(secondRow?.getAttribute('data-rank')).toBe('1');
  });

  it('keeps directory content isolated from errors belonging to account lists', async () => {
    await renderCommunities('/communities/directories');
    expect(container.textContent).toContain('directory index');
    vi.clearAllMocks();

    await act(async () => {
      useErrorStore.getState().setError('Infobar_useAccountCommunities', new Error('Account lookup failed'));
    });
    expect(container.textContent).not.toContain('Account lookup failed');
    expect(testState.directoryRender).not.toHaveBeenCalled();
    expect(testState.sidebarRender).not.toHaveBeenCalled();
  });
});
