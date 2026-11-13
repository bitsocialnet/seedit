import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { getCanonicalTopPath, getFeedSortType, getRouteSortType, isLegacyTopRoute } from '../constants/sort-types';
import { getPathWithoutTimeFilter } from '../lib/utils/time-filter-utils';
import { getCommunityIdentifiers } from './use-community-identifier';
import { FEED_POSTS_PER_PAGE } from './use-feed-pagination';
import useProgressiveFeed from './use-progressive-feed';
import useTimeFilter from './use-time-filter';

/**
 * The feed for a `/:sortType?/:timeFilterName?` route over the given communities, plus the canonical path the route
 * should be replaced with when its sort or time filter segment is legacy or does not apply.
 */
const useFeedRoute = (communityAddresses: string[]) => {
  const params = useParams<{ sortType?: string; timeFilterName?: string }>();
  const location = useLocation();
  const sortType = getRouteSortType(params.sortType);
  const feedSortType = getFeedSortType(sortType);
  const { timeFilterName, timeFilterSeconds, sessionKey, preferredTopTimeFilterPath } = useTimeFilter();

  const feedOptions = useMemo(
    () => ({
      newerThan: timeFilterSeconds,
      postsPerPage: FEED_POSTS_PER_PAGE,
      sortType: feedSortType,
      communities: getCommunityIdentifiers(communityAddresses),
    }),
    [communityAddresses, feedSortType, timeFilterSeconds],
  );
  const feedResult = useProgressiveFeed({ enabled: sortType !== 'top', feedOptions });

  let redirectPath: string | undefined;
  if (isLegacyTopRoute(params.sortType)) redirectPath = getCanonicalTopPath(location.pathname, location.search);
  else if (preferredTopTimeFilterPath) redirectPath = preferredTopTimeFilterPath;
  else if (sortType !== 'top' && params.timeFilterName) redirectPath = getPathWithoutTimeFilter(location.pathname, params.timeFilterName, location.search);

  return { ...feedResult, sortType, timeFilterName, sessionKey, redirectPath };
};

export default useFeedRoute;
