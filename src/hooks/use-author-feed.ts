import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthorComments } from '@bitsocial/bitsocial-react-hooks';
import { isAuthorCommentsView, isAuthorSubmittedView } from '../lib/utils/view-utils';

export type AuthorFeedTab = 'overview' | 'submitted' | 'comments';

/**
 * An author's posts and replies for the routed tab of /u/:authorAddress/comments/:commentCid.
 * The route follows the author's latest comment, so a profile link stays current.
 */
const useAuthorFeed = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { authorAddress, commentCid } = params;
  const tab: AuthorFeedTab = isAuthorCommentsView(location.pathname, params) ? 'comments' : isAuthorSubmittedView(location.pathname, params) ? 'submitted' : 'overview';

  const { authorComments, error, lastCommentCid, hasMore, loadMore } = useAuthorComments({ commentCid, authorAddress });

  const prevErrorMessageRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (error && error.message !== prevErrorMessageRef.current) {
      console.log(error);
      prevErrorMessageRef.current = error.message;
    }
  }, [error]);

  const comments = useMemo(() => {
    if (tab === 'comments') return authorComments?.filter((comment) => comment && comment.parentCid) || [];
    if (tab === 'submitted') return authorComments?.filter((comment) => comment && !comment.parentCid) || [];
    return authorComments;
  }, [authorComments, tab]);

  // always redirect to latest author cid, replacing only the cid segment of /u/:authorAddress/comments/:commentCid so the tab stays
  useEffect(() => {
    if (authorAddress && lastCommentCid && commentCid && lastCommentCid !== commentCid) {
      const pathSegments = location.pathname.split('/');
      pathSegments[4] = lastCommentCid;
      navigate({ pathname: pathSegments.join('/'), search: location.search, hash: location.hash }, { replace: true });
    }
  }, [authorAddress, lastCommentCid, commentCid, navigate, location.pathname, location.search, location.hash]);

  return {
    authorAddress,
    commentCid,
    tab,
    comments,
    /** The unfiltered feed's length, which the old interface's list counts. */
    totalCount: authorComments?.length || 0,
    error,
    hasMore,
    loadMore,
    // only show backend errors if the user gets no data
    shouldShowError: Boolean(error?.message && comments?.length === 0),
  };
};

export default useAuthorFeed;
