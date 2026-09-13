import { useMemo } from 'react';
import { useAccountComments, type Comment } from '@bitsocial/bitsocial-react-hooks';
import { getPublishedReplies, mergeRepliesWithPendingAccountReplies } from '../lib/utils/account-history-utils';

const useRepliesAndAccountReplies = (comment: Comment) => {
  const { accountComments } = useAccountComments({ parentCid: comment?.cid || 'n/a' });

  // getPublishedReplies only reads comment.replies.pages, so the memo keys on the pages: unrelated comment updates
  // (votes, edits) replace the comment object, and this keeps the published replies list stable across them.
  const replyPages = comment?.replies?.pages;
  const publishedReplies = useMemo(() => getPublishedReplies(replyPages && { replies: { pages: replyPages } }), [replyPages]);

  // the account's replies have a delay before getting published, so get them locally from accountComments instead
  const repliesAndNotYetPublishedReplies = useMemo(() => mergeRepliesWithPendingAccountReplies(publishedReplies, accountComments), [publishedReplies, accountComments]);

  return repliesAndNotYetPublishedReplies;
};

export default useRepliesAndAccountReplies;
