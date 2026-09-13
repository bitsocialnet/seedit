import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Link, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { useAccount, Comment } from '@bitsocial/bitsocial-react-hooks';
import { Trans, useTranslation } from 'react-i18next';
import { useAutoSubscribeStore } from '../../stores/use-auto-subscribe-store';
import useTimeFilter, { isValidTimeFilterName, isValidTopTimeFilterName } from '../../hooks/use-time-filter';
import useRedirectToDefaultSort from '../../hooks/use-redirect-to-default-sort';
import { FEED_POSTS_PER_PAGE, useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import { getCommunityIdentifiers } from '../../hooks/use-community-identifier';
import { useStarterCommunityList } from '../../hooks/use-default-subscriptions';
import FeedFooter from '../../components/feed-footer';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import StarterSubscriptionsNotice from '../../components/starter-subscriptions-notice';
import DirectorySubscriptionUpdatesNotice from '../../components/directory-subscription-updates-notice';
import DevelopmentFeedResetButton from '../../components/development-feed-reset-button';
import TopTimeFilter from '../../components/top-time-filter';
import { getCanonicalTopPath, getFeedSortType, getRouteSortType, isLegacyTopRoute, isValidRouteSortType } from '../../constants/sort-types';
import { getHomeSubscriptionState } from './subscription-state';
import styles from './home.module.css';
import layoutStyles from '../../components/feed-layout';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import useProgressiveFeed from '../../hooks/use-progressive-feed';
import { getPathWithoutTimeFilter } from '../../lib/utils/time-filter-utils';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

const Home = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const subscriptions = account?.subscriptions ?? [];
  const communityAddresses = subscriptions;
  const { isCheckingAccount } = useAutoSubscribeStore();
  const { loading: starterListLoading } = useStarterCommunityList();
  const accountAddress = account?.author?.address;
  const isCheckingSubscriptions = starterListLoading || !accountAddress || isCheckingAccount(accountAddress);

  const params = useParams<{ sortType?: string; timeFilterName?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const sortType = getRouteSortType(params.sortType);
  const feedSortType = getFeedSortType(sortType);

  useRedirectToDefaultSort();

  useEffect(() => {
    const hasInvalidTimeFilter = sortType === 'top' ? !isValidTopTimeFilterName(params.timeFilterName) : !isValidTimeFilterName(params.timeFilterName);
    if (!isValidRouteSortType(params.sortType) || hasInvalidTimeFilter) {
      navigate('/not-found', { replace: true });
    }
  }, [params?.sortType, params.timeFilterName, sortType, navigate]);

  const { timeFilterName, timeFilterSeconds, sessionKey, preferredTopTimeFilterPath } = useTimeFilter();

  const currentTimeFilterName = params.timeFilterName || timeFilterName || (sortType === 'top' ? 'all' : '24h');

  const infiniteFeedEnabled = useInfiniteFeedEnabled();

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

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[sortType + currentTimeFilterName + 'home'] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [sortType, currentTimeFilterName]);

  const lastVirtuosoState = lastVirtuosoStates?.[sortType + currentTimeFilterName + 'home'];

  // Memoize the item content renderer to prevent unnecessary rerenders
  const renderPost = useCallback((index: number, post: Comment) => {
    return <Post key={post?.cid} index={index} post={post} />;
  }, []);

  useEffect(() => {
    document.title = `seedit`;
  }, [t]);

  const footerProps = useMemo(
    () => ({
      feedLength: feed?.length ?? 0,
      hasFeedLoaded: !!feed,
      hasMore,
      communityAddresses,
      onLoadMore: loadMore,
    }),
    [feed, hasMore, communityAddresses, loadMore],
  );

  const [safeToShowNoSubscriptions, setSafeToShowNoSubscriptions] = useState(false);

  useEffect(() => {
    if (isCheckingSubscriptions) {
      setSafeToShowNoSubscriptions(false);
      return;
    }

    const timeout = setTimeout(() => setSafeToShowNoSubscriptions(true), 800);
    return () => clearTimeout(timeout);
  }, [isCheckingSubscriptions, accountAddress]);

  const subscriptionState = getHomeSubscriptionState({
    subscriptionCount: subscriptions.length,
    feedLength: feed?.length,
    isCheckingSubscriptions,
    safeToShowNoSubscriptions,
  });

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
      <DirectorySubscriptionUpdatesNotice />
      <StarterSubscriptionsNotice />
      <div className={layoutStyles.content}>
        <div className={`${layoutStyles.sidebar}`}>
          <Sidebar />
        </div>
        {subscriptionState === 'loading' ? (
          <div className={layoutStyles.feed}>
            <div className={layoutStyles.footer}>
              <LoadingEllipsis string={t('loading_feed')} />
            </div>
          </div>
        ) : subscriptionState === 'noSubscriptions' ? (
          <div className={styles.noSubscriptions}>
            <br />
            <Trans
              i18nKey='no_subscriptions_message'
              values={{ accountName: account?.author.displayName || getDisplayAddress(account?.author.shortAddress || '') }}
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
          <div className={layoutStyles.feed}>
            <DevelopmentFeedResetButton onReset={reset} />
            {sortType === 'top' && <TopTimeFilter selectedTimeFilterName={currentTimeFilterName} sessionKey={sessionKey} />}
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
              endReached={infiniteFeedEnabled ? loadMore : undefined}
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
