import { Comment } from '@bitsocialnet/bitsocial-react-hooks';

export const findTopParentCidOfReply = (replyCid: string, post: Comment): string | null => {
  if (!post?.replyCount || post?.replyCount === 0) {
    return null;
  }

  // Check if the comments array exists before iterating
  const comments = post?.replies?.pages?.topAll?.comments;
  if (!comments || !Array.isArray(comments)) {
    return null;
  }

  for (const firstLevelReply of comments) {
    if (firstLevelReply?.cid === replyCid) {
      return firstLevelReply?.cid;
    }

    const result = findInDeeperReplies(replyCid, firstLevelReply, firstLevelReply?.cid);
    if (result) {
      return result;
    }
  }

  return null;
};

const findInDeeperReplies = (replyCid: string, currentReply: Comment, firstLevelParentCid: string): string | null => {
  if (currentReply?.replyCount > 0) {
    const comments = currentReply?.replies?.pages?.topAll?.comments;
    if (comments && Array.isArray(comments)) {
      for (const deeperReply of comments) {
        if (deeperReply.cid === replyCid) {
          return firstLevelParentCid;
        }

        const result = findInDeeperReplies(replyCid, deeperReply, firstLevelParentCid);
        if (result) {
          return result;
        }
      }
    }
  }

  return null;
};

export default findTopParentCidOfReply;
