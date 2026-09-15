// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Comment, UseFeedOptions, UseFeedResult } from '@bitsocial/bitsocial-react-hooks';
import useProgressiveFeed from './use-progressive-feed';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const day = 60 * 60 * 24;
const testState = vi.hoisted(() => ({
  accountId: 'account-a',
  baseFeedLength: 0,
  baseHasMore: false,
  probeLengths: new Map<number | undefined, number>(),
  enabledWindows: [] as (number | undefined)[],
  expandTimeWindow: vi.fn(async (_newerThan?: number) => {}),
  loadMore: vi.fn(async () => {}),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({ useAccount: () => ({ id: testState.accountId }) }));

const posts = (count: number): Comment[] => Array.from({ length: count }, (_, index) => ({ cid: `post-${index}` }) as Comment);

vi.mock('./use-feed-with-compatible-sort', () => ({
  default: (options: UseFeedOptions): UseFeedResult => {
    const isDisabled = options.communities?.length === 0;
    if (!isDisabled) testState.enabledWindows.push(options.newerThan);
    const isBaseFeed = options.newerThan === day;
    const feedLength = isDisabled ? 0 : isBaseFeed ? testState.baseFeedLength : (testState.probeLengths.get(options.newerThan) ?? 0);
    return {
      feed: posts(feedLength),
      hasMore: isBaseFeed ? testState.baseHasMore : false,
      loadMore: testState.loadMore,
      expandTimeWindow: testState.expandTimeWindow,
      reset: vi.fn(async () => {}),
      communityKeysWithNewerPosts: [],
      state: 'succeeded',
      error: undefined,
      errors: [],
    };
  },
}));

let container: HTMLDivElement;
let root: Root;
let hookResult: ReturnType<typeof useProgressiveFeed>;

const defaultFeedOptions: UseFeedOptions = {
  communities: [{ name: 'progressive-test.bso' }],
  newerThan: day,
  postsPerPage: 25,
  sortType: 'new',
};
const HookHarness = ({ feedOptions = defaultFeedOptions, enabled = true }: { feedOptions?: UseFeedOptions; enabled?: boolean }) => {
  hookResult = useProgressiveFeed({ enabled, feedOptions });
  return null;
};

describe('useProgressiveFeed', () => {
  beforeEach(() => {
    testState.accountId = 'account-a';
    testState.baseFeedLength = 0;
    testState.baseHasMore = false;
    testState.probeLengths = new Map();
    testState.enabledWindows = [];
    testState.expandTimeWindow.mockClear();
    testState.loadMore.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('waits for probes and promotes the narrowest full window without mutating the initial feed key', async () => {
    testState.baseFeedLength = 4;
    testState.probeLengths = new Map([
      [7 * day, 25],
      [30 * day, 40],
      [365 * day, 60],
      [undefined, 80],
    ]);

    await act(() => root.render(createElement(HookHarness)));

    expect(testState.expandTimeWindow).not.toHaveBeenCalled();
    expect(hookResult.feed).toHaveLength(25);
  });

  it('uses a broader ready probe when manual loading exhausts the current window', async () => {
    testState.baseFeedLength = 25;
    testState.probeLengths = new Map([
      [7 * day, 25],
      [30 * day, 31],
      [365 * day, 50],
      [undefined, 70],
    ]);

    await act(() => root.render(createElement(HookHarness)));
    const requestKey = hookResult.requestKey;
    await act(() => hookResult.loadMore());
    expect(hookResult.requestKey).toBe(requestKey);

    expect(testState.expandTimeWindow).not.toHaveBeenCalled();
    expect(hookResult.feed).toHaveLength(31);
  });

  it('keeps the same loadMore callback across re-renders while the feed results only change identity', async () => {
    testState.baseFeedLength = 4;
    testState.probeLengths = new Map([[undefined, 1]]);

    await act(() => root.render(createElement(HookHarness)));
    const firstLoadMore = hookResult.loadMore;

    // The mocked feed hook returns new result objects and arrays on every render, like the real hook does.
    await act(() => root.render(createElement(HookHarness)));

    expect(hookResult.loadMore).toBe(firstLoadMore);
  });

  it('starts from the configured window again after the feed remounts', async () => {
    testState.probeLengths = new Map([[undefined, 1]]);

    await act(() => root.render(createElement(HookHarness)));
    expect(hookResult.feed).toHaveLength(1);

    await act(() => root.unmount());
    root = createRoot(container);
    await act(() => root.render(createElement(HookHarness)));

    expect(testState.enabledWindows.filter((newerThan) => newerThan === day)).toHaveLength(2);
    expect(testState.expandTimeWindow).not.toHaveBeenCalled();
    expect(hookResult.feed).toHaveLength(1);
  });
  it('keeps pagination identity stable through equivalent inputs and automatic widening', async () => {
    testState.baseHasMore = true;
    testState.baseFeedLength = 4;
    const options = { ...defaultFeedOptions, communities: [{ name: 'one.bso' }, { name: 'two.bso' }] };
    await act(() => root.render(createElement(HookHarness, { feedOptions: options })));
    const requestKey = hookResult.requestKey;
    await act(() => root.render(createElement(HookHarness, { feedOptions: { ...options, communities: [...options.communities].reverse() } })));
    expect(hookResult.requestKey).toBe(requestKey);
    testState.baseHasMore = false;
    testState.probeLengths = new Map([[7 * day, 25]]);
    await act(() => root.render(createElement(HookHarness, { feedOptions: options })));
    expect(hookResult.feed).toHaveLength(25);
    expect(hookResult.requestKey).toBe(requestKey);
  });

  it.each([
    ['sort', { sortType: 'hot' }],
    ['time window', { newerThan: 7 * day }],
    ['community set', { communities: [{ name: 'other.bso' }] }],
    ['domain filter', { filter: { key: 'domain-other.bso', filter: () => true } }],
  ])('changes pagination identity when the %s changes', async (_name, change) => {
    testState.baseHasMore = true;
    await act(() => root.render(createElement(HookHarness)));
    const requestKey = hookResult.requestKey;
    await act(() => root.render(createElement(HookHarness, { feedOptions: { ...defaultFeedOptions, ...change } })));
    expect(hookResult.requestKey).not.toBe(requestKey);
  });

  it('changes pagination identity when the selected account or loading mode changes', async () => {
    testState.baseHasMore = true;
    await act(() => root.render(createElement(HookHarness)));
    const firstKey = hookResult.requestKey;
    testState.accountId = 'account-b';
    await act(() => root.render(createElement(HookHarness)));
    const secondKey = hookResult.requestKey;
    expect(secondKey).not.toBe(firstKey);
    await act(() => root.render(createElement(HookHarness, { enabled: false })));
    expect(hookResult.requestKey).not.toBe(secondKey);
  });
});
