import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Comment, useAuthorAddress, useBlock, useComment, useEditedComment, useSubplebbit, useSubscribe } from '@bitsocialnet/bitsocial-react-hooks';
import Plebbit from '@plebbit/plebbit-js';
import { getHasThumbnail } from '../../lib/utils/media-utils';
import { getPostScore, formatScore } from '../../lib/utils/post-utils';
import { getFormattedTimeAgo, formatLocalizedUTCTimestamp } from '../../lib/utils/time-utils';
import { getHostname } from '../../lib/utils/url-utils';
import { isAllView, isAuthorView, isPendingPostView, isPostPageView, isProfileHiddenView, isProfileView, isSubplebbitView } from '../../lib/utils/view-utils';
import { highlightMatchedText } from '../../lib/utils/pattern-utils';
import { usePinnedPostsStore } from '../../stores/use-pinned-posts-store';
import { useCommentMediaInfo } from '../../hooks/use-comment-media-info';
import useDownvote from '../../hooks/use-downvote';
import useIsMobile from '../../hooks/use-is-mobile';
import { useIsNsfwSubplebbit } from '../../hooks/use-is-nsfw-subplebbit';
import useUpvote from '../../hooks/use-upvote';
import useWindowWidth from '../../hooks/use-window-width';
import CommentEditForm from '../comment-edit-form';
import ExpandButton from './expand-button';
import Expando from './expando';
import Flair from './flair';
import CommentTools from './comment-tools';
import Thumbnail from './thumbnail';
import styles from './post.module.css';
import _ from 'lodash';
import useContentOptionsStore from '../../stores/use-content-options-store';
import React from 'react';

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
      <Link to={cid ? `/u/${authorAddress}/c/${cid}` : `/profile/${index}`} className={`${styles.author} ${pinned && moderatorClass}`}>
        {displayName && (
          <>
            {' '}
            <span className={`${styles.displayName} ${pinned && moderatorClass}`}>{shortDisplayName}</span>
          </>
        )}{' '}
        <span className={`${styles.authorAddressWrapper} ${pinned && moderatorClass}`}>
          <span className={styles.authorAddressHidden}>u/{shortAddress || shortAuthorAddress}</span>
          <span className={`${styles.authorAddressVisible} ${authorAddressChanged && styles.authorAddressChanged}`}>u/{shortAuthorAddress}</span>
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

const Post = ({ index, post = {} }: PostProps) => {
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
    deleted,
    downvoteCount,
    edit,
    flair,
    link,
    linkHeight,
    linkWidth,
    pinned,
    reason,
    removed,
    replyCount,
    spoiler,
    state,
    subplebbitAddress,
    timestamp,
    title,
    upvoteCount,
  } = post || {};

  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  // Check if the subplebbit is NSFW based on its tags
  const isNsfwSubplebbit = useIsNsfwSubplebbit(subplebbitAddress);
  const nsfw = post?.nsfw || isNsfwSubplebbit;

  const { displayName, shortAddress } = author || {};
  const { shortAuthorAddress, authorAddressChanged } = useAuthorAddress({ comment: post });

  const { t, i18n } = useTranslation();
  const { language } = i18n;
  const postDate = formatLocalizedUTCTimestamp(timestamp, language);
  const params = useParams();
  const location = useLocation();
  const subplebbit = useSubplebbit({ subplebbitAddress, onlyIfCached: true });

  const authorRole = subplebbit?.roles?.[post.author?.address]?.role;

  const isInAllView = isAllView(location.pathname);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInProfileView = isProfileView(location.pathname);
  const isInAuthorView = isAuthorView(location.pathname);
  const isInProfileHiddenView = isProfileHiddenView(location.pathname);
  const isInSubplebbitView = isSubplebbitView(location.pathname, params);

  const commentMediaInfo = useCommentMediaInfo(post);

  const { mediaPreviewOption, thumbnailDisplayOption } = useContentOptionsStore();

  const [isExpanded, setIsExpanded] = useState((isInPostPageView || isInPendingPostView) && mediaPreviewOption === 'autoExpandAll');
  const toggleExpanded = () => setIsExpanded(!isExpanded);

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

  const displayedTitle = searchQuery ? highlightMatchedText(finalTitle, searchQuery) : finalTitle;

  const hasThumbnail = getHasThumbnail(commentMediaInfo, link);
  const hostname = getHostname(link);
  const linkClass = `${isInPostPageView ? (link ? styles.externalLink : styles.internalLink) : styles.link} ${pinned ? styles.pinnedLink : ''}`;

  const { blocked, unblock } = useBlock({ cid });

  const [hasClickedSubscribe, setHasClickedSubscribe] = useState(false);
  const { subscribe, subscribed } = useSubscribe({ subplebbitAddress });

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
  if (isInSubplebbitView) {
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
                  subplebbitAddress={subplebbitAddress}
                  isPdf={commentMediaInfo?.type === 'pdf'}
                />
              )}
            </div>
            <div className={styles.entry}>
              <div className={styles.topMatter}>
                <p className={styles.title}>
                  {isInPostPageView && link ? (
                    <a href={link} className={linkClass} target='_blank' rel='noopener noreferrer' onClick={handlePostClick}>
                      {displayedTitle}
                    </a>
                  ) : (
                    <Link className={linkClass} to={cid ? `/s/${subplebbitAddress}/c/${cid}` : `/profile/${post?.index}`} onClick={handlePostClick}>
                      {displayedTitle}
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
                      <Link to={`/s/${subplebbitAddress}`}>
                        self.{subplebbit?.shortAddress || (subplebbitAddress && Plebbit.getShortAddress({ address: subplebbitAddress }))}
                      </Link>
                    )}
                    )
                  </span>
                </p>
                {(!(commentMediaInfo?.type === 'webpage') || (commentMediaInfo?.type === 'webpage' && content?.trim().length > 0)) &&
                  !(isInPostPageView && !link && content?.trim().length > 0) && (
                    <ExpandButton
                      commentMediaInfo={commentMediaInfo}
                      content={content}
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
                  {!isInSubplebbitView && (
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
                        <Link className={`${styles.subplebbit} ${subscribed && hasClickedSubscribe ? styles.greenSubplebbitAddress : ''}`} to={`/s/${subplebbitAddress}`}>
                          s/{subplebbit?.shortAddress || (subplebbitAddress && Plebbit.getShortAddress({ address: subplebbitAddress }))}
                        </Link>
                      </span>
                    </>
                  )}
                  {pinned && <span className={styles.announcement}> - {t('announcement')}</span>}
                </div>
                <CommentTools
                  author={author}
                  cid={cid}
                  deleted={deleted}
                  failed={state === 'failed'}
                  editState={editState}
                  index={post?.index}
                  nsfw={nsfw}
                  removed={removed}
                  replyCount={replyCount}
                  showCommentEditForm={showCommentEditForm}
                  spoiler={spoiler}
                  subplebbitAddress={subplebbitAddress}
                />
              </div>
              {!(windowWidth < 770) && !(!content && !link) && (
                <>
                  {isEditing ? (
                    <CommentEditForm commentCid={cid} hideCommentEditForm={hideCommentEditForm} />
                  ) : (
                    <Expando
                      authorEditReason={edit?.reason}
                      commentMediaInfo={commentMediaInfo}
                      content={removed ? `[${_.lowerCase(t('removed'))}]` : deleted ? `[${_.lowerCase(t('deleted'))}]` : content}
                      expanded={isExpanded}
                      link={link}
                      modEditReason={reason}
                      nsfw={nsfw}
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
                  content={removed ? `[${_.lowerCase(t('removed'))}]` : deleted ? `[${_.lowerCase(t('deleted'))}]` : content}
                  expanded={isExpanded}
                  link={link}
                  modEditReason={reason}
                  nsfw={nsfw}
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

export default React.memo(Post);
