import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Virtuoso, type StateSnapshot, type VirtuosoHandle } from 'react-virtuoso';
import { type Comment, useCommunities } from '@bitsocial/bitsocial-react-hooks';
import { useCommunityIdentifiers } from '../../hooks/use-community-identifier';
import { useFeedStateString } from '../../hooks/use-state-string';
import { setSessionTimeFilterPreference, topTimeFilterNames } from '../../hooks/use-time-filter';
import { sortTypes } from '../../constants/sort-types';
import { getTopTimeFilterPath } from '../../lib/utils/time-filter-utils';
import DevelopmentFeedResetButton from '../development-feed-reset-button';
import { shouldShowEmptyFeed } from '../feed-footer';
import ModernPostCard from '../modern-post-card';
import styles from './modern-feed.module.css';

const timeFilterLabelKeys: Record<string, string> = {
  '1h': 'past_hour',
  '24h': 'past_24_hours',
  '1w': 'past_week',
  '1m': 'past_month',
  '1y': 'past_year',
  all: 'all_time',
};

// Scroll positions per feed, so going back to a feed returns to the same post.
const lastVirtuosoStates: Record<string, StateSnapshot> = {};

interface SortBarProps {
  basePath: string;
  sortType: string;
  timeFilterName: string | undefined;
  sessionKey: string | null;
}

const SortBar = ({ basePath, sortType, timeFilterName, sessionKey }: SortBarProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ timeFilterName?: string }>();
  const selectedTimeFilter = timeFilterName && topTimeFilterNames.includes(timeFilterName) ? timeFilterName : 'all';
  const prefix = basePath === '/' ? '' : basePath;

  return (
    <div className={styles.sortBar}>
      <nav className={styles.sortTabs} aria-label={t('sorted_by')}>
        {sortTypes.map((type) => (
          <Link
            key={type}
            to={`${prefix}/${type}`}
            className={`${styles.sortTab} ${sortType === type ? styles.sortTabActive : ''}`}
            aria-current={sortType === type ? 'page' : undefined}
          >
            {t(type)}
          </Link>
        ))}
      </nav>
      {sortType === 'top' && (
        <select
          className={styles.timeFilter}
          value={selectedTimeFilter}
          aria-label={t('links_from')}
          onChange={(event) => {
            setSessionTimeFilterPreference(sessionKey, event.target.value);
            navigate(getTopTimeFilterPath(location.pathname, params.timeFilterName, event.target.value, location.search));
          }}
        >
          {topTimeFilterNames.map((name) => (
            <option key={name} value={name}>
              {t(timeFilterLabelKeys[name])}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

interface FeedFooterContext {
  communityAddresses: string[];
  feedLength: number;
  hasMore: boolean;
}

const Footer = ({ context: { communityAddresses, feedLength, hasMore } }: { context: FeedFooterContext }) => {
  const { t } = useTranslation();
  const feedCommunityIdentifiers = useCommunityIdentifiers(communityAddresses);
  const { communities } = useCommunities({ communities: feedCommunityIdentifiers });
  const feedStateString = useFeedStateString(communityAddresses);
  const isEmpty =
    !hasMore &&
    shouldShowEmptyFeed({ requestedCommunityCount: feedCommunityIdentifiers.length, communities, feedLength, isLoadingCommunityData: Boolean(feedStateString) });

  if (isEmpty)
    return (
      <div className={styles.footer}>
        <span className={styles.footerText}>{t('no_posts')}</span>
      </div>
    );
  if (!hasMore && feedLength > 0) return <div className={styles.footerEnd} aria-hidden='true' />;

  return (
    <div className={styles.footer} role='status'>
      <span className={styles.spinner} aria-hidden='true' />
      <span className={styles.footerText}>{feedStateString || (feedLength === 0 ? t('loading_feed') : t('looking_for_more_posts'))}</span>
    </div>
  );
};
const feedComponents = { Footer };

interface ModernFeedProps {
  /** The route the sort tabs append to, such as `/` or `/s/all`. */
  basePath: string;
  communityAddresses: string[];
  feed: Comment[];
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
  sessionKey: string | null;
  showCommunity?: boolean;
  sortType: string;
  timeFilterName: string | undefined;
}

const ModernFeed = ({ basePath, communityAddresses, feed, hasMore, loadMore, reset, sessionKey, showCommunity = true, sortType, timeFilterName }: ModernFeedProps) => {
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const stateKey = `${basePath}|${sortType}|${timeFilterName || ''}`;

  useEffect(() => {
    const saveState = () => {
      virtuosoRef.current?.getState((snapshot) => {
        if (snapshot?.ranges?.length) lastVirtuosoStates[stateKey] = snapshot;
      });
    };
    window.addEventListener('scroll', saveState);
    return () => window.removeEventListener('scroll', saveState);
  }, [stateKey]);
  const lastVirtuosoState = lastVirtuosoStates[stateKey];

  const footerContext = useMemo(() => ({ communityAddresses, feedLength: feed.length, hasMore }), [communityAddresses, feed.length, hasMore]);
  const renderPost = useCallback((_index: number, post: Comment) => <ModernPostCard post={post} showCommunity={showCommunity} />, [showCommunity]);

  return (
    <div className={styles.feed}>
      <SortBar basePath={basePath} sortType={sortType} timeFilterName={timeFilterName} sessionKey={sessionKey} />
      <DevelopmentFeedResetButton onReset={reset} />
      <Virtuoso<Comment, FeedFooterContext>
        increaseViewportBy={{ bottom: 1200, top: 600 }}
        totalCount={feed.length}
        data={feed}
        computeItemKey={(index, post) => post?.cid || index}
        itemContent={renderPost}
        useWindowScroll={true}
        components={feedComponents}
        context={footerContext}
        endReached={loadMore}
        ref={virtuosoRef}
        restoreStateFrom={lastVirtuosoState}
        initialScrollTop={lastVirtuosoState?.scrollTop}
      />
    </div>
  );
};

export default ModernFeed;
