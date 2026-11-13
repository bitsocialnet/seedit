import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Comment, useAuthorAddress, useBlock, useCommunity, useEditedComment } from '@bitsocial/bitsocial-react-hooks';
import { useCommentMediaInfo } from '../../hooks/use-comment-media-info';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useDownvote from '../../hooks/use-downvote';
import { useIsNsfwCommunity } from '../../hooks/use-is-nsfw-community';
import usePrefetchIntent from '../../hooks/use-prefetch-intent';
import useUpvote from '../../hooks/use-upvote';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { copyToClipboard } from '../../lib/utils/clipboard-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityPath, getCommunityPostPath, getCommunityPostUrl } from '../../lib/utils/community-route-utils';
import { stripCommentPostOptionMarkers } from '../../lib/utils/fivechan-post-options';
import { type CommentMediaInfo } from '../../lib/utils/media-utils';
import { getPlainTextPreview } from '../../lib/utils/plain-text-preview';
import { formatScore, getPostScore } from '../../lib/utils/post-utils';
import { formatLocalizedUTCTimestamp, getFormattedTimeAgo } from '../../lib/utils/time-utils';
import { stripTripcodeProof } from '../../lib/utils/tripcode-utils';
import { getHostname } from '../../lib/utils/url-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import ModernCommunityAvatar from '../modern-community-avatar';
import { CommentIcon, DownvoteIcon, ExternalLinkIcon, PinIcon, ShareIcon, UpvoteIcon } from '../modern-icons';
import styles from './modern-post-card.module.css';

const TITLE_MAX_LENGTH = 300;

interface PostMediaProps {
  mediaInfo: CommentMediaInfo | undefined;
  link: string | undefined;
  linkWidth?: number;
  linkHeight?: number;
  obscuredLabel?: string;
  onReveal: () => void;
}

const PostMedia = ({ mediaInfo, link, linkWidth, linkHeight, obscuredLabel, onReveal }: PostMediaProps) => {
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
      <a className={styles.linkPreview} href={link} target='_blank' rel='noopener noreferrer'>
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
    <div className={styles.media}>
      {/* inert keeps hidden video controls out of the tab order until the media is revealed. */}
      <div className={obscuredLabel ? styles.obscured : undefined} inert={obscuredLabel ? true : undefined}>
        {media}
      </div>
      {obscuredLabel && (
        <button type='button' className={styles.revealButton} onClick={onReveal}>
          {obscuredLabel}
        </button>
      )}
    </div>
  );
};

interface PostActionsProps {
  post: Comment;
  postPath: string;
  communityAddress: string | undefined;
}

// Votes and the copied state change often, so they re-render only the action bar.
const PostActions = ({ post, postPath, communityAddress }: PostActionsProps) => {
  const { t } = useTranslation();
  const { cid, downvoteCount, replyCount, state, upvoteCount } = post;
  const [upvoted, upvote] = useUpvote(post);
  const [downvoted, downvote] = useDownvote(post);
  const score = formatScore(getPostScore(upvoteCount, downvoteCount, state));

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);
  const share = async () => {
    if (!cid || !communityAddress) return;
    try {
      await copyToClipboard(getCommunityPostUrl(communityAddress, cid));
      setCopied(true);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={`${styles.actions} ${styles.raised}`}>
      <div className={`${styles.votes} ${upvoted ? styles.upvoted : ''} ${downvoted ? styles.downvoted : ''}`}>
        <button
          type='button'
          className={`${styles.voteButton} ${styles.upvoteButton}`}
          aria-label={t('upvote')}
          aria-pressed={upvoted}
          disabled={!cid}
          onClick={() => upvote()}
        >
          <UpvoteIcon size={18} />
        </button>
        <span className={styles.score}>{score}</span>
        <button
          type='button'
          className={`${styles.voteButton} ${styles.downvoteButton}`}
          aria-label={t('downvote')}
          aria-pressed={downvoted}
          disabled={!cid}
          onClick={() => downvote()}
        >
          <DownvoteIcon size={18} />
        </button>
      </div>
      <Link to={postPath} className={styles.actionButton} aria-label={`${replyCount || 0} ${t('comments')}`}>
        <CommentIcon size={18} />
        <span aria-hidden='true'>{replyCount || 0}</span>
      </Link>
      <button type='button' className={styles.actionButton} onClick={share} disabled={!cid}>
        <ShareIcon size={18} />
        <span className={styles.actionLabel} aria-live='polite'>
          {copied ? t('link_copied') : t('share')}
        </span>
      </button>
    </div>
  );
};

interface ModernPostCardProps {
  post: Comment;
  /** Community feeds already show the community, so their cards lead with the author instead. */
  showCommunity?: boolean;
}

const ModernPostCard = ({ post: feedPost, showCommunity = true }: ModernPostCardProps) => {
  const { t, i18n } = useTranslation();
  // A pending mod or author edit replaces what the feed has.
  const { editedComment } = useEditedComment({ comment: feedPost });
  const post: Comment = editedComment || feedPost;
  const { author, cid, content, deleted, flair, link, linkHeight, linkWidth, nsfw: postNsfw, pinned, removed, spoiler, state, timestamp, title } = post;

  const communityAddress = getCommentCommunityAddress(post);
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress), onlyIfCached: true } : undefined);
  const communityName = getDisplayAddress(community?.shortAddress || '') || getShortDisplayAddress(communityAddress);
  const { shortAuthorAddress } = useAuthorAddress({ comment: post });
  const displayName = stripTripcodeProof(author?.displayName)?.trim();

  const isNsfwCommunity = useIsNsfwCommunity(communityAddress || '');
  const blurNsfwThumbnails = useContentOptionsStore((options) => options.blurNsfwThumbnails);
  const nsfw = Boolean(postNsfw || isNsfwCommunity);
  const [isRevealed, setIsRevealed] = useState(false);
  const obscuredLabel = isRevealed ? undefined : nsfw && blurNsfwThumbnails ? t('see_nsfw') : spoiler ? t('view_spoiler') : undefined;

  const mediaInfo = useCommentMediaInfo(post);
  const { blocked, unblock } = useBlock({ cid });

  const postPath = cid && communityAddress ? getCommunityPostPath(communityAddress, cid) : `/profile/${post.index}`;
  const prefetchPost = usePrefetchIntent({ commentCid: cid, communityAddress });
  const prefetchCommunity = usePrefetchIntent({ communityAddress });

  const contentText = removed || deleted ? '' : stripCommentPostOptionMarkers(content, post, communityAddress);
  const titleText = (title || getPlainTextPreview(contentText, TITLE_MAX_LENGTH) || '-').slice(0, TITLE_MAX_LENGTH);
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
        {pinned && (
          <span className={styles.pinned}>
            <PinIcon size={14} /> {t('announcement')}
          </span>
        )}
        {state === 'failed' && <span className={styles.failed}>{t('failed')}</span>}
        {!cid && state !== 'failed' && <span className={styles.badge}>{t('pending')}</span>}
      </div>

      <h3 className={styles.title}>
        <Link to={postPath} className={styles.titleLink} {...prefetchPost}>
          {titleText}
        </Link>
      </h3>

      {(flair || nsfw || spoiler) && (
        <div className={styles.tags}>
          {nsfw && <span className={`${styles.badge} ${styles.nsfwBadge}`}>{t('nsfw')}</span>}
          {spoiler && <span className={styles.badge}>{t('spoiler')}</span>}
          {flair?.text && (
            <span className={styles.flair} style={{ backgroundColor: flair.backgroundColor, color: flair.textColor }}>
              {flair.text}
            </span>
          )}
        </div>
      )}

      {removed || deleted ? (
        <p className={styles.preview}>[{(removed ? t('removed') : t('deleted')).toLowerCase()}]</p>
      ) : (
        <>
          {previewText && <p className={`${styles.preview} ${obscuredLabel ? styles.previewObscured : ''}`}>{previewText}</p>}
          <div className={styles.raised}>
            <PostMedia
              mediaInfo={mediaInfo}
              link={link}
              linkWidth={linkWidth}
              linkHeight={linkHeight}
              obscuredLabel={obscuredLabel}
              onReveal={() => setIsRevealed(true)}
            />
          </div>
        </>
      )}

      <PostActions post={post} postPath={postPath} communityAddress={communityAddress} />
    </article>
  );
};

export default memo(ModernPostCard);
