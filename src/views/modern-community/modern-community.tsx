import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useBlock, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import useCommunityFeedWithAccountPosts from '../../hooks/use-community-feed-with-account-posts';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useFeedRoute from '../../hooks/use-feed-route';
import useIsCommunityOffline from '../../hooks/use-is-community-offline';
import { useIsNsfwCommunity } from '../../hooks/use-is-nsfw-community';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { getCommunityPath, isResolvableCommunityAddress } from '../../lib/utils/community-route-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import ErrorDisplay from '../../components/error-display';
import ModernCommunityAbout, { ModernJoinButton } from '../../components/modern-community-about';
import ModernCommunityAvatar from '../../components/modern-community-avatar';
import ModernFeed from '../../components/modern-feed';
import { PlusIcon } from '../../components/modern-icons';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import Over18Warning from '../../components/over-18-warning';
import styles from './modern-community.module.css';

const ModernCommunity = () => {
  const { t } = useTranslation();
  const rawCommunityIdentifier = useParams().communityAddress || '';
  const { communityAddress: resolvedCommunityAddress, directoryCode, directoryList, error: directoryListError } = useResolvedCommunityRoute(rawCommunityIdentifier);
  const communityAddress = resolvedCommunityAddress || '';
  const canLoadCommunity = isResolvableCommunityAddress(communityAddress);
  const community = useCommunity(canLoadCommunity ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  const { error, shortAddress, title } = community || {};
  const { isOffline, offlineTitle } = useIsCommunityOffline(community || {});

  const communityAddresses = useMemo(() => (canLoadCommunity ? [communityAddress] : []), [canLoadCommunity, communityAddress]);
  const { feed, hasMore, loadMore, reset, sortType, timeFilterName, sessionKey, redirectPath } = useFeedRoute(communityAddresses);
  const combinedFeed = useCommunityFeedWithAccountPosts(communityAddress, feed, reset);
  const { blocked, unblock } = useBlock({ address: communityAddress });

  const hideNsfwCommunities = useContentOptionsStore((state) => state.hideNsfwCommunities);
  const isHiddenNsfwCommunity = useIsNsfwCommunity(communityAddress) && hideNsfwCommunities;

  const displayAddress = getDisplayAddress(shortAddress || rawCommunityIdentifier || communityAddress);
  useEffect(() => {
    document.title = directoryList?.title || title || displayAddress;
  }, [directoryList?.title, title, displayAddress]);

  // A directory published after this build has no bundled list, so a failed list request leaves it without a community.
  const visibleError = directoryCode && !resolvedCommunityAddress ? directoryListError : error?.message && feed.length === 0 ? error : null;

  if (redirectPath) return <Navigate to={redirectPath} replace />;
  if (isHiddenNsfwCommunity) return <Over18Warning />;

  return (
    <>
      <div className={styles.banner} aria-hidden='true' />
      <header className={styles.header}>
        <ModernCommunityAvatar address={communityAddress || rawCommunityIdentifier} avatarUrl={community?.suggested?.avatarUrl} size='large' />
        <div className={styles.identity}>
          <h1 className={styles.title}>{title || `s/${displayAddress}`}</h1>
          <p className={styles.subtitle}>
            <span title={communityAddress}>s/{displayAddress}</span>
            {isOffline && (
              <span className={styles.offline} title={offlineTitle || undefined}>
                {t('offline')}
              </span>
            )}
          </p>
        </div>
        {canLoadCommunity && (
          <div className={styles.headerActions}>
            <Link to={`${getCommunityPath(communityAddress)}/submit`} className={modernStyles.secondaryButton}>
              <PlusIcon size={18} />
              <span className={styles.createLabel}>{t('create')}</span>
            </Link>
            <ModernJoinButton address={communityAddress} directoryCode={directoryCode} directoryRevision={directoryList?.revision} />
          </div>
        )}
      </header>
      <ModernColumns rail={canLoadCommunity && <ModernCommunityAbout community={community} communityAddress={communityAddress} />}>
        {visibleError && (
          <div className={styles.error}>
            <ErrorDisplay error={visibleError} />
          </div>
        )}
        {blocked ? (
          <div className={styles.blocked}>
            <p>{t('you_blocked_community')}</p>
            <button
              type='button'
              className={modernStyles.secondaryButton}
              onClick={() => {
                unblock();
                reset();
              }}
            >
              <span className={modernStyles.sentenceCase}>{t('unblock_community')}</span>
            </button>
          </div>
        ) : (
          <ModernFeed
            basePath={rawCommunityIdentifier ? `/s/${encodeURIComponent(rawCommunityIdentifier)}` : '/s'}
            communityAddresses={communityAddresses}
            feed={combinedFeed}
            // Until a directory route resolves to its community there is nothing to request yet, which is still loading.
            hasMore={hasMore || !canLoadCommunity}
            loadMore={loadMore}
            reset={reset}
            sessionKey={sessionKey}
            showCommunity={false}
            sortType={sortType}
            timeFilterName={timeFilterName}
          />
        )}
      </ModernColumns>
    </>
  );
};

export default ModernCommunity;
