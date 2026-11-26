import { memo, useEffect, useRef, useMemo, type ComponentProps } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle, StateSnapshot } from 'react-virtuoso';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import useDomainFeed from '../../hooks/use-domain-feed';
import { useInfiniteFeedEnabled } from '../../hooks/use-feed-pagination';
import FeedFooter from '../../components/feed-footer';
import TopTimeFilter from '../../components/top-time-filter';
import Post from '../../components/post';
import Sidebar from '../../components/sidebar';
import layoutStyles from '../../components/feed-layout';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

type DomainFeedContext = ComponentProps<typeof FeedFooter>;

// Keep the component type stable so feed updates preserve pagination state.
const DomainFeedFooter = ({ context }: { context: DomainFeedContext }) => <FeedFooter {...context} />;
const feedComponents = { Footer: DomainFeedFooter };
const DomainSidebar = memo(Sidebar);
const renderPost = (index: number, post: Comment) => <Post index={index} post={post} />;

const Domain = () => {
  const params = useParams<{ domain?: string; sortType?: string; timeFilterName?: string }>();
  const domain = params?.domain;
  const { feed, hasMore, loadMore, requestKey, communityAddresses, sortType, timeFilterName, sessionKey, redirectPath, showNoResults } = useDomainFeed(domain);
  const currentTimeFilterName = params.timeFilterName || timeFilterName || 'all';

  const infiniteFeedEnabled = useInfiniteFeedEnabled();

  const documentTitle = domain + ' - Seedit';
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const setLastVirtuosoState = () => {
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[sortType + currentTimeFilterName + 'domain'] = snapshot;
        }
      });
    };
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [sortType, currentTimeFilterName]);

  const lastVirtuosoState = lastVirtuosoStates?.[sortType + currentTimeFilterName + 'domain'];

  const footerProps = useMemo<DomainFeedContext>(
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
          <DomainSidebar />
        </div>
        {showNoResults ? (
          <div className={layoutStyles.feed}>
            <div className={layoutStyles.footer}>
              <div className={layoutStyles.stateString}>
                <span className={layoutStyles.noMatchesFound}>No posts found from {domain}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {sortType === 'top' && <TopTimeFilter selectedTimeFilterName={currentTimeFilterName} sessionKey={sessionKey} />}
            <Virtuoso<Comment, DomainFeedContext>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Domain;
