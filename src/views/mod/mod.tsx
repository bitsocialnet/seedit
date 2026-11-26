import { memo, useEffect, useRef, useMemo, type ComponentProps } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import { useTranslation } from 'react-i18next';
import { useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import useModFeed from '../../hooks/use-mod-feed';
import FeedFooter from '../../components/feed-footer';
import DevelopmentFeedResetButton from '../../components/development-feed-reset-button';
import TopTimeFilter from '../../components/top-time-filter';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import layoutStyles from '../../components/feed-layout';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

type ModFeedContext = ComponentProps<typeof FeedFooter>;

// Keep the component type stable so feed updates preserve pagination state.
const ModFeedFooter = ({ context }: { context: ModFeedContext }) => <FeedFooter {...context} />;
const feedComponents = { Footer: ModFeedFooter };
const ModSidebar = memo(Sidebar);
const renderPost = (index: number, post: Comment) => <Post key={post?.cid} index={index} post={post} />;

const Mod = () => {
  const params = useParams<{ sortType?: string; timeFilterName?: string }>();
  const { feed, hasMore, loadMore, reset, requestKey, communityAddresses, sortType, timeFilterName, sessionKey, redirectPath } = useModFeed();
  const currentTimeFilterName = params.timeFilterName || timeFilterName || (sortType === 'top' ? 'all' : '24h');

  const infiniteFeedEnabled = useInfiniteFeedEnabled();
  const { t } = useTranslation();

  const documentTitle = 'seedit: ' + t('communities_you_moderate');
  useEffect(() => {
    document.title = documentTitle.toLowerCase();
  }, [documentTitle]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[sortType + currentTimeFilterName + 'mod'] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [sortType, currentTimeFilterName]);

  const lastVirtuosoState = lastVirtuosoStates?.[sortType + currentTimeFilterName + 'mod'];

  const footerProps = useMemo<ModFeedContext>(
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
          <ModSidebar />
        </div>
        <div className={layoutStyles.feed}>
          <DevelopmentFeedResetButton onReset={reset} />
          {sortType === 'top' && <TopTimeFilter selectedTimeFilterName={currentTimeFilterName} sessionKey={sessionKey} />}
          <Virtuoso<Comment, ModFeedContext>
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

export default Mod;
