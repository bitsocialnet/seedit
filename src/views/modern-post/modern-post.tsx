import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Comment, useAccount, useComment } from '@bitsocial/bitsocial-react-hooks';
import usePostPage from '../../hooks/use-post-page';
import useSortedReplies from '../../hooks/use-sorted-replies';
import useStateString from '../../hooks/use-state-string';
import { findTopParentCidOfReply } from '../../lib/utils/cid-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityPostPath, isResolvableCommunityAddress } from '../../lib/utils/community-route-utils';
import { getThreadPermissions, isModeratorRole, isThreadReplySort, THREAD_REPLY_SORTS, type ThreadReplySort } from '../../lib/utils/post-utils';
import ErrorDisplay from '../../components/error-display';
import ModernComment from '../../components/modern-comment';
import ModernCommunityAbout from '../../components/modern-community-about';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import ModernReplyForm from '../../components/modern-reply-form';
import Over18Warning from '../../components/over-18-warning';
import ModernPostDetail from './modern-post-detail';
import styles from './modern-post.module.css';

const ThreadStatus = ({ text }: { text: string }) => (
  <div className={styles.status} role='status'>
    <span className={styles.spinner} aria-hidden='true' />
    <span className={styles.statusText}>{text}</span>
  </div>
);

/** Where the comment form would be, says why a locked, removed, or deleted post takes no new comments from this account. */
const ClosedNotice = ({ post, canReply }: { post: Comment | undefined; canReply: boolean }) => {
  const { t } = useTranslation();
  const closedState = post?.deleted ? t('deleted') : post?.locked ? t('locked') : post?.removed ? t('removed') : undefined;
  if (!closedState || canReply) return null;
  return <p className={styles.notice}>{t('post_locked_info', { state: closedState.toLowerCase() })}</p>;
};

interface ThreadProps {
  /** The account moderates the post's community, so it can still reply on a locked post. */
  isModerator: boolean;
}

/** A post with all its comments. */
const PostThread = ({ post, isModerator }: ThreadProps & { post: Comment }) => {
  const { t } = useTranslation();
  const { author, cid, number, postCid, replyCount, state } = post;
  const communityAddress = getCommentCommunityAddress(post);
  const { canVote, canReply } = getThreadPermissions(post, isModerator);
  const [sortBy, setSortBy] = useState<ThreadReplySort>('best');
  const replies = useSortedReplies(post, sortBy);
  const stateString = useStateString(post);

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const commentsRef = useRef<HTMLElement>(null);
  const goToComments = () => (composerRef.current ? composerRef.current.focus() : commentsRef.current?.scrollIntoView());

  const isFailed = state === 'failed';
  // The reply count and the first page of replies arrive in the same update.
  const isLoadingReplies = !isFailed && replyCount === undefined;
  const heading = isFailed
    ? t('post_has_failed')
    : replyCount === undefined
      ? t('comments')
      : replyCount === 0
        ? t('no_comments')
        : replyCount === 1
          ? t('one_comment')
          : t('all_comments', { count: replyCount });
  const loadingText = stateString && stateString !== 'Failed' ? stateString : cid ? `${t('downloading_comments')}...` : `${t('post_is_pending')}...`;

  return (
    <>
      <ModernPostDetail post={post} onComment={goToComments} canVote={canVote} />
      <ClosedNotice post={post} canReply={canReply} />
      <section ref={commentsRef} className={styles.comments} aria-labelledby='modern-comments-heading'>
        {canReply && cid && communityAddress && (
          <ModernReplyForm cid={cid} communityAddress={communityAddress} postCid={postCid} submitLabel={t('post_comment')} textareaRef={composerRef} />
        )}
        <div className={styles.commentsBar}>
          <h2 id='modern-comments-heading' className={`${styles.commentsHeading} ${modernStyles.sentenceCase}`}>
            {heading}
          </h2>
          {replies.length > 1 && (
            <label className={styles.sort}>
              <span className={modernStyles.sentenceCase}>{t('sorted_by')}</span>
              <select value={sortBy} onChange={(event) => isThreadReplySort(event.target.value) && setSortBy(event.target.value)}>
                {THREAD_REPLY_SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {t(sort)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {isLoadingReplies && <ThreadStatus text={loadingText} />}
        {Boolean(replyCount) && replies.length === 0 && <p className={styles.status}>{t('nothing_found')}</p>}
        <div className={styles.commentList}>
          {replies.map((reply) => (
            // A reply that is still publishing has no cid yet, only its account comment index.
            <ModernComment
              key={reply.cid ?? `pending-reply-${reply.index}`}
              reply={reply}
              depth={0}
              canReply={canReply}
              canVote={canVote}
              parentNumber={number}
              submitterAddress={author?.address}
            />
          ))}
        </div>
      </section>
    </>
  );
};

/** One comment's branch, opened from a link to that comment, under its post. */
const CommentThread = ({ comment, showContext, isModerator }: ThreadProps & { comment: Comment; showContext: boolean }) => {
  const { t } = useTranslation();
  const threadPost = useComment({ commentCid: comment.postCid });
  // A context link shows the comment's whole branch from its top-level ancestor.
  const topParentCid = showContext && comment.cid ? findTopParentCidOfReply(comment.cid, threadPost) : null;
  const topParent = useComment({ commentCid: topParentCid || undefined });
  const root: Comment = topParentCid && topParent?.timestamp ? topParent : comment;
  const communityAddress = getCommentCommunityAddress(comment);
  const stateString = useStateString(threadPost);
  const { canVote, canReply } = getThreadPermissions(threadPost, isModerator);

  return (
    <>
      {threadPost?.timestamp ? <ModernPostDetail post={threadPost} canVote={canVote} /> : <ThreadStatus text={stateString || t('loading')} />}
      <ClosedNotice post={threadPost} canReply={canReply} />
      <div className={styles.threadNotice}>
        <span>{t('single_comment_notice')}</span>
        {communityAddress && comment.postCid && (
          <Link to={getCommunityPostPath(communityAddress, comment.postCid)} className={styles.threadNoticeLink}>
            {t('single_comment_link')} →
          </Link>
        )}
      </div>
      <div className={styles.branch}>
        <ModernComment
          key={root.cid}
          reply={root}
          depth={0}
          canReply={canReply}
          canVote={canVote}
          highlightCid={comment.cid}
          parentNumber={root.parentCid === root.postCid ? threadPost?.number : undefined}
          submitterAddress={threadPost?.author?.address}
        />
      </div>
    </>
  );
};

const ModernPost = () => {
  const { t } = useTranslation();
  const { post, community, communityAddress, isInPostContextView, isNsfwGated, shouldShowError } = usePostPage();
  const stateString = useStateString(post);
  const accountAddress = useAccount()?.author?.address;
  const isModerator = isModeratorRole(community?.roles?.[accountAddress]?.role);

  if (isNsfwGated) return <Over18Warning />;

  let thread: React.ReactNode;
  if (!post?.timestamp) {
    thread =
      post?.state === 'failed' ? (
        <p className={styles.status}>
          <span className={styles.statusText}>{t('failed')}</span>
        </p>
      ) : (
        <ThreadStatus text={stateString || t('loading')} />
      );
  } else if (post.parentCid) {
    thread = <CommentThread key={post.cid} comment={post} showContext={isInPostContextView} isModerator={isModerator} />;
  } else {
    // Keyed by post, so the sort and open forms reset when another post opens.
    thread = <PostThread key={post.cid ?? post.index} post={post} isModerator={isModerator} />;
  }

  return (
    <ModernColumns
      rail={isResolvableCommunityAddress(communityAddress) && <ModernCommunityAbout community={community} communityAddress={communityAddress} showIdentity />}
    >
      {thread}
      {shouldShowError && (
        <div className={styles.error}>
          <ErrorDisplay error={post.error} />
        </div>
      )}
    </ModernColumns>
  );
};

export default ModernPost;
