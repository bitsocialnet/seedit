// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CommunityLoadStatus } from '@bitsocial/bitsocial-react-hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FeedFooter from './feed-footer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({
  account: { blockedAddresses: {} as Record<string, boolean> },
  statuses: [] as Partial<CommunityLoadStatus>[],
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => testState.account,
  useCommunities: () => ({ communities: [], communityLoadStatuses: testState.statuses }),
}));
vi.mock('react-i18next', () => ({ Trans: () => null, useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/' }) }));
vi.mock('../../hooks/use-state-string', () => ({ useFeedStateString: () => undefined }));
vi.mock('../../hooks/use-feed-pagination', () => ({ useInfiniteFeedEnabled: () => true }));
vi.mock('../error-display', () => ({ default: ({ error }: { error?: Error }) => (error ? createElement('span', null, `error: ${error.message}|`) : null) }));
vi.mock('../loading-ellipsis', () => ({ default: ({ string }: { string: string }) => createElement('span', null, `${string}...`) }));
vi.mock('../feed-pagination', () => ({ default: () => null }));
vi.mock('../empty-feed-message', () => ({ default: () => createElement('span', null, 'empty feed') }));

const loaded: Partial<CommunityLoadStatus> = { state: 'succeeded', hasCachedData: true, firstLoadFailed: false };
const loading: Partial<CommunityLoadStatus> = { state: 'fetching-ipns', hasCachedData: false, firstLoadFailed: false };
const failed = (message: string): Partial<CommunityLoadStatus> => ({ state: 'failed', hasCachedData: false, firstLoadFailed: true, error: new Error(message) });
const retrying = (message: string): Partial<CommunityLoadStatus> => ({
  state: 'fetching-ipns',
  hasCachedData: false,
  firstLoadFailed: true,
  lastRetriableError: new Error(message),
});

let container: HTMLDivElement;
let root: Root;

const render = async (communityAddresses: string[], feedLength = 0) => {
  await act(async () =>
    root.render(createElement(FeedFooter, { requestKey: 'feed', feedLength, hasFeedLoaded: true, hasMore: true, communityAddresses, onLoadMore: vi.fn() })),
  );
};

describe('FeedFooter load failures', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    testState.statuses = [];
    testState.account = { blockedAddresses: {} };
  });

  it('shows a feed of one community that failed to load as failed, with its error', async () => {
    testState.statuses = [failed('No name resolver can handle this address')];
    await render(['example.xyz']);
    expect(container.textContent).toBe('error: No name resolver can handle this address|failed');
  });

  it('shows only the failed line when the failure has no message to show', async () => {
    testState.statuses = [failed('')];
    await render(['example.xyz']);
    expect(container.textContent).toBe('failed');
  });

  it('keeps loading a feed of one community that is retrying, and shows why', async () => {
    testState.statuses = [retrying('Domain resolver did not find the text record')];
    await render(['missing.bso']);
    expect(container.textContent).toBe('error: Domain resolver did not find the text record|loading_feed...');
  });

  it('shows an empty feed whose communities all failed to load as failed, with each reason once', async () => {
    testState.statuses = [failed('No name resolver can handle this address'), failed('Invalid signature'), failed('No name resolver can handle this address')];
    await render(['first.xyz', 'second.bso', 'third.xyz']);
    expect(container.textContent).toBe('error: No name resolver can handle this address|error: Invalid signature|failed');
  });

  it('keeps loading an empty feed whose communities are retrying after a failure, and shows why', async () => {
    testState.statuses = [failed('No name resolver can handle this address'), retrying('Domain resolver did not find the text record')];
    await render(['first.xyz', 'missing.bso']);
    expect(container.textContent).toBe('error: No name resolver can handle this address|error: Domain resolver did not find the text record|loading_feed...');
  });

  it('keeps loading as before while a community of the feed loaded or is still loading', async () => {
    testState.statuses = [failed('No name resolver can handle this address'), loaded];
    await render(['first.xyz', 'loaded.bso']);
    expect(container.textContent).toBe('loading_feed...');

    testState.statuses = [failed('No name resolver can handle this address'), loading];
    await render(['first.xyz', 'slow.bso']);
    expect(container.textContent).toBe('loading_feed...');
  });

  it('shows no load failure for a feed with posts', async () => {
    testState.statuses = [failed('No name resolver can handle this address'), failed('Invalid signature')];
    await render(['first.xyz', 'second.bso'], 3);
    expect(container.textContent).toBe('looking_for_more_posts...');
  });

  it('leaves the communities the account blocked out of a failed feed', async () => {
    testState.account = { blockedAddresses: { 'blocked.bso': true } };
    testState.statuses = [loaded, failed('No name resolver can handle this address')];
    await render(['blocked.bso', 'first.xyz']);
    expect(container.textContent).toBe('error: No name resolver can handle this address|failed');
  });
});
