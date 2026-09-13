import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import LoadingEllipsis from '../loading-ellipsis';
import styles from './feed-pagination.module.css';

interface FeedPaginationProps {
  feedLength: number;
  hasMore: boolean;
  canLoadMore?: boolean;
  onLoadMore: () => void | Promise<void>;
}

const FeedPagination = ({ feedLength, hasMore, canLoadMore = true, onLoadMore }: FeedPaginationProps) => {
  const { t } = useTranslation();
  const infiniteFeedEnabled = useInfiniteFeedEnabled();
  const [isLoading, setIsLoading] = useState(false);

  if (!canLoadMore || infiniteFeedEnabled || !hasMore || feedLength === 0) return null;

  const handleLoadMore = () => {
    if (isLoading) return;

    setIsLoading(true);
    void Promise.resolve()
      .then(onLoadMore)
      .then(
        () => setIsLoading(false),
        () => setIsLoading(false),
      );
  };

  if (isLoading) {
    return (
      <div className={styles.stateString}>
        <LoadingEllipsis string={t('looking_for_more_posts')} />
      </div>
    );
  }

  return (
    <div className={styles.loadMoreContainer}>
      <button type='button' className={styles.loadMore} onClick={handleLoadMore}>
        {t('load_more')}
      </button>
    </div>
  );
};

export default FeedPagination;
