import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Comment, useAuthorAddress, useComment, useCommunity, useEditedComment } from '@bitsocial/bitsocial-react-hooks';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityPath, getCommunityPostPath, getCommunityPostUrl } from '../../lib/utils/community-route-utils';
import { getCommentPostOptions, stripCommentPostOptionMarkers } from '../../lib/utils/fivechan-post-options';
import { formatScore, getPostTitleText, getReplyScore } from '../../lib/utils/post-utils';
import { formatLocalizedUTCTimestamp, getFormattedTimeAgo } from '../../lib/utils/time-utils';
import { stripTripcodeProof } from '../../lib/utils/tripcode-utils';
import Markdown from '../markdown';
import { ModernShareButton, ModernVoteButtons } from '../modern-actions';
import ModernCommentMenu from '../modern-comment-menu';
import ModernCommunityAvatar from '../modern-community-avatar';
import { modernStyles } from '../modern-layout';
import styles from './modern-reply-card.module.css';

interface ModernReplyCardProps {
  reply: Comment;
  /** A short label before the post title, such as the kind of inbox notification. */
  label?: ReactNode;
  /** Marks a notification the account has not read yet. */
  unread?: boolean;
}

/** A reply shown outside its thread, in a profile or the inbox: the post it answers, then the reply. */
const ModernReplyCard = ({ reply: loadedReply, label, unread }: ModernReplyCardProps) => {
  const { t, i18n } = useTranslation();
  const { editedComment } = useEditedComment({ comment: loadedReply });
  const reply: Comment = editedComment || loadedReply;
  const { author, cid, content, deleted, downvoteCount, index, number, postCid, quotedCids, removed, state, timestamp, upvoteCount } = reply;
  const communityAddress = getCommentCommunityAddress(reply);
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress), onlyIfCached: true } : undefined);
  const { shortAuthorAddress } = useAuthorAddress({ comment: reply });
  const displayName = stripTripcodeProof(author?.displayName)?.trim();

  const post = useComment({ commentCid: postCid });
  const postCommunityAddress = getCommentCommunityAddress(post) || communityAddress;
  const postTitle = post?.timestamp ? getPostTitleText(post.title, stripCommentPostOptionMarkers(post.content, post, postCommunityAddress)) : undefined;

  // A reply still publishing opens from the account's comment index.
  const replyPath = cid && communityAddress ? getCommunityPostPath(communityAddress, cid) : `/profile/${index}`;
  const postPath = postCid && postCommunityAddress ? getCommunityPostPath(postCommunityAddress, postCid) : undefined;
  const isRemovedOrDeleted = Boolean(removed || deleted);

  return (
    <article className={`${styles.card} ${unread ? styles.unread : ''}`}>
      <div className={styles.meta}>
        {communityAddress && (
          <Link to={getCommunityPath(communityAddress)} className={styles.community} title={communityAddress}>
            <ModernCommunityAvatar address={communityAddress} avatarUrl={community?.suggested?.avatarUrl} />
            <span className={styles.communityName}>s/{getDisplayAddress(community?.shortAddress || '') || getShortDisplayAddress(communityAddress)}</span>
          </Link>
        )}
        <span className={styles.dot} aria-hidden='true'>
          ·
        </span>
        <time dateTime={timestamp ? new Date(timestamp * 1000).toISOString() : undefined} title={formatLocalizedUTCTimestamp(timestamp, i18n.language)}>
          {getFormattedTimeAgo(timestamp)}
        </time>
        {state === 'failed' && <span className={styles.failed}>{t('failed')}</span>}
        {!cid && state !== 'failed' && <span className={styles.badge}>{t('pending')}</span>}
      </div>

      <p className={styles.parent}>
        {label && <span className={styles.label}>{label}</span>}
        {postPath ? (
          <Link to={postPath} className={styles.postTitle}>
            {postTitle || `${t('loading')}…`}
          </Link>
        ) : (
          postTitle && <span className={styles.postTitle}>{postTitle}</span>
        )}
      </p>

      <div className={styles.reply}>
        {author?.address && (
          <Link to={cid ? `/u/${author.address}/comments/${cid}` : `/profile/${index}`} className={styles.author} title={author.address}>
            {displayName ? `${displayName} ` : ''}u/{getDisplayAddress(shortAuthorAddress || author.shortAddress || '')}
          </Link>
        )}
        <div className={styles.content}>
          {isRemovedOrDeleted ? (
            <p className={styles.placeholder}>[{(removed ? t('removed') : t('deleted')).toLowerCase()}]</p>
          ) : (
            content && (
              <Markdown
                content={content}
                enableFivechanQuotes={typeof number === 'number'}
                postOptions={getCommentPostOptions(reply, communityAddress)}
                quotedCids={quotedCids}
              />
            )
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <ModernVoteButtons comment={reply} score={formatScore(getReplyScore(upvoteCount, downvoteCount))} variant='plain' />
        <Link to={`${replyPath}${cid ? '?context=3' : ''}`} className={styles.actionButton}>
          <span className={modernStyles.sentenceCase}>{t('context')}</span>
        </Link>
        <ModernShareButton className={styles.actionButton} iconSize={16} url={cid && communityAddress ? getCommunityPostUrl(communityAddress, cid) : undefined} />
        <ModernCommentMenu comment={reply} className={styles.actionButton} iconSize={16} />
      </div>
    </article>
  );
};

export default ModernReplyCard;
