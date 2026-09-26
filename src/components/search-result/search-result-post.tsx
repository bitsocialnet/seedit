import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import { getCommunityPostPath, getCommunityPath } from '../../lib/utils/community-route-utils';
import { getCommentMediaInfo, getHasThumbnail } from '../../lib/utils/media-utils';
import { getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getFormattedTimeAgo } from '../../lib/utils/time-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import Flair from '../flair';
import Thumbnail from '../thumbnail';
import HighlightedText from './highlighted-text';
import styles from './search-result.module.css';

interface SearchResultExcerptProps {
  content: string;
  terms: string[];
}

/**
 * A post body clipped to three faded lines with a more/less toggle. Like
 * old.reddit, an excerpt that already fits is measured once and shown whole,
 * without the fade or the toggle.
 */
const SearchResultExcerpt = ({ content, terms }: SearchResultExcerptProps) => {
  const { t } = useTranslation();
  const expandoRef = useRef<HTMLDivElement>(null);
  const [isClipped, setIsClipped] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Measured before paint, so a short excerpt never flashes its toggle.
  useLayoutEffect(() => {
    const expando = expandoRef.current;
    if (expando && expando.scrollHeight <= expando.clientHeight) setIsClipped(false);
  }, []);

  return (
    <>
      <div className={`${styles.expando} ${isClipped && !expanded ? styles.collapsedExpando : ''}`} ref={expandoRef}>
        <div className={styles.body}>
          <HighlightedText terms={terms} text={content} />
        </div>
      </div>
      {isClipped && (
        <button className={styles.expandoButton} onClick={() => setExpanded((current) => !current)} type='button'>
          {expanded ? t('search_excerpt_less') : t('search_excerpt_more')}
        </button>
      )}
    </>
  );
};

interface SearchResultPostProps {
  comment: Comment;
  terms: string[];
}

/**
 * One matched post or reply, laid out the way old.reddit's results page shows
 * a link: thumbnail, title, a meta line, a collapsed excerpt, and the linked
 * url for a link post.
 */
const SearchResultPost = ({ comment, terms }: SearchResultPostProps) => {
  const { t } = useTranslation();
  const { thumbnailDisplayOption } = useContentOptionsStore();

  const { cid, communityAddress, content, downvoteCount, flair, link, linkHeight, linkWidth, nsfw, replyCount, spoiler, timestamp, title, upvoteCount } = comment;
  const authorAddress = comment.author?.address;
  const authorName = comment.author?.displayName || comment.author?.shortAddress || authorAddress;
  const threadCid = comment.postCid || cid;
  const postPath = communityAddress && threadCid ? getCommunityPostPath(communityAddress, threadCid) : undefined;
  // The indexer always serves both counts, so a result never has an unknown score.
  const score = (upvoteCount ?? 0) - (downvoteCount ?? 0);
  const communityLabel = `s/${getShortDisplayAddress(communityAddress)}`;
  const isReply = Boolean(comment.parentCid);
  // A reply has no title of its own, so its excerpt is what identifies it.
  const heading = title || content || communityLabel;

  const commentMediaInfo = getCommentMediaInfo(comment);
  const hasMedia = getHasThumbnail(commentMediaInfo, link);
  // A post always gets the thumbnail column, with the feed's text or link
  // placeholder when it has no media; a matched reply only when it links media.
  const showsThumbnail = thumbnailDisplayOption === 'show' && Boolean(postPath) && (!isReply || hasMedia);

  return (
    <div className={`${styles.result} ${showsThumbnail ? styles.hasThumbnail : ''}`}>
      {showsThumbnail && (
        <div className={styles.thumbnail}>
          <Thumbnail
            cid={threadCid}
            commentMediaInfo={commentMediaInfo}
            communityAddress={communityAddress}
            isLink={!hasMedia && Boolean(link)}
            isNsfw={nsfw}
            isPdf={commentMediaInfo?.type === 'pdf'}
            isReply={false}
            isSpoiler={spoiler}
            isText={!hasMedia && !link}
            link={link}
            linkHeight={linkHeight}
            linkWidth={linkWidth}
          />
        </div>
      )}
      <div>
        <header className={styles.resultHeader}>
          {postPath ? (
            <Link className={styles.title} to={postPath}>
              <HighlightedText terms={terms} text={heading} />
            </Link>
          ) : (
            <span className={styles.title}>
              <HighlightedText terms={terms} text={heading} />
            </span>
          )}
          {flair && <Flair flair={flair} />}
        </header>
        <div className={styles.meta}>
          {nsfw && (
            <>
              <span className={`${styles.stamp} ${styles.nsfwStamp}`}>{t('nsfw')}</span>{' '}
            </>
          )}
          <span className={`${styles.icon} ${styles.scoreIcon}`} />
          <span className={styles.score}>
            {score.toLocaleString('en')} {score === 1 ? t('point') : t('points')}
          </span>{' '}
          {postPath && (
            <>
              <Link className={styles.comments} to={postPath}>
                {(replyCount ?? 0).toLocaleString('en')} {replyCount === 1 ? t('post_comment') : t('post_comments')}
              </Link>{' '}
            </>
          )}
          <span>
            {t('submitted')} {getFormattedTimeAgo(timestamp)}
          </span>{' '}
          {authorAddress && (
            <span>
              {t('post_by')} <Link to={`/u/${authorAddress}`}>{authorName}</Link>
            </span>
          )}{' '}
          {communityAddress && (
            <span>
              {t('post_to')} <Link to={getCommunityPath(communityAddress)}>{communityLabel}</Link>
            </span>
          )}
        </div>
        {title && content && <SearchResultExcerpt content={content} terms={terms} />}
        {link && (
          <div className={styles.footer}>
            <span className={`${styles.icon} ${styles.externalLinkIcon}`} />
            <a className={styles.footerLink} href={link} rel='noopener noreferrer' target='_blank'>
              {link}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResultPost;
