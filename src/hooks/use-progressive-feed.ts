import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, type CommunityIdentifier, type UseFeedOptions, type UseFeedResult } from '@bitsocial/bitsocial-react-hooks';
import { FEED_POSTS_PER_PAGE } from './use-feed-pagination';
import useFeedWithCompatibleSort from './use-feed-with-compatible-sort';
import useSuggestionFeedLoader from './use-suggestion-feed-loader';
import {
  getAutomaticProgressiveTimeWindow,
  getManualProgressiveTimeWindow,
  getWiderProgressiveTimeWindows,
  progressiveTimeWindows,
  type ProgressiveTimeWindow,
  type ProgressiveTimeWindowProbe,
} from '../lib/utils/progressive-time-filter-utils';

interface UseProgressiveFeedOptions {
  enabled: boolean;
  feedOptions: UseFeedOptions;
}

const getCommunityKey = ({ name, publicKey }: CommunityIdentifier) => `${name}:${publicKey || ''}`;

const getProgressiveFeedKey = (options: UseFeedOptions): string =>
  [
    options.accountName || '',
    options.sortType || '',
    options.postsPerPage || '',
    options.filter?.key || '',
    options.newerThan ?? 'all',
    [...(options.communities || [])].map(getCommunityKey).sort().join(','),
  ].join('|');

const useProgressiveFeed = ({ enabled, feedOptions }: UseProgressiveFeedOptions): UseFeedResult & { requestKey: string } => {
  const lastAutomaticExpansionRef = useRef<{ feedKey: string; feedLength: number; hasMore: boolean; state: string } | undefined>(undefined);
  const accountId = useAccount({ accountName: feedOptions.accountName })?.id;
  const feedKey = useMemo(() => JSON.stringify([accountId, getProgressiveFeedKey(feedOptions)]), [accountId, feedOptions]);
  // Widening the time window continues the same request; changing its inputs does not.
  const requestKey = JSON.stringify([enabled, feedKey]);
  const [activeWindow, setActiveWindow] = useState<{ feedKey: string; newerThan?: number }>({ feedKey, newerThan: feedOptions.newerThan });
  const currentNewerThan = activeWindow.feedKey === feedKey ? activeWindow.newerThan : feedOptions.newerThan;
  const currentFeedOptions = useMemo(
    () => (currentNewerThan === feedOptions.newerThan ? feedOptions : { ...feedOptions, newerThan: currentNewerThan }),
    [currentNewerThan, feedOptions],
  );
  const baseFeed = useFeedWithCompatibleSort(currentFeedOptions);
  const shouldProbe = enabled && currentNewerThan !== undefined && baseFeed.state !== 'fetching-ipns' && !baseFeed.hasMore;
  const widerWindows = useMemo(() => getWiderProgressiveTimeWindows(currentNewerThan), [currentNewerThan]);
  const shouldProbeWindow = (name: ProgressiveTimeWindow['name']) => shouldProbe && widerWindows.some((window) => window.name === name);
  const suggestionTargetLength = Math.max(FEED_POSTS_PER_PAGE, baseFeed.feed.length + 1);

  const getSuggestionOptions = (window: ProgressiveTimeWindow): UseFeedOptions => ({
    ...feedOptions,
    communities: shouldProbeWindow(window.name) ? feedOptions.communities : [],
    newerThan: window.newerThan,
  });

  const weeklyFeed = useFeedWithCompatibleSort(getSuggestionOptions(progressiveTimeWindows[0]));
  const monthlyFeed = useFeedWithCompatibleSort(getSuggestionOptions(progressiveTimeWindows[1]));
  const yearlyFeed = useFeedWithCompatibleSort(getSuggestionOptions(progressiveTimeWindows[2]));
  const allTimeFeed = useFeedWithCompatibleSort(getSuggestionOptions(progressiveTimeWindows[3]));

  useSuggestionFeedLoader({
    feedLength: weeklyFeed.feed.length,
    hasMore: weeklyFeed.hasMore,
    loadMore: weeklyFeed.loadMore,
    requestKey: `${feedKey}:1w`,
    shouldLoad: shouldProbeWindow('1w'),
    targetFeedLength: suggestionTargetLength,
  });
  useSuggestionFeedLoader({
    feedLength: monthlyFeed.feed.length,
    hasMore: monthlyFeed.hasMore,
    loadMore: monthlyFeed.loadMore,
    requestKey: `${feedKey}:1m`,
    shouldLoad: shouldProbeWindow('1m'),
    targetFeedLength: suggestionTargetLength,
  });
  useSuggestionFeedLoader({
    feedLength: yearlyFeed.feed.length,
    hasMore: yearlyFeed.hasMore,
    loadMore: yearlyFeed.loadMore,
    requestKey: `${feedKey}:1y`,
    shouldLoad: shouldProbeWindow('1y'),
    targetFeedLength: suggestionTargetLength,
  });
  useSuggestionFeedLoader({
    feedLength: allTimeFeed.feed.length,
    hasMore: allTimeFeed.hasMore,
    loadMore: allTimeFeed.loadMore,
    requestKey: `${feedKey}:all`,
    shouldLoad: shouldProbeWindow('all'),
    targetFeedLength: suggestionTargetLength,
  });

  // useFeedWithCompatibleSort returns a new result object every render, so the probes memo keys on the primitives it
  // reads instead of on feed identity; otherwise probes (and the loadMore callback below) would change every render.
  const { hasMore: weeklyHasMore, state: weeklyState } = weeklyFeed;
  const { hasMore: monthlyHasMore, state: monthlyState } = monthlyFeed;
  const { hasMore: yearlyHasMore, state: yearlyState } = yearlyFeed;
  const { hasMore: allTimeHasMore, state: allTimeState } = allTimeFeed;
  const weeklyFeedLength = weeklyFeed.feed.length;
  const monthlyFeedLength = monthlyFeed.feed.length;
  const yearlyFeedLength = yearlyFeed.feed.length;
  const allTimeFeedLength = allTimeFeed.feed.length;

  const probes = useMemo<ProgressiveTimeWindowProbe[]>(
    () =>
      [
        { feedLength: weeklyFeedLength, hasMore: weeklyHasMore, state: weeklyState },
        { feedLength: monthlyFeedLength, hasMore: monthlyHasMore, state: monthlyState },
        { feedLength: yearlyFeedLength, hasMore: yearlyHasMore, state: yearlyState },
        { feedLength: allTimeFeedLength, hasMore: allTimeHasMore, state: allTimeState },
      ].map(({ feedLength, hasMore, state }, index) => ({
        ...progressiveTimeWindows[index],
        feedLength,
        settled: state !== 'fetching-ipns' && !hasMore,
      })),
    [
      allTimeFeedLength,
      allTimeHasMore,
      allTimeState,
      monthlyFeedLength,
      monthlyHasMore,
      monthlyState,
      weeklyFeedLength,
      weeklyHasMore,
      weeklyState,
      yearlyFeedLength,
      yearlyHasMore,
      yearlyState,
    ],
  );

  const expandToWindow = useCallback((window: ProgressiveTimeWindow) => setActiveWindow({ feedKey, newerThan: window.newerThan }), [feedKey]);

  const automaticWindow = shouldProbe ? getAutomaticProgressiveTimeWindow(currentNewerThan, baseFeed.feed.length, FEED_POSTS_PER_PAGE, probes) : undefined;
  const automaticWindowName = automaticWindow?.name;
  const automaticWindowNewerThan = automaticWindow?.newerThan;

  useEffect(() => {
    if (!automaticWindowName) return;
    const lastExpansion = lastAutomaticExpansionRef.current;
    if (
      lastExpansion?.feedKey === feedKey &&
      lastExpansion.feedLength === baseFeed.feed.length &&
      lastExpansion.hasMore === baseFeed.hasMore &&
      lastExpansion.state === baseFeed.state
    ) {
      return;
    }
    lastAutomaticExpansionRef.current = { feedKey, feedLength: baseFeed.feed.length, hasMore: baseFeed.hasMore, state: baseFeed.state };
    void expandToWindow({ name: automaticWindowName, newerThan: automaticWindowNewerThan });
  }, [automaticWindowName, automaticWindowNewerThan, baseFeed.feed.length, baseFeed.hasMore, baseFeed.state, expandToWindow, feedKey]);

  // Call the function directly rather than as a method so the callback depends on the function, not on the per-render
  // baseFeed object.
  const { loadMore: loadMoreBaseFeed } = baseFeed;
  const loadMore = useCallback(async () => {
    if (baseFeed.hasMore) {
      await loadMoreBaseFeed();
      return;
    }

    const nextWindow = enabled ? getManualProgressiveTimeWindow(currentNewerThan, baseFeed.feed.length, probes) : undefined;
    if (nextWindow) await expandToWindow(nextWindow);
  }, [baseFeed.feed.length, baseFeed.hasMore, currentNewerThan, enabled, expandToWindow, loadMoreBaseFeed, probes]);

  return {
    ...baseFeed,
    requestKey,
    hasMore: baseFeed.hasMore || (enabled && currentNewerThan !== undefined),
    loadMore,
  };
};

export default useProgressiveFeed;
