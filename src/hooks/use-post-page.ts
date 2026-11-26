import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { type Comment, type Community, useAccountComments, useComment, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { getDisplayAddress } from '../lib/utils/address-utils';
import { getCommentCommunityAddress } from '../lib/utils/comment-utils';
import { getCanonicalCommunityPostRedirectPath, getCommunityPostPath, resolveCommunityRouteAddress } from '../lib/utils/community-route-utils';
import type { SeeditDirectoryCode } from '../lib/utils/directory-codes';
import { stripCommentPostOptionMarkers } from '../lib/utils/fivechan-post-options';
import { getPendingPostKey, getPendingPostRedirect, isPendingPostView, isPostContextView, type RenderedPendingPost } from '../lib/utils/view-utils';
import useContentOptionsStore from '../stores/use-content-options-store';
import useFeedResetStore from '../stores/use-feed-reset-store';
import useOptionalAccountComment from './use-account-comment';
import { getCommunityIdentifier } from './use-community-identifier';
import { useIsNsfwCommunity } from './use-is-nsfw-community';
import useResolvedCommunityRoute from './use-resolved-community-route';

export interface PostPageState {
  /** The routed comment: a post, a reply, or the account's pending post on /profile/:accountCommentIndex. */
  post: Comment;
  community: Community | undefined;
  communityAddress: string | undefined;
  directoryCode: SeeditDirectoryCode | undefined;
  isInPendingPostView: boolean;
  isInPostContextView: boolean;
  /** The community is NSFW and the reader has not accepted the warning. */
  isNsfwGated: boolean;
  shouldShowError: boolean;
}

/** Loads the comment a post page routes to and keeps the route canonical; both interfaces render its result. */
const usePostPage = (): PostPageState => {
  const params = useParams();
  const location = useLocation();
  const locationSearch = location.search;
  const navigate = useNavigate();
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInPostContextView = isPostContextView(location.pathname, params, locationSearch);

  // pending post
  const { accountComments } = useAccountComments();
  const { accountCommentIndex, commentCid } = params;
  const commentIndex = accountCommentIndex ? parseInt(accountCommentIndex) : undefined;

  const isValidAccountCommentIndex =
    !accountCommentIndex ||
    (!isNaN(parseInt(accountCommentIndex)) &&
      parseInt(accountCommentIndex) >= 0 &&
      Number.isInteger(parseFloat(accountCommentIndex)) &&
      accountComments?.length > 0 &&
      parseInt(accountCommentIndex) < accountComments.length);

  const pendingPost = useOptionalAccountComment(commentIndex);

  // a pending post that was already rendered disappears when its publication is abandoned during the
  // challenge, because abandoning deletes the account comment; go back instead of showing not found
  const pendingPostKey = getPendingPostKey(pendingPost);
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

  const { communityAddress: routeCommunityAddress, directoryCode } = useResolvedCommunityRoute();
  const routedComment = useComment({ commentCid });
  const post: Comment = isInPendingPostView ? pendingPost : routedComment;
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

  const hideNsfwCommunities = useContentOptionsStore((state) => state.hideNsfwCommunities);
  const isNsfwCommunity = useIsNsfwCommunity(communityAddress || '');

  useEffect(() => {
    if (post?.error) {
      console.log(post.error);
    }
  }, [post?.error]);

  const postTitle = post?.title?.slice(0, 40) || stripCommentPostOptionMarkers(post?.content, post, communityAddress)?.slice(0, 40);
  const communityTitle = community?.title || getDisplayAddress(community?.shortAddress || '');
  useEffect(() => {
    document.title = `${postTitle || ''}${postTitle && communityTitle ? ' - ' : ''}${communityTitle || ''}${postTitle || communityTitle ? ' - Seedit' : 'Seedit'}`;
  }, [postTitle, communityTitle]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [commentCid, routeCommunityAddress, accountCommentIndex]);

  return {
    post,
    community,
    communityAddress,
    directoryCode,
    isInPendingPostView,
    isInPostContextView,
    isNsfwGated: Boolean(isNsfwCommunity && hideNsfwCommunities),
    // Derive whether to show error directly from current post state
    shouldShowError: Boolean(post?.error && ((post?.replyCount > 0 && post?.replies?.length === 0) || post?.state === 'failed')),
  };
};

export default usePostPage;
