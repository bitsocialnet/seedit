// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Community } from '@bitsocial/bitsocial-react-hooks';
import useIsCommunityOffline, { getCommunityFreshnessNowSeconds } from './use-is-community-offline';

const testState = vi.hoisted(() => ({ syncInfo: {} as Record<string, unknown> }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({ useCommunity: () => testState.syncInfo }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../lib/utils/time-utils', () => ({ getFormattedTimeAgo: () => 'some time ago' }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const NOW_SECONDS = 1_800_000_000;
const THREE_HOURS = 3 * 60 * 60;

let container: HTMLDivElement;
let root: Root;
let hookResult: ReturnType<typeof useIsCommunityOffline>;

const HookHarness = ({ community }: { community: Community }) => {
  hookResult = useIsCommunityOffline(community);
  return null;
};

// renders the hook, then waits out its 30 second initial load so the result is final
const renderPastInitialLoad = async (community: Community) => {
  await act(() => root.render(createElement(HookHarness, { community })));
  await act(() => {
    vi.advanceTimersByTime(31_000);
  });
};

describe('useIsCommunityOffline', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW_SECONDS * 1000 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    testState.syncInfo = {};
  });

  // the record was 5 minutes old when it was last fetched, 3 hours ago
  const pausedCommunity = (address: string) => ({ address, updatedAt: NOW_SECONDS - THREE_HOURS - 5 * 60 }) as Community;

  it('keeps a community stopped since an online fetch online', async () => {
    testState.syncInfo = { syncState: 'stopped', lastSuccessfulFetchAt: NOW_SECONDS - THREE_HOURS };
    await renderPastInitialLoad(pausedCommunity('stopped.bso'));
    expect(hookResult.isOffline).toBe(false);
  });

  it('keeps a community online while its restarted update loads', async () => {
    testState.syncInfo = { syncState: 'loading', lastSuccessfulFetchAt: NOW_SECONDS - THREE_HOURS };
    await renderPastInitialLoad(pausedCommunity('restarting.bso'));
    expect(hookResult.isOffline).toBe(false);
  });

  it('shows a community offline when its record was already stale at the fetch before it stopped', async () => {
    testState.syncInfo = { syncState: 'stopped', lastSuccessfulFetchAt: NOW_SECONDS - THREE_HOURS };
    await renderPastInitialLoad({ address: 'stale-stopped.bso', updatedAt: NOW_SECONDS - 6 * 60 * 60 } as Community);
    expect(hookResult.isOffline).toBe(true);
  });

  it('judges a community by its record age now once its restarted update fails', async () => {
    testState.syncInfo = { syncState: 'loading', lastSuccessfulFetchAt: NOW_SECONDS - THREE_HOURS, lastRetriableError: new Error('timeout') };
    await renderPastInitialLoad(pausedCommunity('failing.bso'));
    expect(hookResult.isOffline).toBe(true);
    expect(hookResult.offlineTitle).toBe('posts_last_synced_info');
  });

  it('shows a community offline when its latest fetch still returns an old record', async () => {
    testState.syncInfo = { syncState: 'succeeded', lastSuccessfulFetchAt: NOW_SECONDS };
    await renderPastInitialLoad(pausedCommunity('old-record.bso'));
    expect(hookResult.isOffline).toBe(true);
  });
});

describe('getCommunityFreshnessNowSeconds', () => {
  it('measures now without a successful fetch to judge by', () => {
    expect(getCommunityFreshnessNowSeconds({ syncState: 'stopped' }, NOW_SECONDS)).toBe(NOW_SECONDS);
  });

  it('never measures after now', () => {
    expect(getCommunityFreshnessNowSeconds({ syncState: 'loading', lastSuccessfulFetchAt: NOW_SECONDS + 10 }, NOW_SECONDS)).toBe(NOW_SECONDS);
  });
});
