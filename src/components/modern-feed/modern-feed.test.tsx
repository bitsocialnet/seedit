// @vitest-environment jsdom

import * as React from 'react';
import { createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernFeed from './modern-feed';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({ statuses: [] as Record<string, unknown>[] }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => ({}),
  useCommunities: () => ({ communities: [], communityLoadStatuses: testState.statuses }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => createElement('a', null, children),
  useLocation: () => ({ pathname: '/', search: '' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));
vi.mock('react-virtuoso', () => ({
  // the footer is what this test reads
  Virtuoso: ({ components, context }: { components: { Footer: ComponentType<{ context: unknown }> }; context: unknown }) => createElement(components.Footer, { context }),
}));
vi.mock('../../hooks/use-community-identifier', () => ({
  useCommunityIdentifiers: (addresses: string[]) => addresses.map((address) => ({ name: address })),
}));
vi.mock('../../hooks/use-state-string', () => ({ useFeedStateString: () => '' }));
vi.mock('../modern-post-card', () => ({ default: () => null }));
vi.mock('../development-feed-reset-button', () => ({ default: () => null }));

let container: HTMLDivElement;
let root: Root;

const footerText = () => container.querySelector('[role="status"]')?.textContent;

const render = () =>
  act(async () =>
    root.render(
      createElement(ModernFeed, {
        basePath: '/',
        communityAddresses: ['a.bso', 'b.bso'],
        feed: [],
        hasMore: true,
        loadMore: vi.fn(),
        reset: vi.fn(),
        sessionKey: null,
        sortType: 'hot',
        timeFilterName: undefined,
      }),
    ),
  );

describe('ModernFeed footer', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('says an empty feed failed, and why, once every community failed to load', async () => {
    const unreachable = { firstLoadFailed: true, hasCachedData: false, state: 'failed', error: new Error('No name resolver can handle this address') };
    testState.statuses = [unreachable, { ...unreachable }];
    await render();
    expect(footerText()).toBe('No name resolver can handle this addressfailed');
  });

  it('keeps loading, with the reason, while a failed community is still retrying', async () => {
    testState.statuses = [
      { firstLoadFailed: true, hasCachedData: false, state: 'fetching-ipns', lastRetriableError: new Error('Domain resolver did not find the text record') },
      { firstLoadFailed: true, hasCachedData: false, state: 'failed', error: new Error('timeout') },
    ];
    await render();
    expect(footerText()).toBe('Domain resolver did not find the text recordtimeoutloading_feed');
  });
});
