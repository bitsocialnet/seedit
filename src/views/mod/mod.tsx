import { useEffect, useRef, useMemo } from 'react';
import { Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { useAccountCommunities } from '@bitsocial/bitsocial-react-hooks';
import { useTranslation } from 'react-i18next';
import useTimeFilter, { isValidTimeFilterName, isValidTopTimeFilterName } from '../../hooks/use-time-filter';
import { FEED_POSTS_PER_PAGE, useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import FeedFooter from '../../components/feed-footer';
import DevelopmentFeedResetButton from '../../components/development-feed-reset-button';
import TopTimeFilter from '../../components/top-time-filter';
import { getCommunityIdentifiers } from '../../hooks/use-community-identifier';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import { getCanonicalTopPath, getFeedSortType, getRouteSortType, isLegacyTopRoute, isValidRouteSortType } from '../../constants/sort-types';
import useProgressiveFeed from '../../hooks/use-progressive-feed';
import { getPathWithoutTimeFilter } from '../../lib/utils/time-filter-utils';
import layoutStyles from '../../components/feed-layout';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

const Mod = () => {
  const { accountCommunities } = useAccountCommunities();
  const communityAddresses = useMemo(() => Object.keys(accountCommunities ?? {}), [accountCommunities]);
  const params = useParams<{ sortType?: string; timeFilterName?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { timeFilterName, timeFilterSeconds, sessionKey, preferredTopTimeFilterPath } = useTimeFilter();

  const sortType = getRouteSortType(params.sortType);
  const feedSortType = getFeedSortType(sortType);

  const currentTimeFilterName = params.timeFilterName || timeFilterName || (sortType === 'top' ? 'all' : '24h');

  useEffect(() => {
    const hasInvalidTimeFilter = sortType === 'top' ? !isValidTopTimeFilterName(params.timeFilterName) : !isValidTimeFilterName(params.timeFilterName);
    if (!isValidRouteSortType(params.sortType) || hasInvalidTimeFilter) {
      navigate('/not-found', { replace: true });
    }
  }, [params?.sortType, params.timeFilterName, sortType, navigate]);

  const infiniteFeedEnabled = useInfiniteFeedEnabled();
  const { t } = useTranslation();

  const feedOptions = useMemo(
    () => ({
      newerThan: timeFilterSeconds,
      postsPerPage: FEED_POSTS_PER_PAGE,
      sortType: feedSortType,
      communities: getCommunityIdentifiers(communityAddresses),
    }),
    [communityAddresses, feedSortType, timeFilterSeconds],
  );

  const { feed, hasMore, loadMore, reset } = useProgressiveFeed({ enabled: sortType !== 'top', feedOptions });

  const documentTitle = 'seedit: ' + t('communities_you_moderate');
  useEffect(() => {
    document.title = documentTitle.toLowerCase();
  }, [documentTitle]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[sortType + currentTimeFilterName + 'mod'] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [sortType, currentTimeFilterName]);

  const lastVirtuosoState = lastVirtuosoStates?.[sortType + currentTimeFilterName + 'mod'];

  const footerProps = {
    feedLength: feed?.length ?? 0,
    hasFeedLoaded: !!feed,
    hasMore,
    communityAddresses,
    onLoadMore: loadMore,
  };

  if (isLegacyTopRoute(params.sortType)) {
    return <Navigate to={getCanonicalTopPath(location.pathname, location.search)} replace />;
  }

  if (preferredTopTimeFilterPath) {
    return <Navigate to={preferredTopTimeFilterPath} replace />;
  }

  if (sortType !== 'top' && params.timeFilterName) {
    return <Navigate to={getPathWithoutTimeFilter(location.pathname, params.timeFilterName, location.search)} replace />;
  }

  return (
    <div>
      <div className={layoutStyles.content}>
        <div className={`${layoutStyles.sidebar}`}>
          <Sidebar />
        </div>
        <div className={layoutStyles.feed}>
          <DevelopmentFeedResetButton onReset={reset} />
          {sortType === 'top' && <TopTimeFilter selectedTimeFilterName={currentTimeFilterName} sessionKey={sessionKey} />}
          <Virtuoso
            increaseViewportBy={{ bottom: 1200, top: 600 }}
            totalCount={feed?.length || 0}
            data={feed}
            computeItemKey={(index, post) => post?.cid || index}
            itemContent={(index, post) => <Post key={post?.cid} index={index} post={post} />}
            useWindowScroll={true}
            components={{ Footer: () => <FeedFooter {...footerProps} /> }}
            endReached={infiniteFeedEnabled ? loadMore : undefined}
            ref={virtuosoRef}
            restoreStateFrom={lastVirtuosoState}
            initialScrollTop={lastVirtuosoState?.scrollTop}
          />
        </div>
      </div>
    </div>
  );
};

export default Mod;
