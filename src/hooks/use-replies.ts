import { useMemo, useCallback } from 'react';
import { Comment, useAccountComments } from '@bitsocialnet/bitsocial-react-hooks';

const useRepliesAndAccountReplies = (comment: Comment) => {
  // filter only the parent cid
  const filter = useCallback((accountComment: Comment) => accountComment.parentCid === (comment?.cid || 'n/a'), [comment?.cid]);
  const { accountComments } = useAccountComments({ filter });

  // the account's replies have a delay before getting published, so get them locally from accountComments instead
  const accountRepliesNotYetPublished = useMemo(() => {
    const pageValues = comment?.replies?.pages ? Object.values(comment.replies.pages) : [];
    const firstPageObject = pageValues[0] as { comments?: Comment[] } | undefined;
    const publishedComments = firstPageObject?.comments || [];
    const replyCids = new Set(publishedComments.map((reply: Comment) => reply?.cid));
    // filter out the account comments already in comment.replies, so they don't appear twice
    return accountComments.filter((accountReply) => !replyCids.has(accountReply?.cid));
  }, [comment?.replies?.pages, accountComments]);

  const repliesAndNotYetPublishedReplies = useMemo(() => {
    const pageValues = comment?.replies?.pages ? Object.values(comment.replies.pages) : [];
    const firstPageObject = pageValues[0] as { comments?: Comment[] } | undefined;
    const publishedComments = firstPageObject?.comments || [];
    return [
      // put the author's unpublished replies at the top, latest first (reverse)
      ...accountRepliesNotYetPublished.reverse(),
      // put the published replies after,
      ...publishedComments,
    ];
  }, [comment?.replies?.pages, accountRepliesNotYetPublished]);

  return repliesAndNotYetPublishedReplies;
};

export default useRepliesAndAccountReplies;
