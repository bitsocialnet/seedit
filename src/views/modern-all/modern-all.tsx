import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { useDefaultSubscriptionAddresses } from '../../hooks/use-default-subscriptions';
import useFeedRoute from '../../hooks/use-feed-route';
import { ModernColumns, ModernRailSection, modernStyles } from '../../components/modern-layout';
import ModernFeed from '../../components/modern-feed';

const AllRail = () => {
  const { t } = useTranslation();
  return (
    <ModernRailSection title={`s/${t('all')}`}>
      <p>{t('all_communities')}</p>
      <Link to='/communities' className={modernStyles.secondaryButton}>
        {t('communities')}
      </Link>
    </ModernRailSection>
  );
};

const ModernAll = () => {
  const { t } = useTranslation();
  const communityAddresses = useDefaultSubscriptionAddresses();
  const { feed, hasMore, loadMore, reset, sortType, timeFilterName, sessionKey, redirectPath } = useFeedRoute(communityAddresses);

  const documentTitle = `seedit: ${t('all_communities')}`;
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return (
    <ModernColumns rail={<AllRail />}>
      <ModernFeed
        basePath='/s/all'
        communityAddresses={communityAddresses}
        feed={feed}
        hasMore={hasMore}
        loadMore={loadMore}
        reset={reset}
        sessionKey={sessionKey}
        sortType={sortType}
        timeFilterName={timeFilterName}
      />
    </ModernColumns>
  );
};

export default ModernAll;
