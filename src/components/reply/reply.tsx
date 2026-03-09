import { Fragment, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Plebbit from '@plebbit/plebbit-js';
import {
  Comment,
  useAccountComment,
  useAuthorAddress,
  useAuthorAvatar,
  useBlock,
  useComment,
  useEditedComment,
  useSubplebbit,
} from '@bitsocialnet/bitsocial-react-hooks';
import { isInboxView, isPostContextView, isPostPageView } from '../../lib/utils/view-utils';
import { getHostname } from '../../lib/utils/url-utils';
import { formatScore, getReplyScore } from '../../lib/utils/post-utils';
import { flattenCommentsPages } from '@bitsocialnet/bitsocial-react-hooks/dist/lib/utils';
import { CommentMediaInfo, getHasThumbnail } from '../../lib/utils/media-utils';
import { formatLocalizedUTCTimestamp, getFormattedTimeAgo } from '../../lib/utils/time-utils';
import { useCommentMediaInfo } from '../../hooks/use-comment-media-info';
import useContentOptionsStore from '../../stores/use-content-options-store';
import useDownvote from '../../hooks/use-downvote';
import useReplies from '../../hooks/use-replies';
import useStateString from '../../hooks/use-state-string';
import useUpvote from '../../hooks/use-upvote';
import CommentEditForm from '../comment-edit-form';
import LoadingEllipsis from '../loading-ellipsis/';
import Markdown from '../markdown';
import CommentTools from '../post/comment-tools';
import ExpandButton from '../post/expand-button/';
import Expando from '../post/expando/';
import Flair from '../post/flair/';
import Label from '../post/label/';
import Thumbnail from '../post/thumbnail/';
import ReplyForm from '../reply-form';
import styles from './reply.module.css';
import _ from 'lodash';

interface ReplyAuthorProps {
  address: string;
  authorRole: string;
  cid: string;
  deleted: boolean;
  displayName: string;
  imageUrl: string | undefined;
  isAvatarDefined: boolean;
  removed: boolean;
  shortAuthorAddress: string | undefined;
  submitterAddress: string;
  subplebbitAddress: string;
  postCid: string;
  pinned: boolean;
}

const ReplyAuthor = ({
  address,
  authorRole,
  cid,
  deleted,
  displayName,
  imageUrl,
  isAvatarDefined,
  pinned,
  removed,
  shortAuthorAddress,
  submitterAddress,
  subplebbitAddress,
  postCid,
}: ReplyAuthorProps) => {
  const { t } = useTranslation();
  const hideAvatars = useContentOptionsStore((state) => state.hideAvatars);

  // TODO: implement comment.highlightRole once implemented in API
  const isAuthorAdmin = authorRole === 'admin';
  const isAuthorOwner = authorRole === 'owner';
  const isAuthorModerator = authorRole === 'moderator';
  const authorRoleInitial = (isAuthorOwner && 'O') || (isAuthorAdmin && 'A') || (isAuthorModerator && 'M') || '';
  const moderatorClass = `${isAuthorOwner ? styles.owner : isAuthorAdmin ? styles.admin : isAuthorModerator ? styles.moderator : ''}`;

  const shortDisplayName = displayName?.length > 20 ? displayName?.slice(0, 20) + '...' : displayName;
  const isAuthorSubmitter = address === submitterAddress;

  return (
    <>
      {removed || deleted ? (
        <span className={styles.removedUsername}>[{removed ? t('removed') : deleted ? t('deleted') : ''}]</span>
      ) : (
        <>
          {!hideAvatars && isAvatarDefined && (
            <span className={styles.authorAvatar}>
              <img src={imageUrl} alt='' />
            </span>
          )}
          {displayName && (
            <Link
              to={`/u/${address}/c/${cid}`}
              className={`${styles.author} ${pinned && moderatorClass} ${!moderatorClass && isAuthorSubmitter ? styles.submitter : ''}`}
            >
              {shortDisplayName}{' '}
            </Link>
          )}
          <Link to={`/u/${address}/c/${cid}`} className={`${styles.author} ${pinned && moderatorClass} ${!moderatorClass && isAuthorSubmitter ? styles.submitter : ''}`}>
            {displayName ? `u/${shortAuthorAddress}` : shortAuthorAddress}
          </Link>
          {/* TODO: implement comment.highlightRole once implemented in API */}
          {(authorRole || isAuthorSubmitter) && pinned && (
            <span className={styles.moderatorBrackets}>
              {' '}
              [
              {isAuthorSubmitter && (
                <Link to={`/s/${subplebbitAddress}/c/${postCid}`} className={styles.submitter} title={t('submitter')}>
                  S
                </Link>
              )}
              {isAuthorSubmitter && authorRole && ','}
              {authorRole && (
                <span className={moderatorClass} title={authorRole}>
                  {authorRoleInitial}
                </span>
              )}
              ]
            </span>
          )}
          {isAuthorSubmitter && !pinned && (
            <span className={styles.moderatorBrackets}>
              {' '}
              [
              <Link to={`/s/${subplebbitAddress}/c/${postCid}`} className={styles.submitter} title={t('submitter')}>
                S
              </Link>
              ]
            </span>
          )}
        </>
      )}
    </>
  );
};

interface ReplyMediaProps {
  commentMediaInfo: CommentMediaInfo;
  content: string;
  expanded: boolean;
  hasThumbnail: boolean;
  link: string;
  linkHeight: number;
  linkWidth: number;
  nsfw: boolean;
  spoiler: boolean;
  toggleExpanded: () => void;
}

const ReplyMedia = ({ commentMediaInfo, content, expanded, hasThumbnail, link, linkHeight, linkWidth, nsfw, spoiler, toggleExpanded }: ReplyMediaProps) => {
  const { type } = commentMediaInfo || {};
  return (
    <>
      {hasThumbnail && (
        <Thumbnail
          commentMediaInfo={commentMediaInfo}
          expanded={expanded}
          isLink={!hasThumbnail && link}
          isReply={true}
          isSpoiler={spoiler}
          isNsfw={nsfw}
          isText={!hasThumbnail && content?.trim().length > 0}
          link={link}
          linkHeight={linkHeight}
          linkWidth={linkWidth}
          toggleExpanded={toggleExpanded}
          isPdf={commentMediaInfo?.type === 'pdf'}
        />
      )}
      {type === 'iframe' ||
        (type === 'audio' && (
          <ExpandButton
            commentMediaInfo={commentMediaInfo}
            content={content}
            expanded={expanded}
            hasThumbnail={hasThumbnail}
            link={link}
            toggleExpanded={toggleExpanded}
          />
        ))}
      {link && (type === 'iframe' || type === 'webpage' || type === 'audio') && (
        <>
          <a href={link} target='_blank' rel='noopener noreferrer'>
            ({getHostname(link) || link})
          </a>
          <br />
          <br />
        </>
      )}
      {expanded && link && (
        <Expando
          commentMediaInfo={commentMediaInfo}
          content={content}
          expanded={expanded}
          link={link}
          showContent={false}
          toggleExpanded={toggleExpanded}
          isReply={true}
        />
      )}
    </>
  );
};

type ParentLinkProps = {
  address?: string;
  cid?: string;
  commentCid?: string;
  markedAsRead?: boolean;
  parentCid?: string;
  postCid?: string;
  shortAddress?: string;
  subplebbitAddress?: string;
  timestamp?: number;
};

const ParentLink = ({ postCid }: ParentLinkProps) => {
  const parentComment = useComment({ commentCid: postCid });
  const { author, cid, content, title, subplebbitAddress } = parentComment || {};
  const { t } = useTranslation();
  const postTitle = (title?.length > 300 ? title?.slice(0, 300) + '...' : title) || (content?.length > 300 ? content?.slice(0, 300) + '...' : content);

  return (
    <div className={styles.parent}>
      <Link to={`/s/${subplebbitAddress}/c/${cid}`} className={styles.parentLink}>
        {postTitle}{' '}
      </Link>
      {t('post_by')}{' '}
      <Link to={`/u/${author?.address}/c/${cid}`} className={styles.parentAuthor}>
        u/{author?.shortAddress}{' '}
      </Link>
      {t('via')}{' '}
      <Link to={`/s/${subplebbitAddress}`} className={styles.parentSubplebbit}>
        s/{subplebbitAddress}
      </Link>
    </div>
  );
};

const InboxParentLink = ({ commentCid }: ParentLinkProps) => {
  const { t } = useTranslation();
  const inboxComment = useComment({ commentCid, onlyIfCached: true });
  const { postCid, parentCid } = inboxComment || {};
  const parent = useComment({ commentCid: inboxComment?.postCid, onlyIfCached: true });
  const { cid, content, title, subplebbitAddress } = parent || {};
  const postTitle = (title?.length > 300 ? title?.slice(0, 300) + '...' : title) || (content?.length > 300 ? content?.slice(0, 300) + '...' : content);

  const isInboxCommentReply = postCid !== parentCid;
  const isInboxPostReply = postCid === parentCid;

  return (
    <div className={styles.inboxParentLinkWrapper}>
      <span className={styles.inboxParentLinkSubject}>{isInboxCommentReply ? t('comment_reply') : isInboxPostReply ? t('post_reply') : ''}</span>
      <Link to={`/s/${subplebbitAddress}/c/${cid}`} className={styles.inboxParentLink}>
        {postTitle}
      </Link>
    </div>
  );
};

const InboxParentComment = ({ parentCid }: { parentCid: string | undefined }) => {
  const { t } = useTranslation();
  const parentComment = useComment({ commentCid: parentCid });
  const { content, subplebbitAddress } = parentComment || {};
  return (
    <>
      <Expando content={content} expanded={true} showContent={true} />
      <Link className={styles.viewParentComment} to={`/s/${subplebbitAddress}/c/${parentCid}`}>
        {t('view_parent_comment')}
      </Link>
    </>
  );
};

const InboxShowParentButton = ({ parentCid }: { parentCid: string | undefined }) => {
  const { t } = useTranslation();
  const [showParent, setShowParent] = useState(false);

  return showParent ? (
    <InboxParentComment parentCid={parentCid} />
  ) : (
    <div className={styles.inboxParentInfoButton} onClick={() => setShowParent(true)}>
      {t('show_parent')}
    </div>
  );
};

const InboxParentInfo = ({ address, cid, markedAsRead, parentCid, postCid, shortAddress, subplebbitAddress, timestamp }: ParentLinkProps) => {
  const { t } = useTranslation();
  const shortSubplebbitAddress = subplebbitAddress ? (subplebbitAddress.includes('.') ? subplebbitAddress : Plebbit.getShortAddress({ address: subplebbitAddress })) : '';

  return (
    <>
      <div className={`${styles.inboxParentInfo} ${markedAsRead ? styles.inboxParentRead : styles.inboxParentUnread}`}>
        {t('from')}{' '}
        <Link to={`/u/${address}/c/${cid}`} className={styles.inboxParentAuthor}>
          u/{shortAddress}{' '}
        </Link>
        {t('via')}{' '}
        <Link to={`/s/${subplebbitAddress}`} className={styles.inboxParentSubplebbit}>
          s/{shortSubplebbitAddress}{' '}
        </Link>
        {t('sent')} {timestamp && getFormattedTimeAgo(timestamp)}
      </div>
      {parentCid !== postCid && <InboxShowParentButton parentCid={parentCid} />}
    </>
  );
};

interface ReplyProps {
  cidOfReplyWithContext?: string;
  depth?: number;
  index?: number;
  isNotification?: boolean;
  isSingleComment?: boolean;
  isSingleReply?: boolean;
  reply: Comment | undefined;
}

const Reply = ({ cidOfReplyWithContext, depth = 0, isSingleComment, isSingleReply, isNotification = false, reply = {} }: ReplyProps) => {
  // handle pending mod or author edit
  const { state: editState, editedComment } = useEditedComment({ comment: reply });
  if (editedComment) {
    reply = editedComment;
  }
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
    markedAsRead,
    pinned,
    parentCid,
    postCid,
    reason,
    removed,
    spoiler,
    nsfw,
    state,
    subplebbitAddress,
    timestamp,
    upvoteCount,
  } = reply || {};
  const subplebbit = useSubplebbit({ subplebbitAddress, onlyIfCached: true });

  const pendingReply = useAccountComment({ commentIndex: reply?.index });
  const parentOfPendingReply = useComment({ commentCid: pendingReply?.parentCid, onlyIfCached: true });

  const location = useLocation();
  const params = useParams();
  const isInInboxView = isInboxView(location.pathname);
  const isInPostContextView = isPostContextView(location.pathname, params, location.search);
  const isInPostPageView = isPostPageView(location.pathname, params);

  const authorRole = subplebbit?.roles?.[author?.address]?.role;
  const { shortAuthorAddress } = useAuthorAddress({ comment: reply });
  const { imageUrl } = useAuthorAvatar({ author });
  const replies = useReplies(reply);

  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded(!expanded);

  const [isReplying, setIsReplying] = useState(false);
  const showReplyForm = () => setIsReplying(true);
  const hideReplyForm = () => setIsReplying(false);

  const [isEditing, setIsEditing] = useState(false);
  const showCommentEditForm = () => setIsEditing(true);
  const hideCommentEditForm = () => setIsEditing(false);

  const commentMediaInfo = useCommentMediaInfo(reply);
  const hasThumbnail = getHasThumbnail(commentMediaInfo, link);

  const { t, i18n } = useTranslation();
  const { language } = i18n;
  const score = getReplyScore(upvoteCount, downvoteCount);
  const formattedScore = formatScore(score);
  const scoreString = score === 1 ? t('reply_score_singular') : t('reply_score_plural', { score: formattedScore });
  const stateString = useStateString(reply);
  const loadingString = stateString && <span className={styles.stateString}>{stateString !== 'Failed' ? <LoadingEllipsis string={stateString} /> : ''}</span>;

  const [upvoted, upvote] = useUpvote(reply);
  const [downvoted, downvote] = useDownvote(reply);

  const unnestedReplies = useMemo(() => flattenCommentsPages(reply.replies), [reply.replies]);
  const childrenCount = unnestedReplies.length;
  const childrenString = childrenCount === 1 ? t('child', { childrenCount }) : t('children', { childrenCount });

  const { blocked, unblock } = useBlock({ cid });
  const [collapsed, setCollapsed] = useState(blocked);
  useEffect(() => {
    if (blocked || (isInPostPageView && (deleted || removed) && childrenCount === 0)) {
      setCollapsed(true);
    }
  }, [blocked, isInPostPageView, deleted, removed, childrenCount]);
  const handleCollapseButton = () => {
    if (blocked) {
      unblock();
    }
    setCollapsed(!collapsed);
  };

  const stateLabel = (
    <span className={styles.stateLabel}>
      {state === 'failed' && <Label color='red' text={t('failed')} />}
      {cid === undefined && state !== 'failed' && <Label color='yellow' text={t('pending')} />}
      {editState === 'failed' && <Label color='red' text={t('failed_edit')} />}
      {editState === 'pending' && <Label color='yellow' text={t('pending_edit')} />}
      {spoiler && <Label color='black' text={t('spoiler')} />}
      {nsfw && <Label color='red' text={t('nsfw')} />}
    </span>
  );

  const post = useComment({ commentCid: postCid, onlyIfCached: true });

  // auto scroll to context reply
  const replyContextContentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (cidOfReplyWithContext === cid && isInPostContextView) {
      const scrollTimeout = setTimeout(() => {
        const replyElement = replyContextContentRef.current;
        if (replyElement) {
          replyElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);

      return () => clearTimeout(scrollTimeout);
    }
  }, [cidOfReplyWithContext, cid, isInPostContextView]);

  return (
    <div className={styles.reply} id={cidOfReplyWithContext === cid ? `reply-${cid}` : undefined}>
      {isSingleReply && !isInInboxView && <ParentLink postCid={cid ? postCid : parentOfPendingReply?.postCid} />}
      {isInInboxView && <InboxParentLink commentCid={cid} />}
      <div className={`${!isSingleReply ? styles.replyWrapper : styles.singleReplyWrapper} ${depth > 0 && styles.nested}`}>
        {!collapsed && (
          <div className={`${styles.midcol} ${removed || deleted ? styles.hiddenMidcol : ''}`}>
            <div className={`${styles.arrow} ${upvoted ? styles.upvoted : styles.arrowUp}`} onClick={() => cid && upvote()} />
            <div className={`${styles.arrow} ${downvoted ? styles.downvoted : styles.arrowDown}`} onClick={() => cid && downvote()} />
          </div>
        )}
        <div className={`${isNotification && !markedAsRead ? styles.unreadNotification : ''}`}>
          <div className={`${styles.entry} ${collapsed && styles.collapsedEntry}`}>
            {!isInInboxView && (
              <p className={styles.tagline}>
                <span className={styles.expand} onClick={handleCollapseButton}>
                  [{collapsed ? '+' : '–'}]
                </span>
                <ReplyAuthor
                  address={author?.address}
                  authorRole={authorRole}
                  cid={cid}
                  deleted={deleted}
                  displayName={author?.displayName}
                  imageUrl={imageUrl}
                  isAvatarDefined={!!author?.avatar}
                  removed={removed}
                  shortAuthorAddress={shortAuthorAddress}
                  submitterAddress={post?.author?.address}
                  subplebbitAddress={subplebbitAddress}
                  pinned={pinned}
                  postCid={postCid}
                />
                <span className={styles.score}>{scoreString}</span>{' '}
                <span className={styles.time}>
                  <span title={formatLocalizedUTCTimestamp(timestamp, language)}>{getFormattedTimeAgo(timestamp)}</span>
                  {edit && <span className={styles.timeEdited}> {t('edited_timestamp', { timestamp: getFormattedTimeAgo(edit.timestamp) })}</span>}
                </span>
                {pinned && <span className={styles.pinned}> - {t('stickied_comment')}</span>}
                {collapsed && (
                  <>
                    <span className={styles.children}> ({childrenString})</span>
                    {stateLabel}
                    {state === 'pending' && loadingString}
                  </>
                )}
                {!collapsed && stateLabel}
                {!collapsed && flair && (
                  <>
                    {' '}
                    <Flair flair={flair} />
                  </>
                )}
                {state === 'pending' && !collapsed && loadingString}
              </p>
            )}
            {isInInboxView && (
              <InboxParentInfo
                address={author?.address}
                cid={cid}
                markedAsRead={markedAsRead}
                parentCid={parentCid}
                postCid={postCid}
                shortAddress={author?.shortAddress}
                subplebbitAddress={subplebbitAddress}
                timestamp={timestamp}
              />
            )}
            {!collapsed && (
              <div
                ref={replyContextContentRef}
                className={`${styles.usertext} ${cid && commentMediaInfo && (isSingleComment || cidOfReplyWithContext === cid) ? styles.highlightMedia : ''}`}
              >
                {commentMediaInfo && !(removed || deleted) && (
                  <ReplyMedia
                    commentMediaInfo={commentMediaInfo}
                    content={content}
                    expanded={expanded}
                    hasThumbnail={hasThumbnail}
                    link={link}
                    linkHeight={linkHeight}
                    linkWidth={linkWidth}
                    nsfw={nsfw}
                    spoiler={spoiler}
                    toggleExpanded={toggleExpanded}
                  />
                )}
                {isEditing ? (
                  <CommentEditForm commentCid={cid} hideCommentEditForm={hideCommentEditForm} />
                ) : (
                  <div
                    className={`${styles.md} ${cid && (isSingleComment || cidOfReplyWithContext === cid) ? styles.highlightContent : ''} ${
                      removed || deleted ? styles.removedOrDeletedContent : ''
                    }`}
                  >
                    {content &&
                      (removed ? (
                        <span className={styles.removedContent}>[{t('removed')}]</span>
                      ) : deleted ? (
                        <span className={styles.deletedContent}>[{t('deleted')}]</span>
                      ) : (
                        <Markdown content={content} />
                      ))}
                    {reason && (
                      <p className={styles.modReason}>
                        {_.lowerCase(t('mod_edit_reason'))}: {reason}
                      </p>
                    )}
                    {edit?.reason && !(removed || deleted) && (
                      <p>
                        {t('edit')}: {edit.reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {!collapsed && (
            <div className={isInInboxView && markedAsRead ? styles.addMargin : ''}>
              <CommentTools
                author={author}
                cid={cid}
                deleted={deleted}
                failed={state === 'failed'}
                isReply={true}
                isSingleReply={isSingleReply}
                index={reply?.index}
                parentCid={parentCid}
                postCid={postCid}
                removed={removed}
                replyCount={replies.length}
                subplebbitAddress={subplebbitAddress}
                showCommentEditForm={showCommentEditForm}
                showReplyForm={showReplyForm}
                spoiler={spoiler}
              />
              {isReplying && <ReplyForm cid={cid} isReplyingToReply={true} hideReplyForm={hideReplyForm} subplebbitAddress={subplebbitAddress} postCid={postCid} />}
              {!isSingleReply &&
                replies.map((reply, index) => {
                  return (
                    <Fragment key={`${index}-${reply.cid}`}>
                      {!depth || depth < 9 ? (
                        <Reply
                          key={`${index}${reply.cid}`}
                          reply={reply}
                          depth={(depth || 0) + 1}
                          cidOfReplyWithContext={isInPostContextView ? params?.commentCid : undefined}
                        />
                      ) : (
                        <div className={styles.continueThisThread}>
                          <Link to={`/s/${subplebbitAddress}/c/${cid}`}>{t('continue_thread')}</Link>
                        </div>
                      )}
                    </Fragment>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reply;
