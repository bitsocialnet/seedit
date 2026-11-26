import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Comment, useAuthorAddress, useBlock, useCommunity, useEditedComment } from '@bitsocial/bitsocial-react-hooks';
import { useCommentMediaInfo } from '../../hooks/use-comment-media-info';
import useCommentTripcode from '../../hooks/use-comment-tripcode';
import usePostObscuring from '../../hooks/use-post-obscuring';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useReplies from '../../hooks/use-replies';
import useStateString from '../../hooks/use-state-string';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityPostPath, getCommunityPostUrl } from '../../lib/utils/community-route-utils';
import { getCommentPostOptions } from '../../lib/utils/fivechan-post-options';
import { formatScore, getReplyScore } from '../../lib/utils/post-utils';
import { formatLocalizedUTCTimestamp, getFormattedTimeAgo } from '../../lib/utils/time-utils';
import { stripTripcodeProof } from '../../lib/utils/tripcode-utils';
import Markdown from '../markdown';
import { ModernShareButton, ModernVoteButtons } from '../modern-actions';
import { CommentIcon, MinusIcon, PinIcon, PlusIcon } from '../modern-icons';
import { modernStyles } from '../modern-layout';
import { PostMedia } from '../modern-post-card';
import ModernReplyForm from '../modern-reply-form';
import styles from './modern-comment.module.css';

// Deeper replies open on their own page, so threads stay readable at phone widths.
const MAX_DEPTH = 8;

interface ModernCommentProps {
  reply: Comment;
  depth: number;
  /** Whether the thread accepts replies from this account; see getThreadPermissions. */
  canReply: boolean;
  /** Whether the thread accepts votes; locked posts take none. */
  canVote: boolean;
  /** The comment a link pointed at: highlighted and scrolled into view. */
  highlightCid?: string;
  /** The 5chan number of the comment this one sits under, so a quote of it can be dropped. */
  parentNumber?: number;
  /** The post's author, whose comments are marked as the submitter's. */
  submitterAddress?: string;
}

const ModernComment = ({ reply: loadedReply, depth, canReply, canVote, highlightCid, parentNumber, submitterAddress }: ModernCommentProps) => {
  const { t, i18n } = useTranslation();
  // A pending mod or author edit replaces what the thread has.
  const { state: editState, editedComment } = useEditedComment({ comment: loadedReply });
  const reply: Comment = editedComment || loadedReply;
  const {
    author,
    cid,
    content,
    deleted,
    downvoteCount,
    edit,
    flair,
    link,
    linkHeight,
    linkWidth,
    nsfw,
    number,
    pinned,
    postCid,
    quotedCids,
    reason,
    removed,
    spoiler,
    state,
    timestamp,
    upvoteCount,
  } = reply;
  const communityAddress = getCommentCommunityAddress(reply);
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress), onlyIfCached: true } : undefined);
  const authorRole: string | undefined = community?.roles?.[author?.address]?.role;
  const isSubmitter = Boolean(author?.address && author.address === submitterAddress);
  const { shortAuthorAddress } = useAuthorAddress({ comment: reply });
  const displayName = stripTripcodeProof(author?.displayName)?.trim();
  const trip = useCommentTripcode(reply);
  const stateString = useStateString(reply);
  const replies = useReplies(reply);
  const childrenCount: number = reply.replyCount || replies.length;

  const mediaInfo = useCommentMediaInfo(reply);
  // Media in an NSFW community starts covered, but only a comment marked NSFW gets the badge, as in the old interface.
  const { obscuredLabel, reveal } = usePostObscuring(reply);
  const isRemovedOrDeleted = Boolean(removed || deleted);

  // Hidden comments and removed or deleted comments without replies start collapsed.
  const { blocked, unblock } = useBlock({ cid });
  const shouldAutoCollapse = Boolean(blocked || (isRemovedOrDeleted && childrenCount === 0));
  const [collapsed, setCollapsed] = useState(shouldAutoCollapse);
  // Re-check whenever an input changes, so a comment hidden while expanded still collapses.
  const autoCollapseInputs = [blocked, isRemovedOrDeleted, childrenCount];
  const [prevAutoCollapseInputs, setPrevAutoCollapseInputs] = useState(autoCollapseInputs);
  if (autoCollapseInputs.some((value, index) => !Object.is(value, prevAutoCollapseInputs[index]))) {
    setPrevAutoCollapseInputs(autoCollapseInputs);
    if (shouldAutoCollapse) setCollapsed(true);
  }
  const toggleCollapsed = () => {
    if (blocked) unblock();
    setCollapsed(!collapsed);
  };

  const [isReplying, setIsReplying] = useState(false);
  const replyButtonRef = useRef<HTMLButtonElement>(null);
  // Focus goes back to the reply button when the form closes, instead of falling to the page.
  const closeReplyForm = useCallback(() => {
    setIsReplying(false);
    replyButtonRef.current?.focus();
  }, []);

  const isHighlighted = Boolean(cid && cid === highlightCid);
  const commentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isHighlighted) return;
    // Wait a frame for the thread above to lay out before scrolling to the linked comment.
    const timeout = setTimeout(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      commentRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timeout);
  }, [isHighlighted]);

  const markdown = content && (
    <Markdown
      content={content}
      enableFivechanQuotes={typeof number === 'number'}
      parentNumber={parentNumber}
      postOptions={getCommentPostOptions(reply, communityAddress)}
      quotedCids={quotedCids}
    />
  );
  const score = formatScore(getReplyScore(upvoteCount, downvoteCount));
  const authorPath = cid ? `/u/${author?.address}/comments/${cid}` : `/profile/${reply.index}`;
  const authorAddress = `u/${getDisplayAddress(shortAuthorAddress || author?.shortAddress || '')}`;

  return (
    <div ref={commentRef} className={`${styles.comment} ${isHighlighted ? styles.highlighted : ''}`}>
      <div className={styles.header}>
        <button type='button' className={styles.collapseButton} aria-expanded={!collapsed} aria-label={collapsed ? t('show') : t('hide')} onClick={toggleCollapsed}>
          {collapsed ? <PlusIcon size={14} /> : <MinusIcon size={14} />}
        </button>
        {isRemovedOrDeleted ? (
          <span className={styles.removedAuthor}>[{(removed ? t('removed') : t('deleted')).toLowerCase()}]</span>
        ) : (
          author?.address && (
            <Link to={authorPath} className={styles.author} title={author.address}>
              {displayName || trip ? (
                <>
                  <span className={styles.authorName}>
                    {displayName}
                    {trip && <span className={styles.trip}>{displayName ? ` ${trip}` : trip}</span>}
                  </span>
                  <span className={styles.authorAddress}>{authorAddress}</span>
                </>
              ) : (
                <span className={styles.authorName}>{authorAddress}</span>
              )}
            </Link>
          )
        )}
        {isSubmitter && !isRemovedOrDeleted && <span className={`${styles.badge} ${styles.submitter} ${modernStyles.sentenceCase}`}>{t('submitter')}</span>}
        {authorRole && !isRemovedOrDeleted && <span className={`${styles.badge} ${styles.role} ${modernStyles.sentenceCase}`}>{t(authorRole)}</span>}
        <span className={styles.dot} aria-hidden='true'>
          ·
        </span>
        <time dateTime={timestamp ? new Date(timestamp * 1000).toISOString() : undefined} title={formatLocalizedUTCTimestamp(timestamp, i18n.language)}>
          {getFormattedTimeAgo(timestamp)}
        </time>
        {edit?.timestamp && <span className={styles.edited}>{t('edited_timestamp', { timestamp: getFormattedTimeAgo(edit.timestamp) })}</span>}
        {pinned && (
          <span className={styles.pinned}>
            <PinIcon size={14} /> {t('stickied_comment')}
          </span>
        )}
        {state === 'failed' && <span className={styles.failed}>{t('failed')}</span>}
        {!cid && state !== 'failed' && <span className={styles.badge}>{t('pending')}</span>}
        {editState === 'failed' && <span className={styles.failed}>{t('failed_edit')}</span>}
        {editState === 'pending' && <span className={styles.badge}>{t('pending_edit')}</span>}
        {nsfw && <span className={`${styles.badge} ${styles.nsfw}`}>{t('nsfw')}</span>}
        {spoiler && <span className={styles.badge}>{t('spoiler')}</span>}
        {flair?.text && !collapsed && (
          <span className={styles.flair} style={{ backgroundColor: flair.backgroundColor, color: flair.textColor }}>
            {flair.text}
          </span>
        )}
        {collapsed && childrenCount > 0 && (
          <span className={styles.childrenCount}>({childrenCount === 1 ? t('child', { childrenCount }) : t('children', { childrenCount })})</span>
        )}
      </div>

      {!collapsed && (
        <div className={styles.body}>
          <div className={styles.content}>
            {isRemovedOrDeleted ? (
              <p className={styles.placeholder}>[{(removed ? t('removed') : t('deleted')).toLowerCase()}]</p>
            ) : (
              <>
                {content &&
                  (obscuredLabel && spoiler ? (
                    <div className={styles.obscured}>
                      {/* inert keeps links in the covered text out of the tab order until it is revealed. */}
                      <div className={styles.obscuredText} inert>
                        {markdown}
                      </div>
                      <button type='button' className={styles.revealButton} onClick={reveal}>
                        <span className={modernStyles.sentenceCase}>{obscuredLabel}</span>
                      </button>
                    </div>
                  ) : (
                    markdown
                  ))}
                <PostMedia mediaInfo={mediaInfo} link={link} linkWidth={linkWidth} linkHeight={linkHeight} obscuredLabel={obscuredLabel} onReveal={reveal} compact />
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
            {state === 'pending' && stateString && stateString !== 'Failed' && <p className={styles.stateString}>{stateString}</p>}
          </div>

          {/* Communities reject votes and replies under a removed or deleted comment, as the old interface reflects by hiding them. */}
          {!isRemovedOrDeleted && (
            <div className={styles.actions}>
              <ModernVoteButtons comment={reply} score={score} variant='plain' disabled={!canVote} />
              {canReply && (
                <button ref={replyButtonRef} type='button' className={styles.actionButton} disabled={!cid} aria-expanded={isReplying} onClick={() => setIsReplying(true)}>
                  <CommentIcon size={16} />
                  <span className={modernStyles.sentenceCase}>{t('reply_reply')}</span>
                </button>
              )}
              <ModernShareButton className={styles.actionButton} iconSize={16} url={cid && communityAddress ? getCommunityPostUrl(communityAddress, cid) : undefined} />
            </div>
          )}

          {isReplying && cid && communityAddress && (
            <div className={styles.replyForm}>
              <ModernReplyForm cid={cid} communityAddress={communityAddress} postCid={postCid} autoFocus onClose={closeReplyForm} submitLabel={t('reply_reply')} />
            </div>
          )}

          {replies.length > 0 &&
            (depth + 1 < MAX_DEPTH ? (
              <div className={styles.children}>
                {replies.map((child) => (
                  <ModernComment
                    // A reply that is still publishing has no cid yet, only its account comment index.
                    key={child.cid ?? `pending-reply-${child.index}`}
                    reply={child}
                    depth={depth + 1}
                    canReply={canReply}
                    canVote={canVote}
                    highlightCid={highlightCid}
                    parentNumber={number}
                    submitterAddress={submitterAddress}
                  />
                ))}
              </div>
            ) : (
              cid &&
              communityAddress && (
                <Link to={getCommunityPostPath(communityAddress, cid)} className={styles.continueThread}>
                  {t('continue_thread')} →
                </Link>
              )
            ))}
        </div>
      )}
    </div>
  );
};

export default ModernComment;
