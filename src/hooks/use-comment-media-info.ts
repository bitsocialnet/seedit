import { useCallback, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Comment } from '@bitsocialnet/bitsocial-react-hooks';
import { getCommentMediaInfo, fetchWebpageThumbnailIfNeeded } from '../lib/utils/media-utils';
import { isPendingPostView, isPostPageView } from '../lib/utils/view-utils';

export const useCommentMediaInfo = (comment: Comment) => {
  const location = useLocation();
  const params = useParams();
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInPendingPostView = isPendingPostView(location.pathname, params);

  // some sites have CORS access, so the thumbnail can be fetched client-side, which is helpful if subplebbit.settings.fetchThumbnailUrls is false
  const fetchThumbnail = useCallback(async () => {
    let commentMediaInfo = getCommentMediaInfo(comment);
    if (commentMediaInfo?.type === 'webpage' && !commentMediaInfo.thumbnail) {
      const newMediaInfo = await fetchWebpageThumbnailIfNeeded(commentMediaInfo);
      commentMediaInfo = newMediaInfo;
    }
    return commentMediaInfo;
  }, [comment]);

  useEffect(() => {
    // don't fetch in feed view, it displaces the posts
    if (isInPostPageView || isInPendingPostView) {
      fetchThumbnail();
    }
  }, [fetchThumbnail, isInPostPageView, isInPendingPostView]);

  return getCommentMediaInfo(comment);
};
