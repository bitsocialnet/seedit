import { memo, useEffect, useRef, useMemo, useCallback, type ComponentProps } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { useAccount, Comment } from '@bitsocial/bitsocial-react-hooks';
import { Trans, useTranslation } from 'react-i18next';
import useRedirectToDefaultSort from '../../hooks/use-redirect-to-default-sort';
import { useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import useFeedRoute from '../../hooks/use-feed-route';
import useHomeSubscriptionState from '../../hooks/use-home-subscription-state';
import FeedFooter from '../../components/feed-footer';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import StarterSubscriptionsNotice from '../../components/starter-subscriptions-notice';
import DirectorySubscriptionUpdatesNotice from '../../components/directory-subscription-updates-notice';
import DevelopmentFeedResetButton from '../../components/development-feed-reset-button';
import TopTimeFilter from '../../components/top-time-filter';
import styles from './home.module.css';
import layoutStyles from '../../components/feed-layout';
import { getDisplayAddress } from '../../lib/utils/address-utils';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};
const NO_SUBSCRIPTIONS: string[] = [];

type HomeFeedContext = ComponentProps<typeof FeedFooter>;

// Keep the component type stable so feed updates preserve pagination state.
const HomeFeedFooter = ({ context }: { context: HomeFeedContext }) => <FeedFooter {...context} />;
const feedComponents = { Footer: HomeFeedFooter };

// These sections subscribe to their own data, independently of feed updates.
const HomeSidebar = memo(Sidebar);
const HomeNotices = memo(function HomeNotices() {
  return (
    <>
      <DirectorySubscriptionUpdatesNotice />
      <StarterSubscriptionsNotice />
    </>
  );
});

const Home = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const communityAddresses = account?.subscriptions ?? NO_SUBSCRIPTIONS;

  useRedirectToDefaultSort();

  const { feed, hasMore, loadMore, reset, requestKey, sortType, timeFilterName, sessionKey, redirectPath } = useFeedRoute(communityAddresses);
  const currentTimeFilterName = timeFilterName || (sortType === 'top' ? 'all' : '24h');

  const infiniteFeedEnabled = useInfiniteFeedEnabled();

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
      requestKey,
    }),
    [feed, hasMore, communityAddresses, loadMore, requestKey],
  );

  const subscriptionState = useHomeSubscriptionState(feed?.length);

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div>
      <HomeNotices />
      <div className={layoutStyles.content}>
        <div className={`${layoutStyles.sidebar}`}>
          <HomeSidebar />
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
            <Virtuoso<Comment, HomeFeedContext>
              increaseViewportBy={{ bottom: 1200, top: 1200 }}
              totalCount={feed?.length || 0}
              data={feed}
              computeItemKey={(index, post) => post?.cid || index}
              itemContent={renderPost}
              useWindowScroll={true}
              components={feedComponents}
              context={footerProps}
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
