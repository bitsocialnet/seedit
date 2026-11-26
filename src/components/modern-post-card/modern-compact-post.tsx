import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Comment, useBlock, useEditedComment } from '@bitsocial/bitsocial-react-hooks';
import { useCommentMediaInfo } from '../../hooks/use-comment-media-info';
import usePostObscuring from '../../hooks/use-post-obscuring';
import usePrefetchIntent from '../../hooks/use-prefetch-intent';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityPostUrl } from '../../lib/utils/community-route-utils';
import { stripCommentPostOptionMarkers } from '../../lib/utils/fivechan-post-options';
import { type CommentMediaInfo } from '../../lib/utils/media-utils';
import { formatScore, getPostPagePath, getPostScore, getPostTitleText } from '../../lib/utils/post-utils';
import Markdown from '../markdown';
import { ModernShareButton, ModernVoteButtons } from '../modern-actions';
import ModernCommentMenu from '../modern-comment-menu';
import { CollapseIcon, CommentIcon, ExpandIcon, ImageIcon, LinkIcon, PlayIcon, TextPostIcon } from '../modern-icons';
import { PostMedia, PostMeta, PostTags } from './modern-post-card';
import styles from './modern-post-card.module.css';

// Rows unmount once they scroll far out of view; a post opened in place is still open when its row comes back.
const expandedPosts = new Set<string>();

type PreviewKind = 'image' | 'video' | 'link' | 'text';

interface Preview {
  kind: PreviewKind;
  image?: string;
  /** A video without a still shows its first frame. */
  video?: string;
}

/** What the row's preview square shows: the post's own picture when it has one, otherwise an icon for its kind. */
const getPreview = (mediaInfo: CommentMediaInfo | undefined, link: string | undefined, hasText: boolean): Preview | undefined => {
  const type = mediaInfo?.type;
  if (mediaInfo && (type === 'image' || type === 'gif')) return { kind: 'image', image: mediaInfo.thumbnail || mediaInfo.url };
  if (mediaInfo && type === 'video') return { kind: 'video', image: mediaInfo.thumbnail, video: mediaInfo.thumbnail ? undefined : mediaInfo.url };
  if (mediaInfo && type === 'audio') return { kind: 'video' };
  if (link) return { kind: 'link', image: mediaInfo?.patternThumbnailUrl || mediaInfo?.thumbnail };
  if (hasText) return { kind: 'text' };
  return undefined;
};

const previewIcons = { image: ImageIcon, video: PlayIcon, link: LinkIcon, text: TextPostIcon };

interface CompactPreviewProps {
  preview: Preview;
  obscured: boolean;
  isExpanded: boolean;
}

const CompactPreview = ({ preview: { kind, image, video }, obscured, isExpanded }: CompactPreviewProps) => {
  // A still that fails to load gives way to the icon, instead of a broken image.
  const [failedSource, setFailedSource] = useState<string>();
  const Icon = previewIcons[kind];
  const showImage = Boolean(image && image !== failedSource);
  const showVideo = !showImage && Boolean(video && video !== failedSource);
  const stillClass = `${styles.compactPreviewImage} ${obscured ? styles.compactPreviewObscured : ''}`;

  return (
    <>
      {showImage ? (
        <img className={stillClass} src={image} alt='' loading='lazy' decoding='async' onError={() => setFailedSource(image)} />
      ) : showVideo ? (
        // only the metadata loads, which is enough for the first frame, as for the card view's video
        <video className={stillClass} src={`${video}#t=0.1`} preload='metadata' muted playsInline tabIndex={-1} onError={() => setFailedSource(video)} />
      ) : (
        <Icon size={22} />
      )}
      {/* a video's still gets a play mark, so it does not read as a picture */}
      {(showImage || showVideo) && kind === 'video' && (
        <span className={styles.compactPreviewBadge}>
          <PlayIcon size={12} />
        </span>
      )}
      {/* shown on hover and focus, and while open: the square opens the post in place */}
      <span className={styles.compactPreviewToggle}>{isExpanded ? <CollapseIcon size={18} /> : <ExpandIcon size={18} />}</span>
    </>
  );
};

interface CompactExpandoProps {
  id: string;
  kind: PreviewKind;
  bodyText: string;
  mediaInfo: CommentMediaInfo | undefined;
  link: string | undefined;
  linkWidth?: number;
  linkHeight?: number;
  obscuredLabel: string | undefined;
  onReveal: () => void;
}

/** What the preview square opens under the row: the post's text, then its media or link. */
const CompactExpando = ({ id, kind, bodyText, mediaInfo, link, linkWidth, linkHeight, obscuredLabel, onReveal }: CompactExpandoProps) => (
  <div id={id} className={`${styles.compactExpando} ${styles.raised}`}>
    {bodyText && (
      // covered text stays out of reach, as covered media does
      <div className={`${styles.compactText} ${obscuredLabel ? styles.previewObscured : ''}`} inert={obscuredLabel ? true : undefined}>
        <Markdown content={bodyText} />
      </div>
    )}
    {kind !== 'text' ? (
      <PostMedia mediaInfo={mediaInfo} link={link} linkWidth={linkWidth} linkHeight={linkHeight} obscuredLabel={obscuredLabel} onReveal={onReveal} />
    ) : (
      obscuredLabel && (
        <button type='button' className={styles.textButton} onClick={onReveal}>
          {obscuredLabel}
        </button>
      )
    )}
  </div>
);

interface ModernCompactPostProps {
  post: Comment;
  /** Community feeds already show the community, so their rows lead with the author instead. */
  showCommunity?: boolean;
}

/**
 * A post as one dense row: a preview square, the title, and one line with who posted where and when, the votes and
 * the replies. The preview square opens the post's media or text in place, under the row, as old.reddit's expando
 * did, so reading down a feed does not need a trip to each post.
 */
const ModernCompactPost = ({ post: feedPost, showCommunity = true }: ModernCompactPostProps) => {
  const { t } = useTranslation();
  const { editedComment } = useEditedComment({ comment: feedPost });
  const post: Comment = editedComment || feedPost;
  const { cid, content, deleted, downvoteCount, link, linkHeight, linkWidth, removed, replyCount, state, title, upvoteCount } = post;

  const communityAddress = getCommentCommunityAddress(post);
  const { nsfw, obscuredLabel, reveal } = usePostObscuring(post);
  const mediaInfo = useCommentMediaInfo(post);
  const { blocked, unblock } = useBlock({ cid });
  const prefetchPost = usePrefetchIntent({ commentCid: cid, communityAddress });
  const [isExpanded, setIsExpanded] = useState(() => Boolean(cid && expandedPosts.has(cid)));

  const isGone = Boolean(removed || deleted);
  // a link or media post can have no text at all
  const contentText: string = isGone ? '' : (stripCommentPostOptionMarkers(content as string | undefined, post, communityAddress) ?? '');
  // A post without a title already shows its text as the title, so there is no more text to open.
  const bodyText = title ? contentText.trim() : '';
  const preview = isGone ? undefined : getPreview(mediaInfo, link, Boolean(bodyText));
  const expandoId = `compact-expando-${cid || post.index}`;
  const score = formatScore(getPostScore(upvoteCount, downvoteCount, state));
  const commentLabel = replyCount === 1 ? t('one_comment') : `${replyCount || 0} ${t('comments')}`;

  const toggleExpanded = () => {
    const next = !isExpanded;
    if (cid) {
      if (next) expandedPosts.add(cid);
      else expandedPosts.delete(cid);
    }
    setIsExpanded(next);
  };

  if (blocked) {
    return (
      <div className={styles.hiddenRow}>
        <span>{t('post_hidden')}</span>
        <button type='button' className={styles.textButton} onClick={unblock}>
          {t('undo')}
        </button>
      </div>
    );
  }

  return (
    <article className={`${styles.compactRow} ${isExpanded ? styles.compactRowExpanded : ''}`}>
      {preview ? (
        <button
          type='button'
          className={`${styles.compactPreview} ${styles.raised}`}
          aria-label={isExpanded ? t('collapse_post') : t('expand_post')}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? expandoId : undefined}
          onClick={toggleExpanded}
        >
          <CompactPreview preview={preview} obscured={Boolean(obscuredLabel)} isExpanded={isExpanded} />
        </button>
      ) : (
        // Nothing to open in place: the square keeps titles aligned and opens the post like the title does.
        <Link to={getPostPagePath(post)} className={`${styles.compactPreview} ${styles.raised}`} tabIndex={-1} aria-hidden='true'>
          <TextPostIcon size={22} />
        </Link>
      )}

      <div className={styles.compactBody}>
        <div className={styles.compactMeta}>
          <PostMeta post={post} showCommunity={showCommunity} />
          <PostTags post={post} nsfw={nsfw} />
        </div>
        <h3 className={styles.compactTitle}>
          <Link to={getPostPagePath(post)} className={styles.titleLink} {...prefetchPost}>
            {getPostTitleText(title, contentText)}
          </Link>
        </h3>
        <div className={`${styles.compactActions} ${styles.raised}`}>
          <ModernVoteButtons comment={post} score={score} variant='plain' />
          <Link to={getPostPagePath(post)} className={styles.compactActionButton} aria-label={commentLabel}>
            <CommentIcon size={16} />
            <span aria-hidden='true'>{replyCount || 0}</span>
          </Link>
          <ModernShareButton
            className={styles.compactActionButton}
            iconSize={16}
            iconOnly
            url={cid && communityAddress ? getCommunityPostUrl(communityAddress, cid) : undefined}
          />
          <ModernCommentMenu comment={post} className={styles.compactActionButton} iconSize={16} />
        </div>
      </div>

      {isExpanded && preview && (
        <CompactExpando
          id={expandoId}
          kind={preview.kind}
          bodyText={bodyText}
          mediaInfo={mediaInfo}
          link={link}
          linkWidth={linkWidth}
          linkHeight={linkHeight}
          obscuredLabel={obscuredLabel}
          onReveal={reveal}
        />
      )}
    </article>
  );
};

export default memo(ModernCompactPost);
