import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import useModFeed from '../../hooks/use-mod-feed';
import ModernFeed, { ModernFeedHeader } from '../../components/modern-feed';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import styles from './modern-mod.module.css';

/** Posts from every community the account moderates, in one feed. */
const ModernMod = () => {
  const { t } = useTranslation();
  const { feed, hasMore, loadMore, reset, sortType, timeFilterName, sessionKey, redirectPath, communityAddresses } = useModFeed();

  const documentTitle = `seedit: ${t('communities_you_moderate')}`;
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return (
    <ModernColumns>
      <ModernFeedHeader title='s/mod' description={t('communities_you_moderate')} />
      {communityAddresses.length === 0 ? (
        <div className={styles.empty}>
          <p>{t('not_moderator')}</p>
          <Link to='/communities' className={modernStyles.secondaryButton}>
            <span className={modernStyles.sentenceCase}>{t('communities')}</span>
          </Link>
        </div>
      ) : (
        <ModernFeed
          basePath='/s/mod'
          communityAddresses={communityAddresses}
          feed={feed}
          hasMore={hasMore}
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

export default ModernMod;
