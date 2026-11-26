import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Comment, useComment } from '@bitsocial/bitsocial-react-hooks';
import findTopParentCidOfReply from '../../lib/utils/cid-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { THREAD_REPLY_SORTS, type ThreadReplySort } from '../../lib/utils/post-utils';
import { getCommunityPostPath } from '../../lib/utils/community-route-utils';
import { isPostContextView } from '../../lib/utils/view-utils';
import usePostPage from '../../hooks/use-post-page';
import useSortedReplies from '../../hooks/use-sorted-replies';
import useStateString from '../../hooks/use-state-string';
import ErrorDisplay from '../../components/error-display';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Over18Warning from '../../components/over-18-warning';
import PostComponent from '../../components/post';
import Reply from '../../components/reply';
import ReplyForm from '../../components/reply-form';
import Sidebar from '../../components/sidebar';
import styles from './post.module.css';
import lowerCase from 'lodash/lowerCase';

type SortDropdownProps = {
  sortBy: ThreadReplySort;
  onSortChange: (sort: ThreadReplySort) => void;
};

const SortDropdown = ({ sortBy, onSortChange }: SortDropdownProps) => {
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [openDropdown, setOpenDropdown] = useState(false);

  const handleGlobalClick = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setOpenDropdown(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [handleGlobalClick]);

  return (
    <div className={styles.spacer}>
      <span className={styles.dropdownTitle}>{t('reply_sorted_by')}: </span>
      <div
        ref={dropdownRef}
        className={styles.dropdown}
        onClick={(e) => {
          e.stopPropagation();
          setOpenDropdown(!openDropdown);
        }}
      >
        <span className={styles.selected}>{t(sortBy)}</span>
        {openDropdown && (
          <div className={styles.dropdownItems}>
            {THREAD_REPLY_SORTS.map((item) => (
              <div
                className={styles.dropdownItem}
                key={item}
                onClick={() => {
                  setOpenDropdown(false);
                  onSortChange(item);
                }}
              >
                {t(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Post = ({ post }: { post: Comment }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const isInPostContextView = isPostContextView(location.pathname, params, location.search);

  const { cid, deleted, depth, locked, removed, postCid, replyCount, state, timestamp } = post || {};
  const communityAddress = getCommentCommunityAddress(post);

  const [sortBy, setSortBy] = useState<ThreadReplySort>('best');
  const replies = useSortedReplies(post, sortBy);

  const isSingleComment = post?.parentCid ? true : false;

  const commentCount = replyCount === 0 ? t('no_comments') : replyCount === 1 ? t('one_comment') : t('all_comments', { count: replyCount });
  const stateString = useStateString(post);

  const lockedState = deleted ? t('deleted') : locked ? t('locked') : removed ? t('removed') : '';

  const postComment = useComment({ commentCid: postCid });

  return (
    <>
      {(deleted || locked || removed) && (
        <div className={styles.lockedInfobar}>
          <div className={styles.lockedInfobarText}>{t('post_locked_info', { state: lowerCase(lockedState) })}</div>
        </div>
      )}
      {isSingleComment ? <PostComponent post={postComment} /> : <PostComponent post={post} />}
      {timestamp && (
        <div className={styles.replyArea}>
          {!isSingleComment && (
            <div className={styles.repliesTitle}>
              <span className={styles.title}>
                {replyCount !== undefined
                  ? commentCount
                  : state === 'failed'
                    ? t('post_has_failed')
                    : cid
                      ? `${t('downloading_comments')}...`
                      : `${t('post_is_pending')}...`}
              </span>
            </div>
          )}
          {!isSingleComment && (
            <div className={styles.menuArea}>
              <SortDropdown sortBy={sortBy} onSortChange={setSortBy} />
              <div className={styles.spacer} />
              {communityAddress && cid && <ReplyForm cid={cid} communityAddress={communityAddress} postCid={postCid} />}
            </div>
          )}
          {isSingleComment && (
            <div className={styles.singleCommentInfobar}>
              <div className={styles.singleCommentInfobarText}>{t('single_comment_notice')}</div>
              <div className={styles.singleCommentInfobarLink}>
                <Link to={communityAddress && postCid ? getCommunityPostPath(communityAddress, postCid) : '/'}>{t('single_comment_link')}</Link> →
              </div>
            </div>
          )}
          <div className={styles.replies}>
            {replies.length === 0 && replyCount !== undefined && !(isInPostContextView || isSingleComment) && (
              <div className={styles.noReplies}>{t('nothing_found')}</div>
            )}
            {isSingleComment ? (
              <Reply key={`singleComment-${cid}`} reply={post} depth={0} isSingleComment={true} />
            ) : (
              replies.map((reply, index) => <Reply key={reply.cid ?? `pending-reply-${index}`} reply={reply} depth={depth} />)
            )}
          </div>
        </div>
      )}
      <span className={styles.loadingString}>
        {stateString && stateString !== 'Failed' ? (
          <div className={styles.stateString}>
            <LoadingEllipsis string={stateString || t('loading')} />
          </div>
        ) : (
          state === 'failed' && t('failed')
        )}
      </span>
    </>
  );
};

const PostWithContext = ({ post }: { post: Comment }) => {
  const { t } = useTranslation();
  const params = useParams();
  const { deleted, locked, postCid, removed, state } = post || {};
  const communityAddress = getCommentCommunityAddress(post);
  const postComment = useComment({ commentCid: postCid });
  const topParentCid = findTopParentCidOfReply(post.cid, postComment);
  const topParentComment = useComment({ commentCid: topParentCid || undefined });
  const stateString = useStateString(post);

  return (
    <>
      {(deleted || locked || removed) && (
        <div className={styles.lockedInfobar}>
          <div className={styles.lockedInfobarText}>{t('post_locked_info', { state: deleted ? t('deleted') : locked ? t('locked') : removed ? t('removed') : '' })}</div>
        </div>
      )}
      <PostComponent post={postComment} />
      <div className={styles.replyArea}>
        <div className={styles.menuArea}>
          {stateString && stateString !== 'Failed' ? (
            <div className={styles.stateString}>
              <LoadingEllipsis string={stateString} />
            </div>
          ) : (
            state === 'failed' && t('failed')
          )}
        </div>
        <div className={styles.singleCommentInfobar}>
          <div className={styles.singleCommentInfobarText}>{t('single_comment_notice')}</div>
          <div className={styles.singleCommentInfobarLink}>
            <Link to={communityAddress && postCid ? getCommunityPostPath(communityAddress, postCid) : '/'}>{t('single_comment_link')}</Link> →
          </div>
        </div>
        <div className={styles.replies}>
          <Reply key={`contextComment-${topParentComment?.cid}`} reply={topParentComment} depth={0} cidOfReplyWithContext={params.commentCid} />
        </div>
      </div>
    </>
  );
};

const PostPage = () => {
  const { t } = useTranslation();
  const { post, community, directoryCode, isInPendingPostView, isInPostContextView, isNsfwGated, shouldShowError } = usePostPage();

  return isNsfwGated ? (
    <Over18Warning />
  ) : (
    <div className={styles.content}>
      <div className={styles.sidebar}>
        {directoryCode && !isInPendingPostView ? (
          <LoadingEllipsis string={t('loading')} />
        ) : (
          <Sidebar community={community} comment={post} settings={community?.settings} />
        )}
      </div>
      {isInPostContextView ? <PostWithContext post={post} /> : <Post post={post} />}
      {shouldShowError && (
        <div className={styles.error}>
          <ErrorDisplay error={post.error} />
        </div>
      )}
    </div>
  );
};

export default PostPage;
