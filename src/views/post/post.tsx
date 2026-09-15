import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Comment, useAccount, useAccountComments, useComment, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import findTopParentCidOfReply from '../../lib/utils/cid-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { sortRepliesByBest } from '../../lib/utils/post-utils';
import { getCanonicalCommunityPostRedirectPath, getCommunityPostPath, resolveCommunityRouteAddress } from '../../lib/utils/community-route-utils';
import { getPendingPostKey, getPendingPostRedirect, isPendingPostView, isPostContextView, RenderedPendingPost } from '../../lib/utils/view-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import useFeedResetStore from '../../stores/use-feed-reset-store';
import { useIsNsfwCommunity } from '../../hooks/use-is-nsfw-community';
import useReplies from '../../hooks/use-replies';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useOptionalAccountComment from '../../hooks/use-account-comment';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import useStateString from '../../hooks/use-state-string';
import ErrorDisplay from '../../components/error-display';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Over18Warning from '../../components/over-18-warning';
import PostComponent from '../../components/post';
import Reply from '../../components/reply';
import ReplyForm from '../../components/reply-form';
import Sidebar from '../../components/sidebar';
import styles from './post.module.css';
import _ from 'lodash';
import { getDisplayAddress } from '../../lib/utils/address-utils';

type SortDropdownProps = {
  sortBy: string;
  onSortChange: (sort: string) => void;
};

const SortDropdown = ({ sortBy, onSortChange }: SortDropdownProps) => {
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownItems = ['best', 'new', 'old'];

  const handleGlobalClick = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setOpenDropdown(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [handleGlobalClick]);

  return (
    <div className={styles.spacer}>
      <span className={styles.dropdownTitle}>{t('reply_sorted_by')}: </span>
      <div
        ref={dropdownRef}
        className={styles.dropdown}
        onClick={(e) => {
          e.stopPropagation();
          setOpenDropdown(!openDropdown);
        }}
      >
        <span className={styles.selected}>{t(sortBy)}</span>
        {openDropdown && (
          <div className={styles.dropdownItems}>
            {dropdownItems.map((item) => (
              <div
                className={styles.dropdownItem}
                key={item}
                onClick={() => {
                  setOpenDropdown(false);
                  onSortChange(item);
                }}
              >
                {t(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Post = ({ post }: { post: Comment }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const isInPostContextView = isPostContextView(location.pathname, params, location.search);

  const { cid, deleted, depth, locked, removed, postCid, replyCount, state, timestamp } = post || {};
  const communityAddress = getCommentCommunityAddress(post);

  const [sortBy, setSortBy] = useState('best');
  const unsortedReplies = useReplies(post);
  const account = useAccount();

  const replies = useMemo(() => {
    // Filter out deleted replies with no children first
    const filteredReplies = unsortedReplies.filter((reply) => !(reply.deleted && reply.replyCount === 0));

    const pinnedReplies = filteredReplies.filter((reply) => reply.pinned);
    const unpinnedReplies = filteredReplies.filter((reply) => !reply.pinned);

    const sortedPinnedReplies = [...pinnedReplies].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    let sortedUnpinnedReplies;
    if (sortBy === 'best') {
      const currentTime = Math.floor(Date.now() / 1000);

      const recentAccountReplies = unpinnedReplies.filter(
        (reply) => reply.author?.address === account?.author?.address && currentTime - (reply.timestamp || 0) <= 30 * 60,
      );
      const otherReplies = unpinnedReplies.filter((reply) => reply.author?.address !== account?.author?.address || currentTime - (reply.timestamp || 0) > 30 * 60);

      const sortedRecentAccountReplies = [...recentAccountReplies].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const sortedOtherReplies = sortRepliesByBest(otherReplies);

      sortedUnpinnedReplies = [...sortedRecentAccountReplies, ...sortedOtherReplies];
    } else {
      sortedUnpinnedReplies = [...unpinnedReplies].sort((a, b) => {
        if (sortBy === 'new') {
          return (b.timestamp || 0) - (a.timestamp || 0);
        } else {
          // 'old'
          return (a.timestamp || 0) - (b.timestamp || 0);
        }
      });
    }

    return [...sortedPinnedReplies, ...sortedUnpinnedReplies];
  }, [unsortedReplies, sortBy, account?.author?.address]);

  const isSingleComment = post?.parentCid ? true : false;

  const commentCount = replyCount === 0 ? t('no_comments') : replyCount === 1 ? t('one_comment') : t('all_comments', { count: replyCount });
  const stateString = useStateString(post);

  const lockedState = deleted ? t('deleted') : locked ? t('locked') : removed ? t('removed') : '';

  const postComment = useComment({ commentCid: postCid });

  return (
    <>
      {(deleted || locked || removed) && (
        <div className={styles.lockedInfobar}>
          <div className={styles.lockedInfobarText}>{t('post_locked_info', { state: _.lowerCase(lockedState) })}</div>
        </div>
      )}
      {isSingleComment ? <PostComponent post={postComment} /> : <PostComponent post={post} />}
      {timestamp && (
        <div className={styles.replyArea}>
          {!isSingleComment && (
            <div className={styles.repliesTitle}>
              <span className={styles.title}>
                {replyCount !== undefined
                  ? commentCount
                  : state === 'failed'
                    ? t('post_has_failed')
                    : cid
                      ? `${t('downloading_comments')}...`
                      : `${t('post_is_pending')}...`}
              </span>
            </div>
          )}
          {!isSingleComment && (
            <div className={styles.menuArea}>
              <SortDropdown sortBy={sortBy} onSortChange={setSortBy} />
              <div className={styles.spacer} />
              {communityAddress && cid && <ReplyForm cid={cid} communityAddress={communityAddress} postCid={postCid} />}
            </div>
          )}
          {isSingleComment && (
            <div className={styles.singleCommentInfobar}>
              <div className={styles.singleCommentInfobarText}>{t('single_comment_notice')}</div>
              <div className={styles.singleCommentInfobarLink}>
                <Link to={communityAddress && postCid ? getCommunityPostPath(communityAddress, postCid) : '/'}>{t('single_comment_link')}</Link> →
              </div>
            </div>
          )}
          <div className={styles.replies}>
            {replies.length === 0 && replyCount !== undefined && !(isInPostContextView || isSingleComment) && (
              <div className={styles.noReplies}>{t('nothing_found')}</div>
            )}
            {isSingleComment ? (
              <Reply key={`singleComment-${cid}`} reply={post} depth={0} isSingleComment={true} />
            ) : (
              replies.map((reply, index) => <Reply key={reply.cid ?? `pending-reply-${index}`} reply={reply} depth={depth} />)
            )}
          </div>
        </div>
      )}
      <span className={styles.loadingString}>
        {stateString && stateString !== 'Failed' ? (
          <div className={styles.stateString}>
            <LoadingEllipsis string={stateString || t('loading')} />
          </div>
        ) : (
          state === 'failed' && t('failed')
        )}
      </span>
    </>
  );
};

const PostWithContext = ({ post }: { post: Comment }) => {
  const { t } = useTranslation();
  const params = useParams();
  const { deleted, locked, postCid, removed, state } = post || {};
  const communityAddress = getCommentCommunityAddress(post);
  const postComment = useComment({ commentCid: postCid });
  const topParentCid = findTopParentCidOfReply(post.cid, postComment);
  const topParentComment = useComment({ commentCid: topParentCid || undefined });
  const stateString = useStateString(post);

  return (
    <>
      {(deleted || locked || removed) && (
        <div className={styles.lockedInfobar}>
          <div className={styles.lockedInfobarText}>{t('post_locked_info', { state: deleted ? t('deleted') : locked ? t('locked') : removed ? t('removed') : '' })}</div>
        </div>
      )}
      <PostComponent post={postComment} />
      <div className={styles.replyArea}>
        <div className={styles.menuArea}>
          {stateString && stateString !== 'Failed' ? (
            <div className={styles.stateString}>
              <LoadingEllipsis string={stateString} />
            </div>
          ) : (
            state === 'failed' && t('failed')
          )}
        </div>
        <div className={styles.singleCommentInfobar}>
          <div className={styles.singleCommentInfobarText}>{t('single_comment_notice')}</div>
          <div className={styles.singleCommentInfobarLink}>
            <Link to={communityAddress && postCid ? getCommunityPostPath(communityAddress, postCid) : '/'}>{t('single_comment_link')}</Link> →
          </div>
        </div>
        <div className={styles.replies}>
          <Reply key={`contextComment-${topParentComment?.cid}`} reply={topParentComment} depth={0} cidOfReplyWithContext={params.commentCid} />
        </div>
      </div>
    </>
  );
};

const PostPage = () => {
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const locationSearch = location.search;
  const navigate = useNavigate();
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInPostContextView = isPostContextView(location.pathname, params, locationSearch);

  // pending post
  const { accountComments } = useAccountComments();
  const { accountCommentIndex } = useParams<{ accountCommentIndex?: string }>();
  const commentIndex = accountCommentIndex ? parseInt(accountCommentIndex) : undefined;

  const isValidAccountCommentIndex =
    !accountCommentIndex ||
    (!isNaN(parseInt(accountCommentIndex)) &&
      parseInt(accountCommentIndex) >= 0 &&
      Number.isInteger(parseFloat(accountCommentIndex)) &&
      accountComments?.length > 0 &&
      parseInt(accountCommentIndex) < accountComments.length);

  const accountComment = useOptionalAccountComment(commentIndex);
  const pendingPost = accountComment;

  // a pending post that was already rendered disappears when its publication is abandoned during the
  // challenge, because abandoning deletes the account comment; go back instead of showing not found
  const pendingPostKey = getPendingPostKey(accountComment);
  const renderedPendingPostRef = useRef<RenderedPendingPost>({});

  useEffect(() => {
    const current = { accountCommentIndex, key: pendingPostKey };
    const redirect = getPendingPostRedirect(renderedPendingPostRef.current, current, isValidAccountCommentIndex);
    if (!redirect) {
      renderedPendingPostRef.current = current;
      return;
    }
    if (redirect === 'back') {
      navigate(-1);
      return;
    }
    navigate('/not-found', { replace: true });
  }, [accountCommentIndex, isValidAccountCommentIndex, navigate, pendingPostKey]);

  const pendingPostCommunityAddress = getCommentCommunityAddress(pendingPost);

  // in pending post route, redirect to post page route when post is published (cid is defined)
  const resetFeed = useFeedResetStore((state) => state.reset);
  useEffect(() => {
    if (pendingPost?.cid && pendingPostCommunityAddress) {
      if (resetFeed) resetFeed();
      navigate(getCommunityPostPath(pendingPostCommunityAddress, pendingPost.cid), { replace: true });
    }
  }, [pendingPost?.cid, pendingPostCommunityAddress, navigate, resetFeed]);

  const { commentCid } = params;
  const { communityAddress: routeCommunityAddress, directoryCode } = useResolvedCommunityRoute();
  let post = useComment({ commentCid }) as any;
  if (isInPendingPostView) {
    post = pendingPost;
  }
  const postCommunityAddress = getCommentCommunityAddress(post);
  const resolvedPostCommunityAddress = resolveCommunityRouteAddress(postCommunityAddress);
  const communityAddress = isInPendingPostView ? pendingPostCommunityAddress : resolvedPostCommunityAddress || routeCommunityAddress;
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  const canonicalPostRedirectPath = getCanonicalCommunityPostRedirectPath(params.communityAddress, postCommunityAddress, commentCid);

  useEffect(() => {
    if (!isInPendingPostView && canonicalPostRedirectPath) {
      navigate(`${canonicalPostRedirectPath}${locationSearch}`, { replace: true });
    }
  }, [canonicalPostRedirectPath, isInPendingPostView, locationSearch, navigate]);

  const { hasAcceptedWarning } = useContentOptionsStore();
  const isNsfwCommunity = useIsNsfwCommunity(communityAddress || '');

  useEffect(() => {
    if (post?.error) {
      console.log(post.error);
    }
  }, [post?.error]);

  const postTitle = post.title?.slice(0, 40) || post?.content?.slice(0, 40);
  const communityTitle = community?.title || getDisplayAddress(community?.shortAddress || '');
  useEffect(() => {
    document.title = `${postTitle || ''}${postTitle && communityTitle ? ' - ' : ''}${communityTitle || ''}${postTitle || communityTitle ? ' - Seedit' : 'Seedit'}`;
  }, [postTitle, communityTitle]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [commentCid, routeCommunityAddress, accountCommentIndex]);

  // Derive whether to show error directly from current post state
  const shouldShowErrorToUser = Boolean(post?.error && ((post?.replyCount > 0 && post?.replies?.length === 0) || post?.state === 'failed'));

  return isNsfwCommunity && !hasAcceptedWarning ? (
    <Over18Warning />
  ) : (
    <div className={styles.content}>
      <div className={styles.sidebar}>
        {directoryCode && !isInPendingPostView ? (
          <LoadingEllipsis string={t('loading')} />
        ) : (
          <Sidebar community={community} comment={post} settings={community?.settings} />
        )}
      </div>
      {isInPendingPostView && params?.accountCommentIndex ? <Post post={pendingPost} /> : isInPostContextView ? <PostWithContext post={post} /> : <Post post={post} />}
      {shouldShowErrorToUser && (
        <div className={styles.error}>
          <ErrorDisplay error={post.error} />
        </div>
      )}
    </div>
  );
};

export default PostPage;
