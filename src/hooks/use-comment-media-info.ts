import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Comment } from '@bitsocial/bitsocial-react-hooks';
import { getCommentMediaInfo, fetchWebpageThumbnailIfNeeded, isThumbnailDomainBlacklisted } from '../lib/utils/media-utils';
import { isPendingPostView, isPostPageView } from '../lib/utils/view-utils';

export const useCommentMediaInfo = (comment: Comment) => {
  const location = useLocation();
  const params = useParams();
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const commentMediaInfo = getCommentMediaInfo(comment);

  // Some sites allow CORS access, so the thumbnail can be fetched client-side even when the community does not fetch thumbnail URLs.
  // Don't fetch in feed view, it displaces the posts.
  // Blacklisted domains have no real thumbnail, so whatever the fetch finds would be junk such as emojis.
  const webpageUrlToFetch =
    (isInPostPageView || isInPendingPostView) &&
    commentMediaInfo?.type === 'webpage' &&
    !commentMediaInfo.thumbnail &&
    !isThumbnailDomainBlacklisted(commentMediaInfo.url)
      ? commentMediaInfo.url
      : undefined;
  // keyed by url so a thumbnail fetched for a previous link is never shown for the current one
  const [fetchedThumbnail, setFetchedThumbnail] = useState<{ url: string; thumbnail: string } | null>(null);

  useEffect(() => {
    if (!webpageUrlToFetch) return;
    let isActive = true;
    fetchWebpageThumbnailIfNeeded({ url: webpageUrlToFetch, type: 'webpage' }).then(({ thumbnail }) => {
      if (isActive && thumbnail) {
        setFetchedThumbnail({ url: webpageUrlToFetch, thumbnail });
      }
    });
    return () => {
      isActive = false;
    };
  }, [webpageUrlToFetch]);

  if (commentMediaInfo && webpageUrlToFetch && fetchedThumbnail?.url === webpageUrlToFetch) {
    return { ...commentMediaInfo, thumbnail: fetchedThumbnail.thumbnail };
  }
  return commentMediaInfo;
};
