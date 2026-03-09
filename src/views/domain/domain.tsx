import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { useFeed, Comment, CommentsFilter } from '@bitsocialnet/bitsocial-react-hooks';
import { commentMatchesPattern } from '../../lib/utils/pattern-utils';
import useFeedFiltersStore from '../../stores/use-feed-filters-store';
import { useDefaultSubplebbitAddresses } from '../../hooks/use-default-subplebbits';
import useTimeFilter, { isValidTimeFilterName } from '../../hooks/use-time-filter';
import FeedFooter from '../../components/feed-footer';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import styles from '../home/home.module.css';
import { sortTypes } from '../../constants/sort-types';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

const Domain = () => {
  const subplebbitAddresses = useDefaultSubplebbitAddresses();
  const params = useParams<{ domain?: string; sortType?: string; timeFilterName?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get('q') || '';
  const domain = params?.domain;
  const sortType = params?.sortType && sortTypes.includes(params.sortType) ? params.sortType : sortTypes[0];
  const { timeFilterName, timeFilterSeconds } = useTimeFilter();
  const currentTimeFilterName = params.timeFilterName || timeFilterName || 'all';

  const { isSearching } = useFeedFiltersStore();
  const [showNoResults, setShowNoResults] = useState(false);
  const [searchAttemptCompleted, setSearchAttemptCompleted] = useState(false);

  useEffect(() => {
    if ((params?.sortType && !sortTypes.includes(params.sortType)) || (params.timeFilterName && !isValidTimeFilterName(params.timeFilterName))) {
      navigate('/not-found', { replace: true });
    }
  }, [params?.sortType, params.timeFilterName, navigate]);

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
    const filterFunc = (comment: Comment) => {
      const domainMatches = matchesDomain(comment);
      if (searchQuery) {
        return domainMatches && commentMatchesPattern(comment, searchQuery);
      }
      return domainMatches;
    };

    const filterKey = searchQuery ? `search-filter-${domain}-${searchQuery}` : `domain-filter-${domain}`;

    const options: {
      newerThan: number;
      sortType: string;
      subplebbitAddresses: string[];
      filter: CommentsFilter;
    } = {
      newerThan: searchQuery ? 0 : (timeFilterSeconds ?? 0),
      sortType,
      subplebbitAddresses,
      filter: { filter: filterFunc, key: filterKey },
    };

    return options;
  }, [subplebbitAddresses, sortType, timeFilterSeconds, searchQuery, matchesDomain, domain]);

  const { feed, hasMore, loadMore, reset, subplebbitAddressesWithNewerPosts } = useFeed(feedOptions);

  useEffect(() => {
    if (isSearching) {
      setSearchAttemptCompleted(false);
      setShowNoResults(false);
    } else if (searchQuery || domain) {
      setSearchAttemptCompleted(true);
    }
  }, [isSearching, searchQuery, domain]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if ((searchQuery || domain) && feed?.length === 0 && searchAttemptCompleted && !showNoResults) {
      timer = setTimeout(() => {
        setShowNoResults(true);
      }, 2000);
    } else if ((!searchQuery && !domain) || feed?.length > 0) {
      setShowNoResults(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchQuery, domain, feed?.length, searchAttemptCompleted, showNoResults]);

  // suggest the user to change time filter if there aren't enough posts
  const { feed: weeklyFeed } = useFeed({
    subplebbitAddresses,
    sortType,
    newerThan: 60 * 60 * 24 * 7,
    filter: { filter: matchesDomain, key: `domain-filter-weekly-${domain}` },
  });

  const { feed: monthlyFeed } = useFeed({
    subplebbitAddresses,
    sortType,
    newerThan: 60 * 60 * 24 * 30,
    filter: { filter: matchesDomain, key: `domain-filter-monthly-${domain}` },
  });

  const { feed: yearlyFeed } = useFeed({
    subplebbitAddresses,
    sortType,
    newerThan: 60 * 60 * 24 * 365,
    filter: { filter: matchesDomain, key: `domain-filter-yearly-${domain}` },
  });

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
    domain,
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
                <LoadingEllipsis string='searching' />
              </div>
            </div>
          </div>
        ) : showNoResults ? (
          <div className={styles.feed}>
            <div className={styles.footer}>
              <div className={styles.stateString}>
                {searchQuery ? (
                  <span className={styles.noMatchesFound}>
                    No matches found for "{searchQuery}" on {domain}
                  </span>
                ) : (
                  <span className={styles.noMatchesFound}>No posts found from {domain}</span>
                )}
                <br />
                <br />
                <div className={styles.morePostsSuggestion}>
                  {searchQuery && (
                    <span className={styles.link} onClick={handleClearSearch}>
                      Clear search
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Virtuoso
            increaseViewportBy={{ bottom: 1200, top: 600 }}
            totalCount={feed?.length || 0}
            data={feed}
            itemContent={(index, post) => <Post index={index} post={post} />}
            useWindowScroll={true}
            components={{ Footer: () => <FeedFooter {...footerProps} /> }}
            endReached={loadMore}
            ref={virtuosoRef}
            restoreStateFrom={lastVirtuosoState}
            initialScrollTop={lastVirtuosoState?.scrollTop}
          />
        )}
      </div>
    </div>
  );
};

export default Domain;
