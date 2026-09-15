import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useCommunities } from '@bitsocial/bitsocial-react-hooks';
import { isModView } from '../../lib/utils/view-utils';
import { useCommunityIdentifiers } from '../../hooks/use-community-identifier';
import { useFeedStateString } from '../../hooks/use-state-string';
import EmptyFeedMessage from '../empty-feed-message';
import { useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import FeedPagination from '../feed-pagination';
import LoadingEllipsis from '../loading-ellipsis';
import { shouldShowEmptyFeed, shouldShowFeedLoading } from './feed-footer-utils';
import styles from './feed-footer.module.css';
import React from 'react';

interface FeedFooterProps {
  requestKey: string;
  feedLength: number;
  hasFeedLoaded: boolean;
  hasMore: boolean;
  communityAddresses: string[];
  onLoadMore: () => void;
}

const FeedFooter = ({ requestKey, feedLength, hasFeedLoaded, hasMore, communityAddresses, onLoadMore }: FeedFooterProps) => {
  let footerContent;
  const { t } = useTranslation();
  const location = useLocation();
  const isInModView = isModView(location.pathname);
  const infiniteFeedEnabled = useInfiniteFeedEnabled();
  const feedCommunityIdentifiers = useCommunityIdentifiers(communityAddresses);
  const { communities } = useCommunities({ communities: feedCommunityIdentifiers });
  const feedStateString = useFeedStateString(communityAddresses);
  const loadingStateString = feedStateString || (!hasFeedLoaded || feedLength === 0 ? t('loading_feed') : t('looking_for_more_posts'));
  const hasEmptyFeedData = shouldShowEmptyFeed({
    requestedCommunityCount: feedCommunityIdentifiers.length,
    communities,
    feedLength,
    isLoadingCommunityData: Boolean(feedStateString),
  });

  // Add state to track initial loading
  const [hasFetchedCommunityAddresses, setHasFetchedCommunityAddresses] = useState(false);

  // Set hasInitialized after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasFetchedCommunityAddresses(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const showEmptyFeed = hasFetchedCommunityAddresses && hasEmptyFeedData && !hasMore;

  if (!hasFetchedCommunityAddresses) {
    footerContent = <LoadingEllipsis string={t('loading_feed')} />;
  }

  if (showEmptyFeed) {
    footerContent = <EmptyFeedMessage />;
  } else if (hasMore || communityAddresses.length > 0 || (communityAddresses && communityAddresses.length === 0)) {
    footerContent = (
      <>
        <div className={styles.stateString}>
          {communityAddresses.length === 0 ? (
            isInModView ? (
              <div className={styles.notModerator}>{t('not_moderator')}</div>
            ) : (
              <div>
                <Trans
                  i18nKey='no_communities_found'
                  components={[
                    <a key='community-lists-link' href='https://github.com/bitsocialnet/lists'>
                      https://github.com/bitsocialnet/lists
                    </a>,
                  ]}
                />
                <br />
                {t('connect_community_notice')}
              </div>
            )
          ) : shouldShowFeedLoading({ feedLength, hasMore, infiniteFeedEnabled }) ? (
            <LoadingEllipsis string={feedStateString || loadingStateString} />
          ) : null}
        </div>
      </>
    );
  }
  return (
    <div className={styles.footer}>
      {footerContent}
      <FeedPagination key={requestKey} feedLength={feedLength} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
};

export default React.memo(FeedFooter);
