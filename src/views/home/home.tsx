import { useEffect, useRef, useState, useMemo, useCallback, startTransition } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { useAccount, useFeed, Comment } from '@bitsocialnet/bitsocial-react-hooks';
import { Trans, useTranslation } from 'react-i18next';
import { commentMatchesPattern } from '../../lib/utils/pattern-utils';
import useFeedFiltersStore from '../../stores/use-feed-filters-store';
import { useAutoSubscribeStore } from '../../stores/use-auto-subscribe-store';
import useTimeFilter, { isValidTimeFilterName } from '../../hooks/use-time-filter';
import useRedirectToDefaultSort from '../../hooks/use-redirect-to-default-sort';
import FeedFooter from '../../components/feed-footer';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import { sortTypes } from '../../constants/sort-types';
import styles from './home.module.css';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

type SubscriptionState = 'loading' | 'noSubscriptions' | 'hasSubscriptions';

const Home = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const subplebbitAddresses = useMemo(() => account?.subscriptions || [], [account?.subscriptions]);
  const { isCheckingAccount } = useAutoSubscribeStore();
  const accountAddress = account?.author?.address;
  const isCheckingSubscriptions = !accountAddress || isCheckingAccount(accountAddress);

  const params = useParams<{ sortType?: string; timeFilterName?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const navigate = useNavigate();
  const location = useLocation();

  const sortType = params?.sortType && sortTypes.includes(params.sortType) ? params.sortType : sortTypes[0];

  useRedirectToDefaultSort();

  useEffect(() => {
    if ((params?.sortType && !sortTypes.includes(params.sortType)) || (params.timeFilterName && !isValidTimeFilterName(params.timeFilterName))) {
      navigate('/not-found', { replace: true });
    }
  }, [params?.sortType, params.timeFilterName, navigate]);

  const { timeFilterName, timeFilterSeconds, sessionKey, timeFilterNames } = useTimeFilter();

  useEffect(() => {
    if (!params.timeFilterName && !searchQuery && sessionKey) {
      const sessionPreference = sessionStorage.getItem(sessionKey);
      if (sessionPreference && timeFilterNames.includes(sessionPreference)) {
        const targetPath = `/${sortType}/${sessionPreference}${location.search}`;
        console.log(`Redirecting Home from ${location.pathname} to ${targetPath} based on session preference: ${sessionPreference}`);
        navigate(targetPath, { replace: true });
      }
    }
  }, [params.timeFilterName, searchQuery, sessionKey, sortType, navigate, location.search, location.pathname, timeFilterNames]);

  const currentTimeFilterName = params.timeFilterName || timeFilterName || 'hot';

  const { isSearching } = useFeedFiltersStore();
  const [showNoResults, setShowNoResults] = useState(false);
  const [searchAttemptCompleted, setSearchAttemptCompleted] = useState(false);

  const commentFilter = useCallback(
    (comment: Comment) => {
      if (!searchQuery.trim()) return true;
      return commentMatchesPattern(comment, searchQuery);
    },
    [searchQuery],
  );

  const feedOptions = useMemo(() => {
    const options: any = {
      newerThan: searchQuery ? 0 : timeFilterSeconds,
      postsPerPage: 10,
      sortType,
      subplebbitAddresses,
    };

    if (searchQuery) {
      options.filter = {
        filter: commentFilter,
        key: `search-filter-${searchQuery}`,
      };
    }

    return options;
  }, [subplebbitAddresses, sortType, timeFilterSeconds, searchQuery, commentFilter]);

  const { feed, hasMore, loadMore, reset, subplebbitAddressesWithNewerPosts } = useFeed(feedOptions);

  useEffect(() => {
    startTransition(() => {
      setShowNoResults(false);
      setSearchAttemptCompleted(false);
    });
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery && !isSearching && !searchAttemptCompleted) {
      startTransition(() => {
        setSearchAttemptCompleted(true);
      });
    }
  }, [searchQuery, isSearching, searchAttemptCompleted]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (searchQuery && feed?.length === 0 && searchAttemptCompleted) {
      timer = setTimeout(() => {
        startTransition(() => {
          setShowNoResults(true);
        });
      }, 1500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchQuery, feed?.length, searchAttemptCompleted]);

  const shouldLoadAdditionalFeeds = sortType !== 'top' && !searchQuery;

  const {
    feed: weeklyFeed,
    hasMore: hasMoreWeekly,
    loadMore: loadMoreWeekly,
  } = useFeed({
    subplebbitAddresses: shouldLoadAdditionalFeeds ? subplebbitAddresses : [],
    sortType,
    newerThan: 60 * 60 * 24 * 7,
  });
  const {
    feed: monthlyFeed,
    hasMore: hasMoreMonthly,
    loadMore: loadMoreMonthly,
  } = useFeed({
    subplebbitAddresses: shouldLoadAdditionalFeeds ? subplebbitAddresses : [],
    sortType,
    newerThan: 60 * 60 * 24 * 30,
  });
  const {
    feed: yearlyFeed,
    hasMore: hasMoreYearly,
    loadMore: loadMoreYearly,
  } = useFeed({
    subplebbitAddresses: shouldLoadAdditionalFeeds ? subplebbitAddresses : [],
    sortType,
    newerThan: 60 * 60 * 24 * 365,
  });

  const combinedLoadMore = useCallback(() => {
    loadMore();
    if (shouldLoadAdditionalFeeds) {
      if (hasMoreWeekly) loadMoreWeekly();
      if (hasMoreMonthly) loadMoreMonthly();
      if (hasMoreYearly) loadMoreYearly();
    }
  }, [loadMore, shouldLoadAdditionalFeeds, hasMoreWeekly, loadMoreWeekly, hasMoreMonthly, loadMoreMonthly, hasMoreYearly, loadMoreYearly]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[sortType + currentTimeFilterName + 'home' + searchQuery] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [sortType, currentTimeFilterName, searchQuery]);

  const lastVirtuosoState = lastVirtuosoStates?.[sortType + currentTimeFilterName + 'home' + searchQuery];

  // Memoize the item content renderer to prevent unnecessary rerenders
  const renderPost = useCallback((index: number, post: Comment) => {
    return <Post key={post?.cid} index={index} post={post} />;
  }, []);

  useEffect(() => {
    document.title = `seedit`;
  }, [t]);

  const onClearSearch = useCallback(() => {
    setSearchParams((prev) => {
      prev.delete('q');
      return prev;
    });
    reset();
  }, [setSearchParams, reset]);

  const footerProps = useMemo(
    () => ({
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
      onClearSearch,
    }),
    [
      feed,
      hasMore,
      subplebbitAddresses,
      subplebbitAddressesWithNewerPosts,
      weeklyFeed.length,
      monthlyFeed.length,
      yearlyFeed.length,
      searchQuery,
      currentTimeFilterName,
      reset,
      isSearching,
      showNoResults,
      onClearSearch,
    ],
  );

  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>('loading');
  const initialLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [safeToShowNoSubscriptions, setSafeToShowNoSubscriptions] = useState(false);

  useEffect(() => {
    return () => {
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isCheckingSubscriptions) {
      setSafeToShowNoSubscriptions(false);
      return;
    }

    if (!isCheckingSubscriptions && !safeToShowNoSubscriptions) {
      initialLoadTimeoutRef.current = setTimeout(() => {
        setSafeToShowNoSubscriptions(true);
      }, 800);
    }

    return () => {
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
      }
    };
  }, [isCheckingSubscriptions, safeToShowNoSubscriptions, accountAddress]);

  useEffect(() => {
    if (searchQuery) {
      setSubscriptionState('hasSubscriptions');
      return;
    }

    if (subplebbitAddresses.length > 0 || feed?.length > 0) {
      setSubscriptionState('hasSubscriptions');
      return;
    }

    if (isCheckingSubscriptions || feed === undefined) {
      setSubscriptionState('loading');
      return;
    }

    if (!isCheckingSubscriptions && feed?.length === 0 && subplebbitAddresses.length === 0 && safeToShowNoSubscriptions) {
      setSubscriptionState('noSubscriptions');
    } else {
      setSubscriptionState('loading');
    }
  }, [isCheckingSubscriptions, subplebbitAddresses, feed, safeToShowNoSubscriptions, searchQuery, accountAddress]);

  return (
    <div>
      <div className={styles.content}>
        <div className={`${styles.sidebar}`}>
          <Sidebar />
        </div>
        {subscriptionState === 'loading' && !searchQuery ? (
          <div className={styles.feed}>
            <div className={styles.footer}>
              <LoadingEllipsis string={t('loading_feed')} />
            </div>
          </div>
        ) : subscriptionState === 'noSubscriptions' && !searchQuery ? (
          <div className={styles.noSubscriptions}>
            <br />
            <Trans
              i18nKey='no_subscriptions_message'
              values={{ accountName: account?.author.displayName || account?.author.shortAddress }}
              components={{
                // eslint-disable-next-line jsx-a11y/heading-has-content
                1: <h1 key='no_subscriptions_message_1' />,
                2: <div className={styles.squash} key='no_subscriptions_message_2' />,
                3: <span className={styles.joinWithThe} key='no_subscriptions_message_3' />,
                4: <img src={'/assets/buttons/all_feed_subscribe.png'} alt='' key='no_subscriptions_message_4' />,
              }}
            />
            <div className={styles.fakePost} />
            <div className={styles.findCommunities}>
              <Link to='/s/all/hot/1m'>{t('find_communities')}</Link>
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
              increaseViewportBy={{ bottom: 1200, top: 1200 }}
              totalCount={feed?.length || 0}
              data={feed}
              computeItemKey={(index, post) => post?.cid || index}
              itemContent={renderPost}
              useWindowScroll={true}
              components={{
                Footer: () => <FeedFooter {...footerProps} />,
              }}
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

export default Home;
