import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAuthor, type Comment } from '@bitsocial/bitsocial-react-hooks';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import useAuthorFeed from '../../hooks/use-author-feed';
import useWindowWidth from '../../hooks/use-window-width';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Post from '../../components/post';
import Reply from '../../components/reply/';
import AuthorSidebar from '../../components/author-sidebar';
import styles from './author.module.css';
import ErrorDisplay from '../../components/error-display';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { stripTripcodeProof } from '../../lib/utils/tripcode-utils';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

interface AuthorFeedContext {
  hasMore: boolean;
  loadingString: string;
}

const AuthorFeedFooter = ({ context }: { context: AuthorFeedContext }) => {
  const { t } = useTranslation();
  return context.hasMore ? (
    <span className={styles.loadingString}>
      <LoadingEllipsis string={context.loadingString || t('loading')} />
    </span>
  ) : null;
};

const feedComponents = { Footer: AuthorFeedFooter };
const renderComment = (index: number, post: Comment | undefined) =>
  post?.parentCid ? <Reply index={index} isSingleReply={true} reply={post} /> : <Post index={index} post={post} />;

const Author = () => {
  const { t } = useTranslation();
  const { sortType } = useParams();
  const { authorAddress, commentCid, tab, comments: virtuosoData, totalCount, error, hasMore, loadMore, shouldShowError: shouldShowErrorToUser } = useAuthorFeed();
  const author = useAuthor({ commentCid, authorAddress });
  const isInAuthorCommentsView = tab === 'comments';
  const isMobile = useWindowWidth() < 640;

  const loadingString = isInAuthorCommentsView ? t('downloading_comments') : t('downloading_posts');
  const feedContext = useMemo(() => ({ hasMore, loadingString }), [hasMore, loadingString]);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const setLastVirtuosoState = () =>
      virtuosoRef.current?.getState((snapshot: StateSnapshot) => {
        if (snapshot?.ranges?.length) {
          const key = `${authorAddress ?? ''}${sortType ?? ''}`;
          lastVirtuosoStates[key] = snapshot;
        }
      });
    window.addEventListener('scroll', setLastVirtuosoState);
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [authorAddress, sortType]);

  const key = `${authorAddress ?? ''}${sortType ?? ''}`;
  const lastVirtuosoState = lastVirtuosoStates?.[key];

  const displayAddress = getDisplayAddress(author?.author?.shortAddress || '');
  const authorDisplayName = stripTripcodeProof(author?.author?.displayName);
  const profileTitle = authorDisplayName ? `${authorDisplayName} (u/${displayAddress})` : `u/${displayAddress}`;
  useEffect(() => {
    document.title = profileTitle + ' - Seedit';
  }, [t, profileTitle]);

  return (
    <div className={styles.content}>
      <div className={isMobile ? styles.sidebarMobile : styles.sidebarDesktop}>
        <AuthorSidebar />
      </div>
      {shouldShowErrorToUser && (
        <div className={styles.error}>
          <ErrorDisplay error={error} />
        </div>
      )}
      <Virtuoso<Comment | undefined, AuthorFeedContext>
        increaseViewportBy={{ bottom: 1200, top: 600 }}
        totalCount={totalCount}
        data={virtuosoData}
        computeItemKey={(index, post) => post?.cid || index}
        itemContent={renderComment}
        useWindowScroll={true}
        components={feedComponents}
        context={feedContext}
        endReached={loadMore}
        ref={virtuosoRef}
        restoreStateFrom={lastVirtuosoState}
        initialScrollTop={lastVirtuosoState?.scrollTop}
      />
      {virtuosoData?.length === 0 && !hasMore && <div className={styles.noPosts}>{t('nothing_found')}</div>}
    </div>
  );
};

export default Author;
