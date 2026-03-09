import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAccountComments, useBlock, useFeed, useSubplebbit } from '@bitsocialnet/bitsocial-react-hooks';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import { Trans, useTranslation } from 'react-i18next';
import styles from '../home/home.module.css';
import { useFeedStateString } from '../../hooks/use-state-string';
import { commentMatchesPattern } from '../../lib/utils/pattern-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import useFeedFiltersStore from '../../stores/use-feed-filters-store';
import useFeedResetStore from '../../stores/use-feed-reset-store';
import { usePinnedPostsStore } from '../../stores/use-pinned-posts-store';
import { useIsBroadlyNsfwSubplebbit } from '../../hooks/use-is-broadly-nsfw-subplebbit';
import useIsSubplebbitOffline from '../../hooks/use-is-subplebbit-offline';
import useTimeFilter, { isValidTimeFilterName } from '../../hooks/use-time-filter';
import ErrorDisplay from '../../components/error-display';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Over18Warning from '../../components/over-18-warning';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import { sortTypes } from '../../constants/sort-types';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

interface FooterProps {
  subplebbitAddresses: string[];
  subplebbitAddress: string;
  feedLength: number;
  isOnline: boolean;
  started: boolean;
  isSubCreatedButNotYetPublished: boolean;
  hasMore: boolean;
  timeFilterName: string;
  reset: () => void;
  searchQuery: string;
  isSearching: boolean;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
}

const Footer = ({
  subplebbitAddresses,
  subplebbitAddress,
  feedLength,
  isOnline,
  started: _started,
  isSubCreatedButNotYetPublished: _isSubCreatedButNotYetPublished,
  hasMore,
  timeFilterName,
  reset,
  searchQuery,
  isSearching,
  setSearchParams,
}: FooterProps) => {
  const { t } = useTranslation();
  let footerFirstLine;
  let footerSecondLine;
  const loadingStateString = useFeedStateString(subplebbitAddresses) || t('loading');

  const [showNoResults, setShowNoResults] = useState(false);
  const [searchAttemptCompleted, setSearchAttemptCompleted] = useState(false);

  useEffect(() => {
    setShowNoResults(false);
    setSearchAttemptCompleted(false);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery && !isSearching && !searchAttemptCompleted) {
      setSearchAttemptCompleted(true);
    }
  }, [searchQuery, isSearching, searchAttemptCompleted]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (searchQuery && feedLength === 0 && searchAttemptCompleted) {
      timer = setTimeout(() => {
        setShowNoResults(true);
      }, 1500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchQuery, feedLength, searchAttemptCompleted]);

  const loadingString = (
    <>
      <div className={styles.stateString}>{loadingStateString === 'Failed' ? 'failed' : <LoadingEllipsis string={loadingStateString} />}</div>
    </>
  );

  const { blocked, unblock, block } = useBlock({ address: subplebbitAddress });
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

  const handleClearSearch = () => {
    setSearchParams((prev) => {
      prev.delete('q');
      return prev;
    });
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
  } else if (searchQuery) {
    if (isSearching) {
      footerFirstLine = (
        <div className={styles.stateString}>
          <LoadingEllipsis string={t('searching')} />
        </div>
      );
    } else if (showNoResults) {
      footerFirstLine = (
        <div className={styles.stateString}>
          <span className={styles.noMatchesFound}>{t('no_matches_found_for', { query: searchQuery })}</span>
          <br />
          <br />
          <div className={styles.morePostsSuggestion}>
            <span className={styles.link} onClick={handleClearSearch}>
              {t('clear_search')}
            </span>
          </div>
        </div>
      );
    } else if (feedLength > 0) {
      footerFirstLine = (
        <div className={styles.stateString}>
          <span className={styles.searchResults}>{t('found_n_results_for', { count: feedLength, query: searchQuery })}</span>
          <br />
          <br />
          <div className={styles.morePostsSuggestion}>
            <span className={styles.link} onClick={handleClearSearch}>
              {t('clear_search')}
            </span>
          </div>
        </div>
      );
    } else if (feedLength === 0 && searchAttemptCompleted) {
      footerFirstLine = (
        <div className={styles.stateString}>
          <LoadingEllipsis string={t('searching')} />
        </div>
      );
    } else if (feedLength === 0 && !searchAttemptCompleted) {
      footerFirstLine = (
        <div className={styles.stateString}>
          <LoadingEllipsis string={t('searching')} />
        </div>
      );
    }
  } else if (feedLength === 0 && isOnline && !hasMore) {
    footerFirstLine = t('no_posts');
  } else if (feedLength === 0 || !isOnline) {
    footerFirstLine = loadingString;
  } else if (hasMore) {
    footerFirstLine = loadingString;
  }

  if (timeFilterName !== 'all' && !blocked && !searchQuery) {
    footerSecondLine = (
      <div className={styles.morePostsSuggestion}>
        <Trans
          i18nKey='show_all_instead'
          values={{ timeFilterName }}
          components={{
            1: <Link key='show_all_instead_link' to={`/s/${subplebbitAddress}`} />,
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.footer}>
      {footerFirstLine && (
        <>
          {footerFirstLine}
          <br />
          <br />
        </>
      )}
      {footerSecondLine}
    </div>
  );
};

const Subplebbit = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  const subplebbitAddress = params?.subplebbitAddress || '';
  const subplebbit = useSubplebbit({ subplebbitAddress });
  const { createdAt, error, shortAddress, started, title, updatedAt, settings } = subplebbit || {};
  const { isOffline } = useIsSubplebbitOffline(subplebbit || {});
  const isOnline = !isOffline;
  const isSubCreatedButNotYetPublished = typeof createdAt === 'number' && !updatedAt;

  const subplebbitAddresses = useMemo(() => [subplebbitAddress], [subplebbitAddress]) as string[];
  const sortType = sortTypes.includes(params?.sortType || '') ? params?.sortType : sortTypes[0];

  useEffect(() => {
    if (params?.sortType && !sortTypes.includes(params.sortType)) {
      navigate('/not-found');
    }
  }, [params?.sortType, navigate]);

  useEffect(() => {
    if (params.timeFilterName && !isValidTimeFilterName(params.timeFilterName)) {
      console.log(`Invalid timeFilterName '${params.timeFilterName}' in Subplebbit, redirecting to /not-found`);
      navigate('/not-found', { replace: true });
    }
  }, [params.timeFilterName, navigate]);

  const timeFilterName = params.timeFilterName || 'all';
  const { timeFilterSeconds } = useTimeFilter();
  const { isSearching } = useFeedFiltersStore();

  const feedOptions = useMemo(() => {
    const options: any = {
      subplebbitAddresses,
      sortType,
      newerThan: searchQuery ? 0 : timeFilterSeconds,
    };

    if (searchQuery) {
      options.filter = {
        filter: (comment: Comment) => {
          if (!searchQuery.trim()) return true;
          return commentMatchesPattern(comment, searchQuery);
        },
        key: `search-filter-${searchQuery}`,
      };
    }

    return options;
  }, [subplebbitAddresses, sortType, timeFilterSeconds, searchQuery]);

  const { feed, hasMore, loadMore, reset } = useFeed(feedOptions);

  // show account comments instantly in the feed once published (cid defined), instead of waiting for the feed to update
  const { accountComments } = useAccountComments();
  const filteredComments = useMemo(
    () =>
      accountComments.filter((comment) => {
        const { cid, deleted, postCid, removed, state, timestamp } = comment || {};
        return (
          !deleted &&
          !removed &&
          timestamp > Date.now() / 1000 - 60 * 60 &&
          state === 'succeeded' &&
          cid &&
          cid === postCid &&
          comment?.subplebbitAddress === subplebbitAddress &&
          !feed.some((post) => post.cid === cid)
        );
      }),
    [accountComments, subplebbitAddress, feed],
  );

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

  const { setPinnedPostsCount } = usePinnedPostsStore();
  useEffect(() => {
    if (feed) {
      const pinnedCount = feed.filter((post) => post.pinned).length;
      setPinnedPostsCount(pinnedCount);
    }
  }, [feed, setPinnedPostsCount]);

  const footerProps: FooterProps = {
    subplebbitAddresses,
    subplebbitAddress,
    feedLength: combinedFeed.length || 0,
    isOnline,
    started,
    isSubCreatedButNotYetPublished,
    hasMore,
    timeFilterName: searchQuery ? 'all' : timeFilterName || '',
    reset,
    searchQuery,
    isSearching,
    setSearchParams,
  };

  // scrolling position state for virtuoso feed
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[subplebbitAddress + sortType + timeFilterName + searchQuery] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [subplebbitAddress, sortType, timeFilterName, searchQuery]);
  const lastVirtuosoState = lastVirtuosoStates?.[subplebbitAddress + sortType + timeFilterName + searchQuery];

  // over 18 warning for subplebbit with nsfw tag in multisub default list
  const { hideAdultCommunities, hideGoreCommunities, hideAntiCommunities, hideVulgarCommunities } = useContentOptionsStore();
  const hasUnhiddenAnyNsfwCommunity = !hideAdultCommunities || !hideGoreCommunities || !hideAntiCommunities || !hideVulgarCommunities;
  const isBroadlyNsfwSubplebbit = useIsBroadlyNsfwSubplebbit(subplebbitAddress || '');

  const prevErrorMessageRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (error && error.message !== prevErrorMessageRef.current) {
      console.log(error);
      prevErrorMessageRef.current = error.message;
    }
  }, [error]);

  // page title
  useEffect(() => {
    document.title = title ? title : shortAddress || subplebbitAddress;
  }, [title, shortAddress, subplebbitAddress]);

  // Derive whether to show error directly from current feed state
  const shouldShowErrorToUser = Boolean(error?.message && feed.length === 0);

  return isBroadlyNsfwSubplebbit && !hasUnhiddenAnyNsfwCommunity ? (
    <Over18Warning />
  ) : (
    <div className={styles.content}>
      <div className={styles.sidebar}>
        <Sidebar subplebbit={subplebbit} isSubCreatedButNotYetPublished={started && isSubCreatedButNotYetPublished} settings={settings} reset={reset} />
      </div>
      {shouldShowErrorToUser && (
        <div className={styles.error}>
          <ErrorDisplay error={error} />
        </div>
      )}
      <div className={styles.feed}>
        {process.env.NODE_ENV !== 'production' && (
          <button className={styles.debugButton} onClick={reset}>
            Reset Feed
          </button>
        )}
        <Virtuoso
          increaseViewportBy={{ bottom: 1200, top: 600 }}
          totalCount={combinedFeed?.length || 0}
          data={combinedFeed}
          computeItemKey={(index, post) => post?.cid || index}
          itemContent={(index, post) => <Post key={post?.cid} index={index} post={post} />}
          useWindowScroll={true}
          components={{ Footer: () => <Footer {...footerProps} /> }}
          endReached={loadMore}
          ref={virtuosoRef}
          restoreStateFrom={lastVirtuosoState}
          initialScrollTop={lastVirtuosoState?.scrollTop}
        />
      </div>
    </div>
  );
};

export default Subplebbit;
