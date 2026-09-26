import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import EmptyFeedMessage from '../empty-feed-message';
import styles from './search-result.module.css';

interface SearchResultGroupProps {
  children: ReactNode;
  /** Shown under the rows when the group can still grow. */
  hasMore: boolean;
  /** The communities group is unlabelled, the way the results page shows it. */
  heading?: string;
  /** Rendered to the right of the heading (sort and time menus). */
  headingMenus?: ReactNode;
  isEmpty: boolean;
  /** A further page is in flight, so the button reads as busy. */
  loadingMore?: boolean;
  onLoadMore: () => void;
}

/**
 * One group of the results page. Old reddit paginates a group with
 * "view more: next ›", which swaps the whole page; seedit appends in place
 * instead, so the route and scroll position survive a load.
 */
const SearchResultGroup = ({ children, hasMore, heading, headingMenus, isEmpty, loadingMore, onLoadMore }: SearchResultGroupProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.group}>
      {heading && (
        <header className={styles.groupHeader}>
          <span className={styles.groupHeaderLabel}>{heading}</span>
          {headingMenus && <div className={styles.groupHeaderMenus}>{headingMenus}</div>}
        </header>
      )}
      <div className={styles.contents}>{children}</div>
      <footer>
        {isEmpty && <EmptyFeedMessage />}
        {hasMore && (
          <div className={styles.loadMoreRow}>
            <button className={styles.loadMore} disabled={loadingMore} onClick={onLoadMore} type='button'>
              {loadingMore ? t('loading') : t('load_more')}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};

export default SearchResultGroup;
