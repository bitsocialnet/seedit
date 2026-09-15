import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useAccountComments, useBlock, useCommunity, type Comment } from '@bitsocial/bitsocial-react-hooks';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { useTranslation } from 'react-i18next';
import styles from './community.module.css';
import layoutStyles from '../../components/feed-layout';
import { useFeedStateString } from '../../hooks/use-state-string';
import { filterOptimisticLocalPosts } from '../../lib/utils/account-history-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import useFeedResetStore from '../../stores/use-feed-reset-store';
import { usePinnedPostsStore } from '../../stores/use-pinned-posts-store';
import { useIsNsfwCommunity } from '../../hooks/use-is-nsfw-community';
import useIsCommunityOffline from '../../hooks/use-is-community-offline';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import { isResolvableCommunityAddress } from '../../lib/utils/community-route-utils';
import useTimeFilter, { isValidTimeFilterName, isValidTopTimeFilterName } from '../../hooks/use-time-filter';
import { FEED_POSTS_PER_PAGE, useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import { getCommunityIdentifier, getCommunityIdentifiers } from '../../hooks/use-community-identifier';
import ErrorDisplay from '../../components/error-display';
import EmptyFeedMessage from '../../components/empty-feed-message';
import FeedPagination from '../../components/feed-pagination';
import DevelopmentFeedResetButton from '../../components/development-feed-reset-button';
import TopTimeFilter from '../../components/top-time-filter';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Over18Warning from '../../components/over-18-warning';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import { getCanonicalTopPath, getFeedSortType, getRouteSortType, isLegacyTopRoute, isValidRouteSortType } from '../../constants/sort-types';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import useProgressiveFeed from '../../hooks/use-progressive-feed';
import { getPathWithoutTimeFilter } from '../../lib/utils/time-filter-utils';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

interface FooterProps {
  communityAddresses: string[];
  communityAddress: string;
  feedLength: number;
  paginationFeedLength: number;
  isOnline: boolean;
  hasCommunityLoaded: boolean;
  started: boolean;
  isSubCreatedButNotYetPublished: boolean;
  hasMore: boolean;
  reset: () => void;
  onLoadMore: () => void;
  requestKey: string;
}

const Footer = ({
  communityAddresses,
  communityAddress,
  feedLength,
  paginationFeedLength,
  isOnline,
  hasCommunityLoaded,
  started: _started,
  isSubCreatedButNotYetPublished: _isSubCreatedButNotYetPublished,
  hasMore,
  reset,
  onLoadMore,
  requestKey,
}: FooterProps) => {
  const { t } = useTranslation();
  let footerFirstLine;
  let footerSecondLine;
  const feedStateString = useFeedStateString(communityAddresses);
  const loadingStateString = feedStateString || t('loading');
  const infiniteFeedEnabled = useInfiniteFeedEnabled();

  const loadingString = (
    <>
      <div className={layoutStyles.stateString}>{loadingStateString === 'Failed' ? 'failed' : <LoadingEllipsis string={loadingStateString} />}</div>
    </>
  );

  const { blocked, unblock, block } = useBlock({ address: communityAddress });
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const handleBlock = () => {
    if (blocked) {
      unblock();
    } else {
      block();
    }
    setShowBlockConfirm(false);
    reset();
  };

  if (blocked) {
    footerFirstLine = t('you_blocked_community');
    footerSecondLine = (
      <>
        {showBlockConfirm ? (
          <span className={styles.blockConfirm}>
            {t('are_you_sure')}{' '}
            <span className={styles.confirmButton} onClick={handleBlock}>
              {t('yes')}
            </span>
            {' / '}
            <span className={styles.cancelButton} onClick={() => setShowBlockConfirm(false)}>
              {t('no')}
            </span>
          </span>
        ) : (
          <span className={styles.blockSub} onClick={() => setShowBlockConfirm(true)}>
            {blocked ? t('unblock_community') : t('block_community')}
          </span>
        )}
      </>
    );
  } else if (feedLength === 0 && isOnline && hasCommunityLoaded && !feedStateString && !hasMore) {
    footerFirstLine = <EmptyFeedMessage />;
  } else if (paginationFeedLength === 0 || !isOnline) {
    footerFirstLine = loadingString;
  } else if (hasMore && infiniteFeedEnabled) {
    footerFirstLine = loadingString;
  }

  return (
    <div className={layoutStyles.footer}>
      {footerFirstLine && (
        <>
          {footerFirstLine}
          <br />
          <br />
        </>
      )}
      {footerSecondLine}
      <FeedPagination key={requestKey} feedLength={paginationFeedLength} hasMore={hasMore} canLoadMore={isOnline} onLoadMore={onLoadMore} />
    </div>
  );
};

// Preserve footer state through feed updates, but scope confirmations to the exact community.
const CommunityFeedFooter = ({ context }: { context: FooterProps }) => <Footer key={context.communityAddress} {...context} />;
const feedComponents = { Footer: CommunityFeedFooter };
const renderPost = (index: number, post: Comment) => <Post key={post?.cid} index={index} post={post} />;
const CommunitySidebar = memo(Sidebar);

const CommunityView = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const rawCommunityIdentifier = params?.communityAddress || '';
  const { communityAddress: resolvedCommunityAddress, directoryCode, directoryList } = useResolvedCommunityRoute(rawCommunityIdentifier);
  const communityAddress = resolvedCommunityAddress || '';
  const canLoadCommunity = !!communityAddress && isResolvableCommunityAddress(communityAddress);
  const community = useCommunity(canLoadCommunity ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  const { createdAt, error, shortAddress, started, title, updatedAt, settings } = community || {};
  const { isOffline } = useIsCommunityOffline(community || {});
  const isOnline = !isOffline;
  const isSubCreatedButNotYetPublished = typeof createdAt === 'number' && !updatedAt;

  const communityAddresses = useMemo(() => (canLoadCommunity ? [communityAddress] : []), [canLoadCommunity, communityAddress]) as string[];
  const sortType = getRouteSortType(params.sortType);
  const feedSortType = getFeedSortType(sortType);

  useEffect(() => {
    if (!isValidRouteSortType(params.sortType)) {
      navigate('/not-found');
    }
  }, [params?.sortType, navigate]);

  useEffect(() => {
    const hasInvalidTimeFilter = sortType === 'top' ? !isValidTopTimeFilterName(params.timeFilterName) : !isValidTimeFilterName(params.timeFilterName);
    if (hasInvalidTimeFilter) {
      console.log(`Invalid timeFilterName '${params.timeFilterName}' in Community, redirecting to /not-found`);
      navigate('/not-found', { replace: true });
    }
  }, [params.timeFilterName, sortType, navigate]);

  const { timeFilterSeconds, timeFilterName, sessionKey, preferredTopTimeFilterPath } = useTimeFilter();
  const infiniteFeedEnabled = useInfiniteFeedEnabled();

  const feedOptions = useMemo(
    () => ({
      communities: getCommunityIdentifiers(communityAddresses),
      postsPerPage: FEED_POSTS_PER_PAGE,
      sortType: feedSortType,
      newerThan: timeFilterSeconds,
    }),
    [communityAddresses, feedSortType, timeFilterSeconds],
  );

  const { feed, hasMore, loadMore, reset, requestKey } = useProgressiveFeed({ enabled: sortType !== 'top', feedOptions });

  // show account comments instantly in the feed once published (cid defined), instead of waiting for the feed to update
  const { accountComments } = useAccountComments({ communityAddress, newerThan: 60 * 60 });
  const filteredComments = useMemo(() => filterOptimisticLocalPosts(accountComments, feed, communityAddress), [accountComments, communityAddress, feed]);

  // reset the feed when a new account comment is published, so it shows instantly in the feed
  const setResetFunction = useFeedResetStore((state) => state.setResetFunction);
  useEffect(() => {
    setResetFunction(reset);
  }, [reset, setResetFunction, feed]);

  const resetTriggeredRef = useRef(false);

  useEffect(() => {
    if (filteredComments.length > 0 && !resetTriggeredRef.current) {
      reset();
      resetTriggeredRef.current = true;
    }
  }, [filteredComments, reset]);

  // show newest account comment at the top of the feed but after pinned posts
  const combinedFeed = useMemo(() => {
    const newFeed = [...feed];
    const lastPinnedIndex = newFeed.map((post) => post.pinned).lastIndexOf(true);
    if (filteredComments.length > 0) {
      newFeed.splice(lastPinnedIndex + 1, 0, ...filteredComments);
    }
    return newFeed;
  }, [feed, filteredComments]);

  const setPinnedPostsCount = usePinnedPostsStore((state) => state.setPinnedPostsCount);
  useEffect(() => {
    if (feed) {
      const pinnedCount = feed.filter((post) => post.pinned).length;
      setPinnedPostsCount(pinnedCount);
    }
  }, [feed, setPinnedPostsCount]);

  const footerProps = useMemo<FooterProps>(
    () => ({
      communityAddresses,
      communityAddress,
      feedLength: combinedFeed.length,
      paginationFeedLength: feed.length,
      isOnline,
      hasCommunityLoaded: Boolean(updatedAt),
      started,
      isSubCreatedButNotYetPublished,
      hasMore,
      reset,
      onLoadMore: loadMore,
      requestKey,
    }),
    [
      communityAddresses,
      communityAddress,
      combinedFeed.length,
      feed.length,
      isOnline,
      updatedAt,
      started,
      isSubCreatedButNotYetPublished,
      hasMore,
      reset,
      loadMore,
      requestKey,
    ],
  );

  // scrolling position state for virtuoso feed
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[communityAddress + sortType + timeFilterName] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [communityAddress, sortType, timeFilterName]);
  const lastVirtuosoState = lastVirtuosoStates?.[communityAddress + sortType + timeFilterName];

  // Show the warning when default-community metadata marks this community NSFW.
  const hideNsfwCommunities = useContentOptionsStore((state) => state.hideNsfwCommunities);
  const isHiddenNsfwCommunity = useIsNsfwCommunity(communityAddress || '') && hideNsfwCommunities;

  const prevErrorMessageRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (error && error.message !== prevErrorMessageRef.current) {
      console.log(error);
      prevErrorMessageRef.current = error.message;
    }
  }, [error]);

  // page title
  useEffect(() => {
    document.title = directoryList?.title || title || getDisplayAddress(shortAddress || rawCommunityIdentifier || communityAddress);
  }, [title, shortAddress, rawCommunityIdentifier, communityAddress, directoryList?.title]);

  // Derive whether to show error directly from current feed state
  const shouldShowErrorToUser = Boolean(error?.message && feed.length === 0);

  if (isLegacyTopRoute(params.sortType)) {
    return <Navigate to={getCanonicalTopPath(location.pathname, location.search)} replace />;
  }

  if (preferredTopTimeFilterPath) {
    return <Navigate to={preferredTopTimeFilterPath} replace />;
  }

  if (sortType !== 'top' && params.timeFilterName) {
    return <Navigate to={getPathWithoutTimeFilter(location.pathname, params.timeFilterName, location.search)} replace />;
  }

  return isHiddenNsfwCommunity ? (
    <Over18Warning />
  ) : (
    <div className={layoutStyles.content}>
      <div className={layoutStyles.sidebar}>
        <CommunitySidebar
          community={community}
          communityAddress={communityAddress}
          directoryCode={directoryCode}
          directoryRevision={directoryList?.revision}
          isSubCreatedButNotYetPublished={started && isSubCreatedButNotYetPublished}
          settings={settings}
          reset={reset}
        />
      </div>
      {shouldShowErrorToUser && (
        <div className={styles.error}>
          <ErrorDisplay error={error} />
        </div>
      )}
      <div className={layoutStyles.feed}>
        <DevelopmentFeedResetButton onReset={reset} />
        {sortType === 'top' && <TopTimeFilter selectedTimeFilterName={timeFilterName || 'all'} sessionKey={sessionKey} />}
        <Virtuoso<Comment, FooterProps>
          increaseViewportBy={{ bottom: 1200, top: 600 }}
          totalCount={combinedFeed?.length || 0}
          data={combinedFeed}
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
    </div>
  );
};

export default CommunityView;
