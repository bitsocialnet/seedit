import { useMemo } from 'react';
import { useAccount, type Comment } from '@bitsocial/bitsocial-react-hooks';
import { sortThreadReplies, type ThreadReplySort } from '../lib/utils/post-utils';
import useReplies from './use-replies';

/** A thread's direct replies, including the account's unpublished ones, in the order both interfaces show them. */
const useSortedReplies = (comment: Comment, sortBy: ThreadReplySort): Comment[] => {
  const replies = useReplies(comment);
  const accountAuthorAddress = useAccount()?.author?.address;
  return useMemo(() => sortThreadReplies(replies, sortBy, accountAuthorAddress), [replies, sortBy, accountAuthorAddress]);
};

export default useSortedReplies;
