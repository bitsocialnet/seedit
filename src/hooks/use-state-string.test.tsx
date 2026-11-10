// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useStateString, { useFeedStateString } from './use-state-string';

const testState = vi.hoisted(() => ({
  clientsStates: {} as Record<string, string[]>,
  community: { address: 'news.bso', state: 'succeeded' } as Record<string, unknown>,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useClientsStates: () => ({ states: testState.clientsStates }),
  useCommunity: () => testState.community,
  useCommunitiesStates: () => ({ states: {} }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let result: string | undefined;

const StateStringHarness = ({ comment }: { comment: Record<string, unknown> }) => {
  result = useStateString(comment);
  return null;
};

const FeedStateStringHarness = ({ communityAddresses }: { communityAddresses: string[] }) => {
  result = useFeedStateString(communityAddresses);
  return null;
};

describe('useStateString', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    result = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    testState.clientsStates = {};
  });

  it('describes what each client is fetching', async () => {
    testState.clientsStates = { 'fetching-ipfs': ['https://gateway.example/'] };
    await act(async () => root.render(createElement(StateStringHarness, { comment: { state: 'fetching-ipfs' } })));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result).toBe('Fetching IPFS from gateway.example');
  });

  it('shows the pages a loaded community feed is still fetching', async () => {
    testState.clientsStates = { 'fetching-ipns': ['https://gateway.example/'], 'fetching-page-hot': ['https://rpc.example/'] };
    await act(async () => root.render(createElement(FeedStateStringHarness, { communityAddresses: ['news.bso'] })));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result).toBe('Fetching community from gateway.example, fetching page hot from rpc.example');
  });
});
