import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Comment, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { startPostingAnalytics } from '../lib/posting-analytics';
import { getShortDisplayAddress } from '../lib/utils/address-utils';
import { isValidURL } from '../lib/utils/url-utils';
import usePublishPostStore from '../stores/use-publish-post-store';
import { getCommunityIdentifier } from './use-community-identifier';
import useIsCommunityOffline from './use-is-community-offline';
import usePublishCommentWithChallengeAbandon from './use-publish-comment-with-challenge-abandon';
import useResolvedCommunityRoute from './use-resolved-community-route';

/**
 * Publishes the post draft in the shared submit store; both interfaces' submit pages use it.
 * The draft starts in the routed community, and a published post opens on its pending page.
 */
const useSubmitPost = () => {
  const navigate = useNavigate();
  const { crosspost, content, link, nsfw, spoiler, title, communityAddress, publishCommentOptions, setPublishPostStore, resetPublishPostStore } = usePublishPostStore();
  const { communityAddress: routeCommunityAddress } = useResolvedCommunityRoute();

  useEffect(() => {
    setPublishPostStore({ communityAddress: routeCommunityAddress || '' } as Comment);
  }, [routeCommunityAddress, setPublishPostStore]);

  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress) } : undefined);
  const shortAddress = communityAddress ? getShortDisplayAddress(communityAddress) : undefined;
  const { isOffline, offlineTitle } = useIsCommunityOffline(community);

  // the store is cleared when the pending post is created, so the published draft is kept aside to
  // put back in the form when the user abandons the challenge instead of publishing
  const publishedDraftRef = useRef<Comment | undefined>(undefined);
  const restorePublishedDraft = () => {
    const publishedDraft = publishedDraftRef.current;
    publishedDraftRef.current = undefined;
    if (publishedDraft) {
      setPublishPostStore(publishedDraft);
    }
  };

  const { index, publishComment } = usePublishCommentWithChallengeAbandon(publishCommentOptions, restorePublishedDraft);

  const submitPost = () => {
    const attempt = startPostingAnalytics({ kind: 'post' });
    if (!title) {
      attempt.finish('post_validation_failed');
      alert(`Missing title`);
      return;
    }
    if (link && !isValidURL(link)) {
      attempt.finish('post_validation_failed');
      alert(`Invalid URL`);
      return;
    }
    if (!communityAddress) {
      attempt.finish('post_validation_failed');
      alert(`Missing community address`);
      return;
    }

    publishedDraftRef.current = { communityAddress, title, content, link, spoiler, nsfw, crosspost } as Comment;
    publishComment(attempt);
  };

  // redirect to pending page when pending comment is created
  useEffect(() => {
    if (typeof index === 'number') {
      resetPublishPostStore();
      navigate(`/profile/${index}`);
    }
  }, [index, resetPublishPostStore, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return { communityAddress, community, shortAddress, isOffline, offlineTitle, submitPost };
};

export default useSubmitPost;
