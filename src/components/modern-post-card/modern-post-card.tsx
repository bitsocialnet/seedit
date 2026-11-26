import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Comment, useAuthorAddress, useBlock, useCommunity, useEditedComment } from '@bitsocial/bitsocial-react-hooks';
import { useCommentMediaInfo } from '../../hooks/use-comment-media-info';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import usePostObscuring from '../../hooks/use-post-obscuring';
import usePrefetchIntent from '../../hooks/use-prefetch-intent';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityPath, getCommunityPostUrl } from '../../lib/utils/community-route-utils';
import { stripCommentPostOptionMarkers } from '../../lib/utils/fivechan-post-options';
import { type CommentMediaInfo } from '../../lib/utils/media-utils';
import { getPlainTextPreview } from '../../lib/utils/plain-text-preview';
import { formatScore, getPostPagePath, getPostScore, getPostTitleText } from '../../lib/utils/post-utils';
import { formatLocalizedUTCTimestamp, getFormattedTimeAgo } from '../../lib/utils/time-utils';
import { stripTripcodeProof } from '../../lib/utils/tripcode-utils';
import { getHostname } from '../../lib/utils/url-utils';
import { ModernShareButton, ModernVoteButtons } from '../modern-actions';
import ModernCommentMenu from '../modern-comment-menu';
import ModernCommunityAvatar from '../modern-community-avatar';
import { CommentIcon, ExternalLinkIcon, PinIcon } from '../modern-icons';
import { modernStyles } from '../modern-layout';
import styles from './modern-post-card.module.css';

interface PostMetaProps {
  post: Comment;
  showCommunity: boolean;
  /** Post pages show when the author last edited the post. */
  showEdited?: boolean;
}

export const PostMeta = ({ post, showCommunity, showEdited }: PostMetaProps) => {
  const { t, i18n } = useTranslation();
  const { author, cid, edit, pinned, state, timestamp } = post;
  const communityAddress = getCommentCommunityAddress(post);
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress), onlyIfCached: true } : undefined);
  const communityName = getDisplayAddress(community?.shortAddress || '') || getShortDisplayAddress(communityAddress);
  const { shortAuthorAddress } = useAuthorAddress({ comment: post });
  const displayName = stripTripcodeProof(author?.displayName)?.trim();
  const prefetchCommunity = usePrefetchIntent({ communityAddress });
  // as in the old interface, a link post leads to the other posts linking to its domain
  const linkHostname = post.link ? getHostname(post.link) : '';

  return (
    <div className={styles.meta}>
      {showCommunity && communityAddress && (
        <Link to={getCommunityPath(communityAddress)} className={`${styles.raised} ${styles.community}`} title={communityAddress} {...prefetchCommunity}>
          <ModernCommunityAvatar address={communityAddress} avatarUrl={community?.suggested?.avatarUrl} />
          <span className={styles.communityName}>s/{communityName}</span>
        </Link>
      )}
      {author?.address && (
        <Link to={cid ? `/u/${author.address}/comments/${cid}` : `/profile/${post.index}`} className={`${styles.raised} ${styles.author}`} title={author.address}>
          {displayName ? `${displayName} ` : ''}u/{getDisplayAddress(shortAuthorAddress || author.shortAddress || '')}
        </Link>
      )}
      <span className={styles.dot} aria-hidden='true'>
        ·
      </span>
      <time dateTime={timestamp ? new Date(timestamp * 1000).toISOString() : undefined} title={formatLocalizedUTCTimestamp(timestamp, i18n.language)}>
        {getFormattedTimeAgo(timestamp)}
      </time>
      {linkHostname && (
        <Link to={`/domain/${linkHostname}`} className={`${styles.raised} ${styles.domain}`}>
          {linkHostname}
        </Link>
      )}
      {showEdited && edit?.timestamp && <span className={styles.edited}>{t('last_edited', { timestamp: getFormattedTimeAgo(edit.timestamp) })}</span>}
      {pinned && (
        <span className={styles.pinned}>
          <PinIcon size={14} /> {t('announcement')}
        </span>
      )}
      {state === 'failed' && <span className={styles.failed}>{t('failed')}</span>}
      {!cid && state !== 'failed' && <span className={styles.badge}>{t('pending')}</span>}
    </div>
  );
};

interface PostTagsProps {
  post: Comment;
  nsfw: boolean;
}

export const PostTags = ({ post: { flair, spoiler }, nsfw }: PostTagsProps) => {
  const { t } = useTranslation();
  if (!flair?.text && !nsfw && !spoiler) return null;

  return (
    <div className={styles.tags}>
      {nsfw && <span className={`${styles.badge} ${styles.nsfwBadge}`}>{t('nsfw')}</span>}
      {spoiler && <span className={styles.badge}>{t('spoiler')}</span>}
      {flair?.text && (
        <span className={styles.flair} style={{ backgroundColor: flair.backgroundColor, color: flair.textColor }}>
          {flair.text}
        </span>
      )}
    </div>
  );
};

interface PostMediaProps {
  mediaInfo: CommentMediaInfo | undefined;
  link: string | undefined;
  linkWidth?: number;
  linkHeight?: number;
  obscuredLabel?: string;
  onReveal: () => void;
  /** Comments show media smaller than posts do. */
  compact?: boolean;
}

export const PostMedia = ({ mediaInfo, link, linkWidth, linkHeight, obscuredLabel, onReveal, compact }: PostMediaProps) => {
  // Media that fails to load falls back to its link, instead of leaving an empty frame.
  const [failedUrl, setFailedUrl] = useState<string>();
  const type = mediaInfo?.url && mediaInfo.url === failedUrl ? 'failed' : mediaInfo?.type;
  const handleError = () => setFailedUrl(mediaInfo?.url);
  // Known dimensions reserve the media's space, so rows above do not move while it loads.
  const aspectRatio = linkWidth && linkHeight ? `${linkWidth} / ${linkHeight}` : undefined;
  let media: React.ReactNode;

  if (mediaInfo && (type === 'image' || type === 'gif')) {
    media = <img className={styles.mediaElement} src={mediaInfo.url} alt='' loading='lazy' decoding='async' style={{ aspectRatio }} onError={handleError} />;
  } else if (mediaInfo && type === 'video') {
    media = <video className={styles.mediaElement} src={mediaInfo.url} controls preload='metadata' playsInline style={{ aspectRatio }} onError={handleError} />;
  } else if (mediaInfo && type === 'audio') {
    return <audio className={styles.audio} src={mediaInfo.url} controls preload='none' />;
  } else if (link) {
    const thumbnail = mediaInfo?.patternThumbnailUrl || mediaInfo?.thumbnail;
    const hostname = getHostname(link);
    return (
      <a className={`${styles.linkPreview} ${compact ? styles.compact : ''}`} href={link} target='_blank' rel='noopener noreferrer'>
        <span className={styles.linkPreviewText}>
          <span className={styles.linkHost}>{hostname}</span>
          <span className={styles.linkUrl}>{link}</span>
        </span>
        {thumbnail && !obscuredLabel ? <img className={styles.linkThumbnail} src={thumbnail} alt='' loading='lazy' /> : <ExternalLinkIcon size={18} />}
      </a>
    );
  } else {
    return null;
  }

  return (
    <div className={`${styles.media} ${compact ? styles.compact : ''}`}>
      {/* inert keeps hidden video controls out of the tab order until the media is revealed. */}
      <div className={obscuredLabel ? styles.obscured : undefined} inert={obscuredLabel ? true : undefined}>
        {media}
      </div>
      {obscuredLabel && (
        <button type='button' className={styles.revealButton} onClick={onReveal}>
          <span className={modernStyles.sentenceCase}>{obscuredLabel}</span>
        </button>
      )}
    </div>
  );
};

interface PostActionsProps {
  post: Comment;
  /** On a post page the comment button goes to the reply form instead of opening the post. */
  onComment?: () => void;
  /** False when the community takes no votes on the post, such as a locked one. */
  canVote?: boolean;
  /** Opens the edit form on the post page; feed cards offer no edit. */
  onEdit?: () => void;
}

// Votes and the copied state change often, so they re-render only the action bar.
export const PostActions = ({ post, onComment, canVote = true, onEdit }: PostActionsProps) => {
  const { t } = useTranslation();
  const { cid, downvoteCount, replyCount, state, upvoteCount } = post;
  const communityAddress = getCommentCommunityAddress(post);
  const score = formatScore(getPostScore(upvoteCount, downvoteCount, state));
  const commentLabel = replyCount === 1 ? t('one_comment') : `${replyCount || 0} ${t('comments')}`;

  return (
    <div className={`${styles.actions} ${styles.raised}`}>
      <ModernVoteButtons comment={post} score={score} disabled={!canVote} />
      {onComment ? (
        <button type='button' className={styles.actionButton} aria-label={commentLabel} onClick={onComment}>
          <CommentIcon size={18} />
          <span aria-hidden='true'>{replyCount || 0}</span>
        </button>
      ) : (
        <Link to={getPostPagePath(post)} className={styles.actionButton} aria-label={commentLabel}>
          <CommentIcon size={18} />
          <span aria-hidden='true'>{replyCount || 0}</span>
        </Link>
      )}
      <ModernShareButton className={styles.actionButton} url={cid && communityAddress ? getCommunityPostUrl(communityAddress, cid) : undefined} />
      <ModernCommentMenu comment={post} onEdit={onEdit} className={`${styles.actionButton} ${styles.menuButton}`} />
    </div>
  );
};

interface ModernPostCardProps {
  post: Comment;
  /** Community feeds already show the community, so their cards lead with the author instead. */
  showCommunity?: boolean;
}

const ModernPostCard = ({ post: feedPost, showCommunity = true }: ModernPostCardProps) => {
  const { t } = useTranslation();
  // A pending mod or author edit replaces what the feed has.
  const { editedComment } = useEditedComment({ comment: feedPost });
  const post: Comment = editedComment || feedPost;
  const { cid, content, deleted, link, linkHeight, linkWidth, removed, title } = post;

  const communityAddress = getCommentCommunityAddress(post);
  const { nsfw, obscuredLabel, reveal } = usePostObscuring(post);
  const mediaInfo = useCommentMediaInfo(post);
  const { blocked, unblock } = useBlock({ cid });
  const prefetchPost = usePrefetchIntent({ commentCid: cid, communityAddress });

  const contentText = removed || deleted ? '' : stripCommentPostOptionMarkers(content, post, communityAddress);
  // A post without a title already shows its text as the title.
  const previewText = title ? getPlainTextPreview(contentText) : '';

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
    <article className={styles.card}>
      <PostMeta post={post} showCommunity={showCommunity} />

      <h3 className={styles.title}>
        <Link to={getPostPagePath(post)} className={styles.titleLink} {...prefetchPost}>
          {getPostTitleText(title, contentText)}
        </Link>
      </h3>

      <PostTags post={post} nsfw={nsfw} />

      {removed || deleted ? (
        <p className={styles.preview}>[{(removed ? t('removed') : t('deleted')).toLowerCase()}]</p>
      ) : (
        <>
          {previewText && <p className={`${styles.preview} ${obscuredLabel ? styles.previewObscured : ''}`}>{previewText}</p>}
          <div className={styles.raised}>
            <PostMedia mediaInfo={mediaInfo} link={link} linkWidth={linkWidth} linkHeight={linkHeight} obscuredLabel={obscuredLabel} onReveal={reveal} />
          </div>
        </>
      )}

      <PostActions post={post} />
    </article>
  );
};

export default memo(ModernPostCard);
