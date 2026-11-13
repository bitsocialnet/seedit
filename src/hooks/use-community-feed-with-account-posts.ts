import { useEffect, useMemo, useRef } from 'react';
import { type Comment, useAccountComments } from '@bitsocial/bitsocial-react-hooks';
import { filterOptimisticLocalPosts } from '../lib/utils/account-history-utils';
import useFeedResetStore from '../stores/use-feed-reset-store';
import { usePinnedPostsStore } from '../stores/use-pinned-posts-store';

/**
 * A community feed with the account's own recent posts shown right after the pinned posts as soon as they are
 * published, instead of waiting for the community to include them.
 */
const useCommunityFeedWithAccountPosts = (communityAddress: string, feed: Comment[], reset: () => void): Comment[] => {
  const { accountComments } = useAccountComments({ communityAddress, newerThan: 60 * 60 });
  const filteredComments = useMemo(() => filterOptimisticLocalPosts(accountComments, feed, communityAddress), [accountComments, communityAddress, feed]);

  // reset the feed when a new account comment is published, so it shows instantly in the feed
  const setResetFunction = useFeedResetStore((state) => state.setResetFunction);
  useEffect(() => {
    setResetFunction(reset);
  }, [reset, setResetFunction, feed]);

  const resetTriggeredRef = useRef(false);

  useEffect(() => {
    if (filteredComments.length > 0 && !resetTriggeredRef.current) {
      reset();
      resetTriggeredRef.current = true;
    }
  }, [filteredComments, reset]);

  const setPinnedPostsCount = usePinnedPostsStore((state) => state.setPinnedPostsCount);
  useEffect(() => {
    if (feed) {
      const pinnedCount = feed.filter((post) => post.pinned).length;
      setPinnedPostsCount(pinnedCount);
    }
  }, [feed, setPinnedPostsCount]);

  return useMemo(() => {
    const newFeed = [...feed];
    const lastPinnedIndex = newFeed.map((post) => post.pinned).lastIndexOf(true);
    if (filteredComments.length > 0) {
      newFeed.splice(lastPinnedIndex + 1, 0, ...filteredComments);
    }
    return newFeed;
  }, [feed, filteredComments]);
};

export default useCommunityFeedWithAccountPosts;
