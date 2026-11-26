import { useTranslation } from 'react-i18next';
import { type Comment, useEditedComment } from '@bitsocial/bitsocial-react-hooks';
import { useCommentMediaInfo } from '../../hooks/use-comment-media-info';
import usePostObscuring from '../../hooks/use-post-obscuring';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommentPostOptions, stripCommentPostOptionMarkers } from '../../lib/utils/fivechan-post-options';
import { getPostTitleText } from '../../lib/utils/post-utils';
import Markdown from '../../components/markdown';
import { modernStyles } from '../../components/modern-layout';
import { PostActions, PostMedia, PostMeta, PostTags } from '../../components/modern-post-card';
import styles from './modern-post.module.css';

interface ModernPostDetailProps {
  post: Comment;
  /** Moves to the comment form; without it, the comment button opens the post's full thread. */
  onComment?: () => void;
  canVote: boolean;
}

/** The post at the top of its page: full text and media instead of a feed card's preview. */
const ModernPostDetail = ({ post: loadedPost, onComment, canVote }: ModernPostDetailProps) => {
  const { t } = useTranslation();
  // A pending mod or author edit replaces what the network has.
  const { editedComment } = useEditedComment({ comment: loadedPost });
  const post: Comment = editedComment || loadedPost;
  const { content, deleted, edit, link, linkHeight, linkWidth, number, quotedCids, reason, removed, title } = post;
  const communityAddress = getCommentCommunityAddress(post);
  const { nsfw, obscuredLabel, reveal } = usePostObscuring(post);
  const mediaInfo = useCommentMediaInfo(post);
  const isRemovedOrDeleted = Boolean(removed || deleted);
  const contentText = (isRemovedOrDeleted ? '' : stripCommentPostOptionMarkers(content, post, communityAddress)) || '';

  return (
    <article className={styles.post}>
      <PostMeta post={post} showCommunity showEdited />
      {/* An untitled post reads from its text, so its heading is only for assistive technology. */}
      <h1 className={title ? styles.title : modernStyles.visuallyHidden}>{getPostTitleText(title, contentText)}</h1>
      <PostTags post={post} nsfw={nsfw} />

      {isRemovedOrDeleted ? (
        <p className={styles.placeholder}>[{(removed ? t('removed') : t('deleted')).toLowerCase()}]</p>
      ) : (
        <>
          {contentText.trim() && (
            <div className={`${styles.body} ${obscuredLabel ? styles.obscured : ''}`}>
              {/* inert keeps links in covered text out of the tab order until it is revealed. */}
              <div className={obscuredLabel ? styles.obscuredText : undefined} inert={obscuredLabel ? true : undefined}>
                <Markdown
                  content={content}
                  enableFivechanQuotes={typeof number === 'number'}
                  postOptions={getCommentPostOptions(post, communityAddress)}
                  quotedCids={quotedCids}
                />
              </div>
              {/* Link previews and audio have no reveal button of their own, so covered text always gets one. */}
              {obscuredLabel && (
                <button type='button' className={styles.revealButton} onClick={reveal}>
                  <span className={modernStyles.sentenceCase}>{obscuredLabel}</span>
                </button>
              )}
            </div>
          )}
          <PostMedia mediaInfo={mediaInfo} link={link} linkWidth={linkWidth} linkHeight={linkHeight} obscuredLabel={obscuredLabel} onReveal={reveal} />
        </>
      )}
      {reason && (
        <p className={styles.reason}>
          {t('mod_edit_reason')}: {reason}
        </p>
      )}
      {edit?.reason && !isRemovedOrDeleted && (
        <p className={styles.reason}>
          {t('edit')}: {edit.reason}
        </p>
      )}

      <PostActions post={post} onComment={onComment} canVote={canVote} />
    </article>
  );
};

export default ModernPostDetail;
