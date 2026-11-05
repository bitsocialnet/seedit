import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { Community, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { getFormattedTimeAgo } from '../lib/utils/time-utils';
import useCommunityOfflineStore from '../stores/use-community-offline-store';
import useCommunitiesLoadingStartTimestamps from '../stores/use-communities-loading-start-timestamps-store';
import { getCommunityIdentifier } from './use-community-identifier';

interface CommunitySyncInfo {
  syncState?: string;
  lastSuccessfulFetchAt?: number;
  lastRetriableError?: unknown;
}

/**
 * The time a community's record age is measured at. bitsocial-react-hooks stops updating a
 * community a couple of minutes after nothing shows it, and showing it again restarts its updates.
 * While it is stopped or fetching and its last fetch did not fail, nothing has checked it since
 * that fetch, so its record is judged by its age back then: a community that was online when it
 * stopped updating does not show as offline while it restarts. A failed or finished fetch measures now.
 */
export const getCommunityFreshnessNowSeconds = ({ syncState, lastSuccessfulFetchAt, lastRetriableError }: CommunitySyncInfo, nowSeconds: number): number => {
  const isUncheckedSinceLastFetch = syncState === 'stopped' || syncState === 'loading';
  if (!isUncheckedSinceLastFetch || lastSuccessfulFetchAt === undefined || lastRetriableError !== undefined) {
    return nowSeconds;
  }
  return Math.min(nowSeconds, lastSuccessfulFetchAt);
};

const useIsCommunityOffline = (community: Community) => {
  const { t } = useTranslation();
  const { address, state, updatedAt, updatingState } = community || {};
  const { communityOfflineState, setCommunityOfflineState, initializeCommunityOfflineState } = useCommunityOfflineStore();
  const communitiesLoadingStartTimestamps = useCommunitiesLoadingStartTimestamps([address]);
  // community list entries from useCommunities carry no sync state, so every caller reads it from the cache
  const syncInfo = useCommunity(address ? { community: getCommunityIdentifier(address), onlyIfCached: true } : undefined);

  useEffect(() => {
    if (address && !communityOfflineState[address]) {
      initializeCommunityOfflineState(address);
    }
  }, [address, communityOfflineState, initializeCommunityOfflineState]);

  useEffect(() => {
    if (address) {
      setCommunityOfflineState(address, { state, updatedAt, updatingState });
    }
  }, [address, state, updatedAt, updatingState, setCommunityOfflineState]);

  const communityOfflineStore = communityOfflineState[address] || { initialLoad: true };
  const loadingStartTimestamp = communitiesLoadingStartTimestamps[0] || 0;
  const nowSeconds = Date.now() / 1000;
  const freshnessNowSeconds = getCommunityFreshnessNowSeconds(syncInfo || {}, nowSeconds);

  const isLoading = communityOfflineStore.initialLoad && (!updatedAt || freshnessNowSeconds - updatedAt >= 120 * 60) && nowSeconds - loadingStartTimestamp < 30;

  const isOffline = !isLoading && ((updatedAt && updatedAt < freshnessNowSeconds - 120 * 60) || (!updatedAt && nowSeconds - loadingStartTimestamp >= 30));

  const isOnline = updatedAt && freshnessNowSeconds - updatedAt < 120 * 60;

  const offlineTitle = isLoading
    ? t('loading')
    : updatedAt
      ? isOffline && t('posts_last_synced_info', { time: getFormattedTimeAgo(updatedAt), interpolation: { escapeValue: false } })
      : t('community_offline_info');

  // ensure isOffline is false until we have enough information
  const hasEnoughInfo = communityOfflineStore.initialLoad === false || updatedAt !== undefined;

  return {
    isOffline: hasEnoughInfo && !isOnline && isOffline,
    isOnlineStatusLoading: !isOnline && isLoading,
    offlineTitle,
  };
};

export default useIsCommunityOffline;
