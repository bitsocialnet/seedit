import { Crosspost, useCrosspost } from '@bitsocial/bitsocial-react-hooks';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityPath, getCommunityPostPath } from '../../lib/utils/community-route-utils';
import { getCommentMediaInfo } from '../../lib/utils/media-utils';
import { formatScore, getPostScore } from '../../lib/utils/post-utils';
import { formatLocalizedUTCTimestamp, getFormattedTimeAgo } from '../../lib/utils/time-utils';
import Markdown from '../markdown';
import Embed from '../embed';
import styles from './crosspost-preview.module.css';

interface CrosspostPreviewProps {
  crosspost: Crosspost;
}

const CrosspostPreview = ({ crosspost }: CrosspostPreviewProps) => {
  const { t, i18n } = useTranslation();
  const source = useCrosspost({ crosspost });
  const { author, cid, content, downvoteCount, isCommunityVerified, link, nsfw, replyCount, spoiler, state, timestamp, title, upvoteCount } = source;
  const communityAddress = isCommunityVerified ? getCommentCommunityAddress(source) : undefined;
  const sourcePath = communityAddress && cid ? getCommunityPostPath(communityAddress, cid) : undefined;
  const authorAddress = author?.address;
  const authorLabel = author?.displayName || getDisplayAddress(author?.shortAddress || getShortDisplayAddress(authorAddress) || authorAddress);
  const communityLabel = communityAddress ? getDisplayAddress(getShortDisplayAddress(communityAddress)) : undefined;
  const trimmedContent = content?.trim();
  const excerpt = trimmedContent && trimmedContent.length > 280 ? `${trimmedContent.slice(0, 280).trim()}…` : trimmedContent;
  const displayTitle = title?.trim() || excerpt || getShortDisplayAddress(cid || crosspost.cid) || cid || crosspost.cid;
  const mediaInfo = getCommentMediaInfo(source);
  const [failedMediaUrl, setFailedMediaUrl] = useState<string>();
  const mediaFailed = failedMediaUrl === mediaInfo?.url;
  const sensitive = Boolean(nsfw || spoiler);
  const validReplyCount = Number.isFinite(replyCount) ? replyCount : 0;
  const postScore = getPostScore(upvoteCount, downvoteCount, state);
  const pointLabel = postScore === 1 ? t('point') : t('points');
  const commentLabel = validReplyCount === 1 ? t('post_comment') : t('post_comments');
  const postDate = formatLocalizedUTCTimestamp(timestamp, i18n.language);
  const authorPath = authorAddress && cid ? `/u/${authorAddress}/comments/${cid}` : undefined;

  let mediaPreview: ReactNode;
  if (!sensitive && !mediaFailed && link && mediaInfo) {
    if (mediaInfo.type === 'image' || mediaInfo.type === 'gif') {
      mediaPreview = <img src={mediaInfo.url} alt='' onError={() => setFailedMediaUrl(mediaInfo.url)} />;
    } else if (mediaInfo.type === 'video') {
      mediaPreview = <video src={`${mediaInfo.url}#t=0.001`} controls preload='metadata' onError={() => setFailedMediaUrl(mediaInfo.url)} />;
    } else if (mediaInfo.type === 'audio') {
      mediaPreview = <audio src={mediaInfo.url} controls preload='metadata' onError={() => setFailedMediaUrl(mediaInfo.url)} />;
    } else if (mediaInfo.type === 'iframe' || mediaInfo.type === 'pdf') {
      mediaPreview = (
        <div className={styles.embedPreview}>
          <Embed url={mediaInfo.url} />
        </div>
      );
    }
  }

  return (
    <section className={styles.preview} aria-label={t('crosspost')}>
      <div className={styles.header}>
        {sourcePath && <Link className={styles.contentLink} to={sourcePath} aria-label={displayTitle} />}
        <div className={styles.textContent}>
          <p className={styles.title}>
            {sourcePath ? (
              <Link className={styles.titleLink} to={sourcePath}>
                {displayTitle}
              </Link>
            ) : (
              displayTitle
            )}
          </p>
          <div className={styles.tagline}>
            <span className={styles.score}>
              {formatScore(postScore)} {pointLabel}
            </span>
            <span className={styles.dot}>•</span>
            {sourcePath ? (
              <Link className={styles.comments} to={sourcePath}>
                {validReplyCount} {commentLabel}
              </Link>
            ) : (
              <span className={styles.comments}>
                {validReplyCount} {commentLabel}
              </span>
            )}
            <span className={styles.dot}>•</span>
            {t('submitted')} <span title={postDate}>{getFormattedTimeAgo(timestamp)}</span>
            {authorLabel && (
              <>
                {' '}
                {t('post_by')}{' '}
                {authorPath ? (
                  <Link className={styles.author} to={authorPath}>
                    {authorLabel}
                  </Link>
                ) : (
                  <span className={styles.author}>{authorLabel}</span>
                )}
              </>
            )}
            {communityAddress && communityLabel && (
              <>
                {' '}
                {t('post_to')} <Link to={getCommunityPath(communityAddress)}>s/{communityLabel}</Link>
              </>
            )}
          </div>
        </div>
      </div>
      {(mediaPreview || trimmedContent) && (
        <div className={styles.previewContent}>
          {mediaPreview && <div className={styles.mediaPreview}>{mediaPreview}</div>}
          {trimmedContent && (
            <>
              <hr className={styles.selfDivider} />
              <div className={styles.usertext}>
                <Markdown content={trimmedContent} />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default CrosspostPreview;
