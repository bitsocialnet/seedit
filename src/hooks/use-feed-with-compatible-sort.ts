import { useCallback, useMemo } from 'react';
import { useCommunities, useFeed, type UseFeedOptions, type UseFeedResult } from '@bitsocial/bitsocial-react-hooks';
import { getFeedCommunityGroups, hasLoadingFeedCommunities, hasUnresolvedPostSortMetadata, mergeAndSortFeeds } from '../lib/utils/feed-sort-utils';

export type UseFeedWithCompatibleSortResult = UseFeedResult & {
  /** Some of the feed's communities have not loaded their first record yet. */
  isLoadingCommunities: boolean;
};

/**
 * PKC only publishes its preloaded `hot` page when every post fits in that page. The page is a complete data set,
 * so Seedit can reuse it for built-in client sorts instead of treating the absent page key as an empty community.
 * Paginated communities continue to use the requested protocol page.
 */
const useFeedWithCompatibleSort = (options: UseFeedOptions = {}): UseFeedWithCompatibleSortResult => {
  const communityIdentifiers = useMemo(() => options.communities || [], [options.communities]);
  const {
    communities,
    state: communitiesState,
    error: communitiesError,
    errors: communitiesErrors,
  } = useCommunities({ communities: communityIdentifiers, accountName: options.accountName });
  const { requestedSortCommunities, preloadedSortCommunities } = useMemo(
    () => getFeedCommunityGroups(communityIdentifiers, communities, options.sortType),
    [communityIdentifiers, communities, options.sortType],
  );

  const sharedOptions = useMemo(() => {
    const { communities: _communities, sortType: _sortType, ...rest } = options;
    return rest;
  }, [options]);

  const requestedSortFeed = useFeed({ ...sharedOptions, communities: requestedSortCommunities, sortType: options.sortType });
  const preloadedSortFeed = useFeed({ ...sharedOptions, communities: preloadedSortCommunities, sortType: undefined });
  const {
    hasMore: requestedSortHasMore,
    loadMore: loadMoreRequestedSort,
    expandTimeWindow: expandRequestedSortTimeWindow,
    reset: resetRequestedSort,
  } = requestedSortFeed;
  const {
    hasMore: preloadedSortHasMore,
    loadMore: loadMorePreloadedSort,
    expandTimeWindow: expandPreloadedSortTimeWindow,
    reset: resetPreloadedSort,
  } = preloadedSortFeed;

  const feed = useMemo(
    () => mergeAndSortFeeds(requestedSortFeed.feed, preloadedSortFeed.feed, options.sortType),
    [options.sortType, preloadedSortFeed.feed, requestedSortFeed.feed],
  );
  const communityKeysWithNewerPosts = useMemo(
    () => [...new Set([...requestedSortFeed.communityKeysWithNewerPosts, ...preloadedSortFeed.communityKeysWithNewerPosts])],
    [preloadedSortFeed.communityKeysWithNewerPosts, requestedSortFeed.communityKeysWithNewerPosts],
  );
  const communityKeysWithMore = useMemo(
    () => [...new Set([...requestedSortFeed.communityKeysWithMore, ...preloadedSortFeed.communityKeysWithMore])],
    [preloadedSortFeed.communityKeysWithMore, requestedSortFeed.communityKeysWithMore],
  );
  const communityKeysWithUnavailableSort = useMemo(
    () => [...new Set([...requestedSortFeed.communityKeysWithUnavailableSort, ...preloadedSortFeed.communityKeysWithUnavailableSort])],
    [preloadedSortFeed.communityKeysWithUnavailableSort, requestedSortFeed.communityKeysWithUnavailableSort],
  );

  const loadMore = useCallback(async () => {
    await Promise.all([
      requestedSortHasMore && requestedSortCommunities.length > 0 ? loadMoreRequestedSort() : Promise.resolve(),
      preloadedSortHasMore && preloadedSortCommunities.length > 0 ? loadMorePreloadedSort() : Promise.resolve(),
    ]);
  }, [loadMorePreloadedSort, loadMoreRequestedSort, preloadedSortCommunities.length, preloadedSortHasMore, requestedSortCommunities.length, requestedSortHasMore]);

  const expandTimeWindow = useCallback(
    async (newerThan?: number) => {
      await Promise.all([
        requestedSortCommunities.length > 0 ? expandRequestedSortTimeWindow(newerThan) : Promise.resolve(),
        preloadedSortCommunities.length > 0 ? expandPreloadedSortTimeWindow(newerThan) : Promise.resolve(),
      ]);
    },
    [expandPreloadedSortTimeWindow, expandRequestedSortTimeWindow, preloadedSortCommunities.length, requestedSortCommunities.length],
  );

  const reset = useCallback(async () => {
    await Promise.all([
      requestedSortCommunities.length > 0 ? resetRequestedSort() : Promise.resolve(),
      preloadedSortCommunities.length > 0 ? resetPreloadedSort() : Promise.resolve(),
    ]);
  }, [preloadedSortCommunities.length, requestedSortCommunities.length, resetPreloadedSort, resetRequestedSort]);

  const hasUnresolvedCommunities = communitiesState === 'fetching-ipns';
  const hasUnresolvedSortMetadata = hasUnresolvedPostSortMetadata(communities, options.sortType);
  const hasMore = hasUnresolvedCommunities || hasUnresolvedSortMetadata || requestedSortHasMore || preloadedSortHasMore;

  return {
    feed,
    hasMore,
    loadMore,
    expandTimeWindow,
    reset,
    communityKeysWithNewerPosts,
    communityKeysWithMore,
    communityKeysWithUnavailableSort,
    isLoadingCommunities: hasLoadingFeedCommunities(communities),
    state: communitiesState === 'failed' ? 'failed' : hasMore ? 'fetching-ipns' : 'succeeded',
    error: communitiesError || requestedSortFeed.error || preloadedSortFeed.error,
    errors: [...communitiesErrors, ...requestedSortFeed.errors, ...preloadedSortFeed.errors],
  };
};

export default useFeedWithCompatibleSort;
