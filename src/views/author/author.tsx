import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthorComments, useAuthor } from '@bitsocialnet/bitsocial-react-hooks';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { isAuthorCommentsView, isAuthorSubmittedView } from '../../lib/utils/view-utils';
import useWindowWidth from '../../hooks/use-window-width';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Post from '../../components/post';
import Reply from '../../components/reply/';
import AuthorSidebar from '../../components/author-sidebar';
import styles from './author.module.css';
import ErrorDisplay from '../../components/error-display';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

const Author = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { authorAddress, commentCid, sortType } = useParams();
  const author = useAuthor({ commentCid, authorAddress });
  const params = useParams();
  const isInAuthorCommentsView = isAuthorCommentsView(location.pathname, params);
  const isInAuthorSubmittedView = isAuthorSubmittedView(location.pathname, params);
  const isMobile = useWindowWidth() < 640;

  const { authorComments, error, lastCommentCid, hasMore, loadMore } = useAuthorComments({ commentCid, authorAddress });

  const prevErrorMessageRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (error && error.message !== prevErrorMessageRef.current) {
      console.log(error);
      prevErrorMessageRef.current = error.message;
    }
  }, [error]);

  const replyComments = useMemo(() => authorComments?.filter((comment) => comment && comment.parentCid) || [], [authorComments]);
  const postComments = useMemo(() => authorComments?.filter((comment) => comment && !comment.parentCid) || [], [authorComments]);

  const loadingString = isInAuthorCommentsView ? t('downloading_comments') : t('downloading_posts');

  const Footer = () => {
    return hasMore ? (
      <span className={styles.loadingString}>
        <LoadingEllipsis string={loadingString || t('loading')} />
      </span>
    ) : null;
  };

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  let virtuosoData;
  if (isInAuthorCommentsView) {
    virtuosoData = replyComments;
  } else if (isInAuthorSubmittedView) {
    virtuosoData = postComments;
  } else {
    virtuosoData = authorComments;
  }

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

  // always redirect to latest author cid
  useEffect(() => {
    if (authorAddress && lastCommentCid && commentCid && lastCommentCid !== commentCid) {
      navigate(`/u/${authorAddress}/c/${lastCommentCid}`, { replace: true });
    }
  }, [authorAddress, lastCommentCid, commentCid, navigate]);

  const profileTitle = author?.author?.displayName ? `${author?.author?.displayName} (u/${author?.author?.shortAddress})` : `u/${author?.author?.shortAddress}`;
  useEffect(() => {
    document.title = profileTitle + ' - Seedit';
  }, [t, profileTitle]);

  // only show backend errors if the user gets no data
  const [shouldShowErrorToUser, setShouldShowErrorToUser] = useState(false);
  useEffect(() => {
    if (error?.message && virtuosoData?.length === 0) {
      setShouldShowErrorToUser(true);
    } else if (virtuosoData?.length > 0) {
      setShouldShowErrorToUser(false);
    }
  }, [error, virtuosoData]);

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
      <Virtuoso
        increaseViewportBy={{ bottom: 1200, top: 600 }}
        totalCount={authorComments?.length || 0}
        data={virtuosoData}
        itemContent={(index, post) => {
          const isReply = post?.parentCid;
          return !isReply ? <Post index={index} post={post} /> : <Reply index={index} isSingleReply={true} reply={post} />;
        }}
        useWindowScroll={true}
        components={{ Footer }}
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
