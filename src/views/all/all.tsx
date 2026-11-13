import { memo, useEffect, useRef, useMemo, type ComponentProps } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import { useDefaultSubscriptionAddresses } from '../../hooks/use-default-subscriptions';
import { useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import useFeedRoute from '../../hooks/use-feed-route';
import FeedFooter from '../../components/feed-footer';
import DevelopmentFeedResetButton from '../../components/development-feed-reset-button';
import TopTimeFilter from '../../components/top-time-filter';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import layoutStyles from '../../components/feed-layout';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

type AllFeedContext = ComponentProps<typeof FeedFooter>;

// Keep the component type stable so feed updates preserve pagination state.
const AllFeedFooter = ({ context }: { context: AllFeedContext }) => <FeedFooter {...context} />;
const feedComponents = { Footer: AllFeedFooter };
const AllSidebar = memo(Sidebar);
const renderPost = (index: number, post: Comment) => <Post key={post?.cid} index={index} post={post} />;

const All = () => {
  const communityAddresses = useDefaultSubscriptionAddresses();
  const { feed, hasMore, loadMore, reset, requestKey, sortType, timeFilterName, sessionKey, redirectPath } = useFeedRoute(communityAddresses);
  const currentTimeFilterName = timeFilterName || (sortType === 'top' ? 'all' : '24h');

  const infiniteFeedEnabled = useInfiniteFeedEnabled();

  const { t } = useTranslation();

  const documentTitle = 'seedit: ' + t('all_communities');
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[sortType + currentTimeFilterName + 'all'] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [sortType, currentTimeFilterName]);

  const lastVirtuosoState = lastVirtuosoStates?.[sortType + currentTimeFilterName + 'all'];

  const footerProps = useMemo<AllFeedContext>(
    () => ({
      feedLength: feed?.length ?? 0,
      hasFeedLoaded: !!feed,
      hasMore,
      communityAddresses,
      onLoadMore: loadMore,
      requestKey,
    }),
    [feed, hasMore, communityAddresses, loadMore, requestKey],
  );

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div>
      <div className={layoutStyles.content}>
        <div className={`${layoutStyles.sidebar}`}>
          <AllSidebar />
        </div>
        <div className={layoutStyles.feed}>
          <DevelopmentFeedResetButton onReset={reset} />
          {sortType === 'top' && <TopTimeFilter selectedTimeFilterName={currentTimeFilterName} sessionKey={sessionKey} />}
          <Virtuoso<Comment, AllFeedContext>
            increaseViewportBy={{ bottom: 1200, top: 600 }}
            totalCount={feed?.length || 0}
            data={feed}
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
    </div>
  );
};

export default All;
