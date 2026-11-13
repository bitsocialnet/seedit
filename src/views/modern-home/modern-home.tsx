import { memo, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import useFeedRoute from '../../hooks/use-feed-route';
import useHomeSubscriptionState from '../../hooks/use-home-subscription-state';
import useRedirectToDefaultSort from '../../hooks/use-redirect-to-default-sort';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { ModernColumns, ModernRailSection, modernStyles } from '../../components/modern-layout';
import ModernFeed from '../../components/modern-feed';
import DirectorySubscriptionUpdatesNotice from '../../components/directory-subscription-updates-notice';
import StarterSubscriptionsNotice from '../../components/starter-subscriptions-notice';
import styles from './modern-home.module.css';

const NO_SUBSCRIPTIONS: string[] = [];
const NO_POSTS: never[] = [];

// The translation places this where the old interface showed its subscribe button image.
const JoinExample = () => {
  const { t } = useTranslation();
  return <span className={styles.joinExample}>{t('join')}</span>;
};

// Automatic subscription changes are announced here, with their undo, so they stay inspectable. These sections subscribe
// to their own data, independently of feed updates.
const HomeNotices = memo(function HomeNotices() {
  return (
    <>
      <DirectorySubscriptionUpdatesNotice />
      <StarterSubscriptionsNotice />
    </>
  );
});

const HomeRail = () => {
  const { t } = useTranslation();
  return (
    <ModernRailSection title={<span className={modernStyles.sentenceCase}>{t('home')}</span>}>
      <div className={styles.railActions}>
        <Link to='/submit' className={modernStyles.primaryButton}>
          {t('submit_post')}
        </Link>
        <Link to='/communities/create' className={modernStyles.secondaryButton}>
          {t('create_community')}
        </Link>
      </div>
    </ModernRailSection>
  );
};

const ModernHome = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const communityAddresses: string[] = account?.subscriptions ?? NO_SUBSCRIPTIONS;

  useRedirectToDefaultSort();
  const { feed, hasMore, loadMore, reset, sortType, timeFilterName, sessionKey, redirectPath } = useFeedRoute(communityAddresses);
  const subscriptionState = useHomeSubscriptionState(feed.length);

  useEffect(() => {
    document.title = 'seedit';
  }, []);

  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return (
    <ModernColumns rail={<HomeRail />}>
      <HomeNotices />
      {subscriptionState === 'noSubscriptions' ? (
        <div className={styles.empty}>
          <Trans
            i18nKey='no_subscriptions_message'
            values={{ accountName: account?.author?.displayName || getDisplayAddress(account?.author?.shortAddress || '') }}
            components={{
              // eslint-disable-next-line jsx-a11y/heading-has-content
              1: <h1 className={styles.emptyTitle} />,
              2: <p className={styles.emptyText} />,
              3: <span />,
              4: <JoinExample />,
            }}
          />
          <Link to='/s/all/hot/1m' className={modernStyles.primaryButton}>
            {t('find_communities')}
          </Link>
        </div>
      ) : (
        <ModernFeed
          basePath='/'
          communityAddresses={communityAddresses}
          feed={subscriptionState === 'loading' ? NO_POSTS : feed}
          hasMore={subscriptionState === 'loading' || hasMore}
          loadMore={loadMore}
          reset={reset}
          sessionKey={sessionKey}
          sortType={sortType}
          timeFilterName={timeFilterName}
        />
      )}
    </ModernColumns>
  );
};

export default ModernHome;
