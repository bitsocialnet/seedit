import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Comment, useAuthorAddress, useBlock, useComment, useEditedComment, useCommunity, useSubscribe } from '@bitsocial/bitsocial-react-hooks';
import { getHasThumbnail } from '../../lib/utils/media-utils';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getPostScore, formatScore } from '../../lib/utils/post-utils';
import { getFormattedTimeAgo, formatLocalizedUTCTimestamp } from '../../lib/utils/time-utils';
import { getHostname } from '../../lib/utils/url-utils';
import { isAllView, isAuthorView, isPendingPostView, isPostPageView, isProfileHiddenView, isProfileView, isCommunityView } from '../../lib/utils/view-utils';
import { usePinnedPostsStore } from '../../stores/use-pinned-posts-store';
import { useCommentMediaInfo } from '../../hooks/use-comment-media-info';
import useDownvote from '../../hooks/use-downvote';
import useIsMobile from '../../hooks/use-is-mobile';
import { useIsNsfwCommunity } from '../../hooks/use-is-nsfw-community';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useUpvote from '../../hooks/use-upvote';
import useWindowWidth from '../../hooks/use-window-width';
import CommentEditForm from '../comment-edit-form';
import ExpandButton from '../expand-button';
import Expando from '../expando';
import Flair from '../flair';
import CommentTools from '../comment-tools';
import Thumbnail from '../thumbnail';
import CrosspostPreview from '../crosspost-preview';
import styles from './post.module.css';
import lowerCase from 'lodash/lowerCase';
import useContentOptionsStore from '../../stores/use-content-options-store';
import React from 'react';
import { getCommunityPath, getCommunityPostPath } from '../../lib/utils/community-route-utils';

interface PostAuthorProps {
  authorAddress: string;
  authorRole: string;
  cid: string;
  displayName: string;
  index?: number;
  pinned?: boolean;
  shortAddress: string;
  shortAuthorAddress: string | undefined;
  authorAddressChanged: boolean;
}

const PostAuthor = ({ authorAddress, authorRole, cid, displayName, index, pinned, shortAddress, shortAuthorAddress, authorAddressChanged }: PostAuthorProps) => {
  // TODO: implement comment.highlightRole once implemented in API
  const isAuthorOwner = authorRole === 'owner';
  const isAuthorAdmin = authorRole === 'admin';
  const isAuthorModerator = authorRole === 'moderator';
  const moderatorClass = `${isAuthorOwner ? styles.owner : isAuthorAdmin ? styles.admin : isAuthorModerator ? styles.moderator : ''}`;
  const authorRoleInitial = (isAuthorOwner && 'O') || (isAuthorAdmin && 'A') || (isAuthorModerator && 'M') || '';

  const shortDisplayName = displayName?.trim().length > 20 ? displayName?.trim().slice(0, 20).trim() + '...' : displayName?.trim();

  return (
    <>
      <Link to={cid ? `/u/${authorAddress}/comments/${cid}` : `/profile/${index}`} className={`${styles.author} ${pinned && moderatorClass}`}>
        {displayName && (
          <>
            {' '}
            <span className={`${styles.displayName} ${pinned && moderatorClass}`}>{shortDisplayName}</span>
          </>
        )}{' '}
        <span className={`${styles.authorAddressWrapper} ${pinned && moderatorClass}`}>
          <span className={styles.authorAddressHidden}>u/{getDisplayAddress(shortAddress || shortAuthorAddress || '')}</span>
          <span className={`${styles.authorAddressVisible} ${authorAddressChanged && styles.authorAddressChanged}`}>u/{getDisplayAddress(shortAuthorAddress || '')}</span>
        </span>
      </Link>
      {/* TODO: implement comment.highlightRole once implemented in API */}
      {authorRole && pinned && (
        <span>
          {' '}
          [
          <span className={moderatorClass} title={authorRole}>
            {authorRoleInitial}
          </span>
          ]
        </span>
      )}
    </>
  );
};

interface PostProps {
  index?: number;
  post: Comment | undefined;
}

const EMPTY_POST: Comment = {};

const Post = ({ index, post = EMPTY_POST }: PostProps) => {
  // handle single comment thread
  const op = useComment({ commentCid: post?.parentCid ? post?.postCid : '', onlyIfCached: true });

  if (post?.parentCid) {
    post = op;
  }
  // handle pending mod or author edit
  const { state: editState, editedComment } = useEditedComment({ comment: post });
  if (editedComment) {
    post = editedComment;
  }
  const {
    author,
    cid,
    content,
    crosspost,
    deleted,
    downvoteCount,
    edit,
    flair,
    link,
    linkHeight,
    linkWidth,
    number,
    pinned,
    quotedCids,
    reason,
    removed,
    replyCount,
    spoiler,
    state,
    timestamp,
    title,
    upvoteCount,
  } = post || {};
  const communityAddress = getCommentCommunityAddress(post);

  // Check if the community is NSFW based on its tags
  const isNsfwCommunity = useIsNsfwCommunity(communityAddress || '');
  const nsfw = post?.nsfw || isNsfwCommunity;

  const { displayName, shortAddress } = author || {};
  const { shortAuthorAddress, authorAddressChanged } = useAuthorAddress({ comment: post });

  const { t, i18n } = useTranslation();
  const { language } = i18n;
  const postDate = formatLocalizedUTCTimestamp(timestamp, language);
  const params = useParams();
  const location = useLocation();
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress), onlyIfCached: true } : undefined);
  const communityDisplayAddress = getDisplayAddress(community?.shortAddress || '') || (communityAddress ? getShortDisplayAddress(communityAddress) : '');

  const authorRole = community?.roles?.[post.author?.address]?.role;

  const isInAllView = isAllView(location.pathname);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInProfileView = isProfileView(location.pathname);
  const isInAuthorView = isAuthorView(location.pathname);
  const isInProfileHiddenView = isProfileHiddenView(location.pathname);
  const isInCommunityView = isCommunityView(location.pathname, params);

  const commentMediaInfo = useCommentMediaInfo(post);

  const { mediaPreviewOption, thumbnailDisplayOption } = useContentOptionsStore();

  const [isExpanded, setIsExpanded] = useState((isInPostPageView || isInPendingPostView) && mediaPreviewOption === 'autoExpandAll');
  const toggleExpanded = () => setIsExpanded((expanded) => !expanded);

  const [isEditing, setIsEditing] = useState(false);
  const showCommentEditForm = () => setIsEditing(true);
  const hideCommentEditForm = () => setIsEditing(false);

  const [upvoted, upvote] = useUpvote(post);
  const [downvoted, downvote] = useDownvote(post);
  const postScore = getPostScore(upvoteCount, downvoteCount, state);
  const postTitle =
    (title?.length > 300 ? title?.slice(0, 300) + '...' : title) ||
    (content?.length > 300 ? content?.slice(0, 300) + '...' : content)?.replace('&nbsp;', ' ')?.replace('>', '')?.replace('<', '')?.trim();

  // Ensure we have a meaningful title - if it's only whitespace/newlines, treat as empty
  const cleanedTitle = postTitle?.trim();
  const finalTitle = cleanedTitle || '-';

  const hasThumbnail = getHasThumbnail(commentMediaInfo, link);
  const hostname = getHostname(link);
  const linkClass = `${isInPostPageView ? (link ? styles.externalLink : styles.internalLink) : styles.link} ${pinned ? styles.pinnedLink : ''}`;
  const canExpandPost =
    Boolean(crosspost) ||
    Boolean(
      (commentMediaInfo?.type !== 'webpage' || (commentMediaInfo?.type === 'webpage' && content?.trim().length > 0)) &&
      !(isInPostPageView && !link && content?.trim().length > 0),
    );

  const { blocked, unblock } = useBlock({ cid });

  const [hasClickedSubscribe, setHasClickedSubscribe] = useState(false);
  const { subscribe, subscribed } = useSubscribe({ communityAddress });

  // show gray dotted border around last clicked post
  const isLastClicked = sessionStorage.getItem('lastClickedPost') === cid && !isInPostPageView;
  const handlePostClick = () => {
    if (cid) {
      if (sessionStorage.getItem('lastClickedPost') === cid) {
        sessionStorage.removeItem('lastClickedPost');
      } else {
        sessionStorage.setItem('lastClickedPost', cid);
      }
    }
  };

  const isMobile = useIsMobile();
  const windowWidth = useWindowWidth();
  const pinnedPostsCount = usePinnedPostsStore((state) => state.pinnedPostsCount);
  let rank = (index ?? 0) + 1;
  if (isInCommunityView) {
    rank = rank - pinnedPostsCount;
  }

  return (
    <div className={styles.content} key={index}>
      <div className={isLastClicked ? styles.lastClicked : ''}>
        <div className={`${styles.hiddenPost} ${blocked && !isInProfileHiddenView ? styles.visible : styles.hidden}`}>
          <div className={styles.hiddenPostText}>{t('post_hidden').charAt(0).toUpperCase() + t('post_hidden').slice(1)}</div>
          <div className={styles.undoHiddenPost} onClick={unblock}>
            {t('undo')}
          </div>
        </div>
        <div className={`${styles.container} ${blocked && !isInProfileHiddenView ? styles.hidden : styles.visible}`}>
          <div className={styles.row}>
            {!isMobile && !isInProfileView && !isInAuthorView && !isInPostPageView && <div className={styles.rank}>{pinned ? undefined : rank}</div>}
            <div className={styles.leftcol}>
              <div className={styles.midcol}>
                <div className={styles.arrowWrapper}>
                  <div className={`${styles.arrowCommon} ${upvoted ? styles.upvoted : styles.arrowUp}`} onClick={() => cid && upvote()} />
                </div>
                <div className={styles.score}>{formatScore(postScore)}</div>
                <div className={styles.arrowWrapper}>
                  <div className={`${styles.arrowCommon} ${downvoted ? styles.downvoted : styles.arrowDown}`} onClick={() => cid && downvote()} />
                </div>
              </div>
              {thumbnailDisplayOption === 'show' && (
                <Thumbnail
                  cid={cid}
                  commentMediaInfo={commentMediaInfo}
                  isReply={false}
                  isLink={!hasThumbnail && link}
                  isNsfw={nsfw}
                  isSpoiler={spoiler}
                  isText={!hasThumbnail && !link}
                  link={link}
                  linkHeight={linkHeight}
                  linkWidth={linkWidth}
                  communityAddress={communityAddress}
                  isPdf={commentMediaInfo?.type === 'pdf'}
                />
              )}
            </div>
            <div className={styles.entry}>
              <div className={styles.topMatter}>
                <p className={styles.title}>
                  {isInPostPageView && link ? (
                    <a href={link} className={linkClass} target='_blank' rel='noopener noreferrer' onClick={handlePostClick}>
                      {finalTitle}
                    </a>
                  ) : (
                    <Link
                      className={linkClass}
                      to={cid && communityAddress ? getCommunityPostPath(communityAddress, cid) : `/profile/${post?.index}`}
                      onClick={handlePostClick}
                    >
                      {finalTitle}
                    </Link>
                  )}
                  {flair && (
                    <>
                      {' '}
                      <Flair flair={flair} />
                    </>
                  )}{' '}
                  <span className={styles.domain}>
                    (
                    {hostname ? (
                      <Link to={`/domain/${hostname}`}>{hostname.length > 25 ? hostname.slice(0, 25) + '...' : hostname}</Link>
                    ) : (
                      <Link to={communityAddress ? getCommunityPath(communityAddress) : ''}>self.{communityDisplayAddress}</Link>
                    )}
                    )
                  </span>
                  {crosspost && <span className={`crosspost-badge ${styles.crosspostBadge}`} title={t('crosspost')} aria-label={t('crosspost')} />}
                </p>
                {canExpandPost && (
                  <ExpandButton
                    commentMediaInfo={commentMediaInfo}
                    content={content}
                    crosspost={Boolean(crosspost)}
                    expanded={isExpanded}
                    hasThumbnail={hasThumbnail}
                    link={link}
                    toggleExpanded={toggleExpanded}
                  />
                )}
                <div className={styles.tagline}>
                  {t('submitted')} <span title={postDate}>{getFormattedTimeAgo(timestamp)}</span>{' '}
                  {edit && isInPostPageView && <span className={styles.timeEdit}>{t('last_edited', { timestamp: getFormattedTimeAgo(edit.timestamp) })}</span>}{' '}
                  {t('post_by')}
                  <PostAuthor
                    authorAddress={author?.address}
                    authorRole={authorRole}
                    cid={cid}
                    displayName={displayName}
                    index={post?.index}
                    pinned={pinned}
                    shortAddress={shortAddress}
                    shortAuthorAddress={shortAuthorAddress}
                    authorAddressChanged={authorAddressChanged}
                  />
                  {!isInCommunityView && (
                    <>
                       {t('post_to')}
                      <span className={styles.subscribeHoverGroup}>
                        {isInAllView && (!subscribed || (subscribed && hasClickedSubscribe)) && (
                          <span className={styles.subscribeButtonWrapper}>
                            <button
                              className={`${styles.subscribeButton} ${subscribed ? styles.buttonSubscribed : styles.buttonSubscribe}`}
                              onClick={() => {
                                subscribe();
                                setHasClickedSubscribe(true);
                              }}
                            />
                          </span>
                        )}
                        <Link
                          className={`${styles.community} ${subscribed && hasClickedSubscribe ? styles.greenCommunityAddress : ''}`}
                          to={communityAddress ? getCommunityPath(communityAddress) : ''}
                        >
                          s/{communityDisplayAddress}
                        </Link>
                      </span>
                    </>
                  )}
                  {pinned && <span className={styles.announcement}> - {t('announcement')}</span>}
                </div>
                <CommentTools
                  author={author}
                  cid={cid}
                  comment={post}
                  deleted={deleted}
                  failed={state === 'failed'}
                  editState={editState}
                  index={post?.index}
                  nsfw={nsfw}
                  removed={removed}
                  replyCount={replyCount}
                  showCommentEditForm={showCommentEditForm}
                  spoiler={spoiler}
                  communityAddress={communityAddress || ''}
                />
                {crosspost && !deleted && !removed && isExpanded && <CrosspostPreview crosspost={crosspost} />}
              </div>
              {!(windowWidth < 770) && !(!content && !link) && (
                <>
                  {isEditing ? (
                    <CommentEditForm commentCid={cid} hideCommentEditForm={hideCommentEditForm} />
                  ) : (
                    <Expando
                      authorEditReason={edit?.reason}
                      commentMediaInfo={commentMediaInfo}
                      content={removed ? `[${lowerCase(t('removed'))}]` : deleted ? `[${lowerCase(t('deleted'))}]` : content}
                      expanded={isExpanded}
                      link={link}
                      modEditReason={reason}
                      nsfw={nsfw}
                      number={number}
                      quotedCids={quotedCids}
                      deleted={deleted}
                      removed={removed}
                      showContent={true}
                      spoiler={spoiler && (content || link)}
                    />
                  )}
                </>
              )}
            </div>
          </div>
          {windowWidth < 770 && !(!content && !link) && (
            <>
              {isEditing ? (
                <CommentEditForm commentCid={cid} hideCommentEditForm={hideCommentEditForm} />
              ) : (
                <Expando
                  authorEditReason={edit?.reason}
                  commentMediaInfo={commentMediaInfo}
                  content={removed ? `[${lowerCase(t('removed'))}]` : deleted ? `[${lowerCase(t('deleted'))}]` : content}
                  expanded={isExpanded}
                  link={link}
                  modEditReason={reason}
                  nsfw={nsfw}
                  number={number}
                  quotedCids={quotedCids}
                  deleted={deleted}
                  removed={removed}
                  showContent={true}
                  spoiler={spoiler && (content || link)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Keep the profiling identity stable when production bundling renames Post.
if (import.meta.env.DEV || import.meta.env.MODE === 'profiling') Post.displayName = 'FeedPost';

export default React.memo(Post);
