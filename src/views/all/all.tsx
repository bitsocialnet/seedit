import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { useFeed } from '@bitsocialnet/bitsocial-react-hooks';
import { commentMatchesPattern } from '../../lib/utils/pattern-utils';
import useFeedFiltersStore from '../../stores/use-feed-filters-store';
import { useDefaultSubplebbitAddresses } from '../../hooks/use-default-subplebbits';
import useTimeFilter, { isValidTimeFilterName } from '../../hooks/use-time-filter';
import FeedFooter from '../../components/feed-footer';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import { sortTypes } from '../../constants/sort-types';
import styles from '../home/home.module.css';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

const All = () => {
  const subplebbitAddresses = useDefaultSubplebbitAddresses();
  const params = useParams<{ sortType?: string; timeFilterName?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const navigate = useNavigate();
  const location = useLocation();

  const sortType = params?.sortType && sortTypes.includes(params.sortType) ? params.sortType : sortTypes[0];

  const { timeFilterName, timeFilterSeconds, sessionKey, timeFilterNames } = useTimeFilter();

  useEffect(() => {
    if (!params.timeFilterName && !searchQuery && sessionKey) {
      const sessionPreference = sessionStorage.getItem(sessionKey);
      if (sessionPreference && timeFilterNames.includes(sessionPreference)) {
        const targetPath = `/s/all/${sortType}/${sessionPreference}${location.search}`;
        navigate(targetPath, { replace: true });
      }
    }
  }, [params.timeFilterName, searchQuery, sessionKey, sortType, navigate, location.search, location.pathname, timeFilterNames]);

  useEffect(() => {
    if ((params?.sortType && !sortTypes.includes(params.sortType)) || (params.timeFilterName && !isValidTimeFilterName(params.timeFilterName))) {
      navigate('/not-found', { replace: true });
    }
  }, [params?.sortType, params.timeFilterName, navigate]);

  const currentTimeFilterName = params.timeFilterName || timeFilterName || 'hot';

  const { isSearching } = useFeedFiltersStore();
  const [showNoResults, setShowNoResults] = useState(false);
  const [searchAttemptCompleted, setSearchAttemptCompleted] = useState(false);

  const feedOptions = useMemo(() => {
    const options: any = {
      newerThan: searchQuery ? 0 : timeFilterSeconds,
      sortType,
      subplebbitAddresses,
    };

    if (searchQuery) {
      options.filter = {
        filter: (comment: Comment) => {
          if (!searchQuery.trim()) return true;
          return commentMatchesPattern(comment, searchQuery);
        },
        key: `search-filter-${searchQuery}`,
      };
    }

    return options;
  }, [subplebbitAddresses, sortType, timeFilterSeconds, searchQuery]);

  const { feed, hasMore, loadMore, reset, subplebbitAddressesWithNewerPosts } = useFeed(feedOptions);

  // Reset no results state when search query changes
  useEffect(() => {
    setShowNoResults(false);
    setSearchAttemptCompleted(false);
  }, [searchQuery]);

  // Determine if search attempt is complete
  useEffect(() => {
    if (searchQuery && !isSearching && !searchAttemptCompleted) {
      setSearchAttemptCompleted(true);
    }
  }, [searchQuery, isSearching, searchAttemptCompleted]);

  // Logic to show "No results" message after a delay
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (searchQuery && feed?.length === 0 && searchAttemptCompleted) {
      timer = setTimeout(() => {
        setShowNoResults(true);
      }, 1500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchQuery, feed?.length, searchAttemptCompleted]);

  const { t } = useTranslation();

  const {
    feed: weeklyFeed,
    hasMore: hasMoreWeekly,
    loadMore: loadMoreWeekly,
  } = useFeed({
    subplebbitAddresses,
    sortType,
    newerThan: 60 * 60 * 24 * 7,
  });
  const {
    feed: monthlyFeed,
    hasMore: hasMoreMonthly,
    loadMore: loadMoreMonthly,
  } = useFeed({
    subplebbitAddresses,
    sortType,
    newerThan: 60 * 60 * 24 * 30,
  });
  const {
    feed: yearlyFeed,
    hasMore: hasMoreYearly,
    loadMore: loadMoreYearly,
  } = useFeed({
    subplebbitAddresses,
    sortType,
    newerThan: 60 * 60 * 24 * 365,
  });

  // Combined loadMore function for better performance when sort type isn't 'top'
  const combinedLoadMore = () => {
    loadMore();
    if (sortType !== 'top') {
      if (hasMoreWeekly) loadMoreWeekly();
      if (hasMoreMonthly) loadMoreMonthly();
      if (hasMoreYearly) loadMoreYearly();
    }
  };

  const documentTitle = 'seedit: ' + t('all_communities');
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[sortType + currentTimeFilterName + 'all' + searchQuery] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [sortType, currentTimeFilterName, searchQuery]);

  const lastVirtuosoState = lastVirtuosoStates?.[sortType + currentTimeFilterName + 'all' + searchQuery];

  const footerProps = {
    feedLength: feed?.length,
    hasFeedLoaded: !!feed,
    hasMore,
    subplebbitAddresses,
    subplebbitAddressesWithNewerPosts,
    weeklyFeedLength: weeklyFeed.length,
    monthlyFeedLength: monthlyFeed.length,
    yearlyFeedLength: yearlyFeed.length,
    currentTimeFilterName: searchQuery ? 'all' : currentTimeFilterName,
    reset,
    searchQuery: searchQuery,
    isSearching,
    showNoResults,
  };

  const handleClearSearch = () => {
    setSearchParams((prev) => {
      prev.delete('q');
      return prev;
    });
    reset();
  };

  return (
    <div>
      <div className={styles.content}>
        <div className={`${styles.sidebar}`}>
          <Sidebar />
        </div>
        {isSearching ? (
          <div className={styles.feed}>
            <div className={styles.footer}>
              <div className={styles.stateString}>
                <LoadingEllipsis string={t('searching')} />
              </div>
            </div>
          </div>
        ) : showNoResults && searchQuery ? (
          <div className={styles.feed}>
            <div className={styles.footer}>
              <div className={styles.stateString}>
                <span className={styles.noMatchesFound}>{t('no_matches_found_for', { query: searchQuery })}</span>
                <br />
                <br />
                <div className={styles.morePostsSuggestion}>
                  <span className={styles.link} onClick={handleClearSearch}>
                    {t('clear_search')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.feed}>
            {process.env.NODE_ENV !== 'production' && (
              <button className={styles.debugButton} onClick={reset}>
                Reset Feed
              </button>
            )}
            <Virtuoso
              increaseViewportBy={{ bottom: 1200, top: 600 }}
              totalCount={feed?.length || 0}
              data={feed}
              computeItemKey={(index, post) => post?.cid || index}
              itemContent={(index, post) => <Post key={post?.cid} index={index} post={post} />}
              useWindowScroll={true}
              components={{ Footer: () => <FeedFooter {...footerProps} /> }}
              endReached={combinedLoadMore}
              ref={virtuosoRef}
              restoreStateFrom={lastVirtuosoState}
              initialScrollTop={lastVirtuosoState?.scrollTop}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default All;
