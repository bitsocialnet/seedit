// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FeedFooter from './feed-footer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({ community: {} as Record<string, unknown> }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useCommunities: () => ({ communities: [] }),
  useCommunity: (options?: unknown) => (options ? testState.community : {}),
}));
vi.mock('react-i18next', () => ({ Trans: () => null, useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/' }) }));
vi.mock('../../hooks/use-state-string', () => ({ useFeedStateString: () => undefined }));
vi.mock('../../hooks/use-feed-pagination', () => ({ useInfiniteFeedEnabled: () => true }));
vi.mock('../error-display', () => ({ default: ({ error }: { error?: Error }) => (error ? createElement('span', null, `error: ${error.message}|`) : null) }));
vi.mock('../loading-ellipsis', () => ({ default: ({ string }: { string: string }) => createElement('span', null, `${string}...`) }));
vi.mock('../feed-pagination', () => ({ default: () => null }));
vi.mock('../empty-feed-message', () => ({ default: () => createElement('span', null, 'empty feed') }));

let container: HTMLDivElement;
let root: Root;

const render = async (communityAddresses: string[]) => {
  await act(async () =>
    root.render(createElement(FeedFooter, { requestKey: 'feed', feedLength: 0, hasFeedLoaded: true, hasMore: true, communityAddresses, onLoadMore: vi.fn() })),
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
    testState.community = {};
  });

  it('shows a feed of one community that failed to load as failed, with its error', async () => {
    testState.community = { state: 'failed', firstLoadFailed: true, error: new Error('No name resolver can handle this address') };
    await render(['example.xyz']);
    expect(container.textContent).toBe('error: No name resolver can handle this address|failed');
  });

  it('keeps loading a feed of one community that is retrying, and shows why', async () => {
    testState.community = { state: 'fetching-ipns', firstLoadFailed: true, lastRetriableError: new Error('Domain resolver did not find the text record') };
    await render(['missing.bso']);
    expect(container.textContent).toBe('error: Domain resolver did not find the text record|loading_feed...');
  });

  it('keeps loading an empty feed of several communities', async () => {
    testState.community = { state: 'failed', firstLoadFailed: true, error: new Error('not read for several communities') };
    await render(['first.bso', 'second.bso']);
    expect(container.textContent).toBe('loading_feed...');
  });
});
