import { memo, useEffect, useRef, useState, useMemo, useCallback, type ComponentProps } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { Comment, CommentsFilter } from '@bitsocial/bitsocial-react-hooks';
import { useDefaultSubscriptionAddresses } from '../../hooks/use-default-subscriptions';
import useTimeFilter, { isValidTimeFilterName, isValidTopTimeFilterName } from '../../hooks/use-time-filter';
import { FEED_POSTS_PER_PAGE, useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import FeedFooter from '../../components/feed-footer';
import TopTimeFilter from '../../components/top-time-filter';
import { getCommunityIdentifiers } from '../../hooks/use-community-identifier';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import layoutStyles from '../../components/feed-layout';
import { getCanonicalTopPath, getFeedSortType, getRouteSortType, isLegacyTopRoute, isValidRouteSortType } from '../../constants/sort-types';
import useProgressiveFeed from '../../hooks/use-progressive-feed';
import { getPathWithoutTimeFilter } from '../../lib/utils/time-filter-utils';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

type DomainFeedContext = ComponentProps<typeof FeedFooter>;

// Keep the component type stable so feed updates preserve pagination state.
const DomainFeedFooter = ({ context }: { context: DomainFeedContext }) => <FeedFooter {...context} />;
const feedComponents = { Footer: DomainFeedFooter };
const DomainSidebar = memo(Sidebar);
const renderPost = (index: number, post: Comment) => <Post index={index} post={post} />;

const Domain = () => {
  const communityAddresses = useDefaultSubscriptionAddresses();
  const params = useParams<{ domain?: string; sortType?: string; timeFilterName?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const domain = params?.domain;
  const sortType = getRouteSortType(params.sortType);
  const feedSortType = getFeedSortType(sortType);
  const { timeFilterName, timeFilterSeconds, sessionKey, preferredTopTimeFilterPath } = useTimeFilter();
  const currentTimeFilterName = params.timeFilterName || timeFilterName || 'all';

  const infiniteFeedEnabled = useInfiniteFeedEnabled();
  const [showNoResults, setShowNoResults] = useState(false);

  useEffect(() => {
    const hasInvalidTimeFilter = sortType === 'top' ? !isValidTopTimeFilterName(params.timeFilterName) : !isValidTimeFilterName(params.timeFilterName);
    if (!isValidRouteSortType(params.sortType) || hasInvalidTimeFilter) {
      navigate('/not-found', { replace: true });
    }
  }, [params?.sortType, params.timeFilterName, sortType, navigate]);

  const matchesDomain = useCallback(
    (comment: Comment) => {
      if (!domain || !comment?.link) return false;
      try {
        const url = new URL(comment.link);
        const hostname = url.hostname;

        if (hostname === domain) return true;

        return hostname.endsWith(`.${domain}`) || hostname === domain;
      } catch {
        return false;
      }
    },
    [domain],
  );

  const feedOptions = useMemo(() => {
    const options: {
      newerThan: number | undefined;
      postsPerPage: number;
      sortType: string;
      communities: ReturnType<typeof getCommunityIdentifiers>;
      filter: CommentsFilter;
    } = {
      newerThan: timeFilterSeconds,
      postsPerPage: FEED_POSTS_PER_PAGE,
      sortType: feedSortType,
      communities: getCommunityIdentifiers(communityAddresses),
      filter: { filter: matchesDomain, key: `domain-filter-${domain}` },
    };

    return options;
  }, [communityAddresses, feedSortType, timeFilterSeconds, matchesDomain, domain]);

  const { feed, hasMore, loadMore } = useProgressiveFeed({ enabled: sortType !== 'top', feedOptions });

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (domain && feed?.length === 0 && !showNoResults) {
      timer = setTimeout(() => {
        setShowNoResults(true);
      }, 2000);
    } else if (!domain || feed?.length > 0) {
      setShowNoResults(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [domain, feed?.length, showNoResults]);

  const documentTitle = domain + ' - Seedit';
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[sortType + currentTimeFilterName + 'domain'] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [sortType, currentTimeFilterName]);

  const lastVirtuosoState = lastVirtuosoStates?.[sortType + currentTimeFilterName + 'domain'];

  const footerProps = useMemo<DomainFeedContext>(
    () => ({
      feedLength: feed?.length ?? 0,
      hasFeedLoaded: !!feed,
      hasMore,
      communityAddresses,
      onLoadMore: loadMore,
    }),
    [feed, hasMore, communityAddresses, loadMore],
  );

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
          <DomainSidebar />
        </div>
        {showNoResults ? (
          <div className={layoutStyles.feed}>
            <div className={layoutStyles.footer}>
              <div className={layoutStyles.stateString}>
                <span className={layoutStyles.noMatchesFound}>No posts found from {domain}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {sortType === 'top' && <TopTimeFilter selectedTimeFilterName={currentTimeFilterName} sessionKey={sessionKey} />}
            <Virtuoso<Comment, DomainFeedContext>
              increaseViewportBy={{ bottom: 1200, top: 600 }}
              totalCount={feed?.length || 0}
              data={feed}
              itemContent={renderPost}
              useWindowScroll={true}
              components={feedComponents}
              context={footerProps}
              endReached={infiniteFeedEnabled ? loadMore : undefined}
              ref={virtuosoRef}
              restoreStateFrom={lastVirtuosoState}
              initialScrollTop={lastVirtuosoState?.scrollTop}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Domain;
