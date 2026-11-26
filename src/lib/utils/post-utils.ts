import { getCommentCommunityAddress } from './comment-utils';
import { getCommunityPostPath } from './community-route-utils';
import { getPlainTextPreview } from './plain-text-preview';

export const formatScore = (score: number | '•' | '?'): string => {
  if (typeof score !== 'number') {
    return score;
  }

  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: score < 100000 ? 1 : 0,
  }).format(score);
};

export const getPostScore = (upvoteCount: number, downvoteCount: number, state: string): '•' | '?' | number => {
  if ((upvoteCount === 0 && downvoteCount === 0) || state === 'pending' || state === 'failed') {
    return '•';
  } else if (upvoteCount === undefined || downvoteCount === undefined) {
    return '?';
  }
  return upvoteCount - downvoteCount;
};

export const getReplyScore = (upvoteCount: number | undefined, downvoteCount: number | undefined): number => {
  // If no votes, return default of 1
  if ((upvoteCount === 0 && downvoteCount === 0) || (upvoteCount === undefined && downvoteCount === undefined)) {
    return 1;
  }

  // If only upvoted once with no downvotes, return 1 (default state)
  if (upvoteCount === 1 && downvoteCount === 0) {
    return 1;
  }

  // Calculate actual score
  return (upvoteCount || 0) - (downvoteCount || 0) + 1;
};

// "best" sort from reddit replies
// https://web.archive.org/web/20100305052116/http://blog.reddit.com/2009/10/reddits-new-comment-sorting-system.html
// https://medium.com/hacking-and-gonzo/how-reddit-ranking-algorithms-work-ef111e33d0d9
// http://www.evanmiller.org/how-not-to-sort-by-average-rating.html
// https://github.com/reddit-archive/reddit/blob/753b17407e9a9dca09558526805922de24133d53/r2/r2/lib/db/_sorts.pyx#L70
export const sortRepliesByBest = (feed: any[]) => {
  const postScores: { [key: string]: number } = {};
  for (const post of feed) {
    let upvoteCount = post.upvoteCount || 0;
    const downvoteCount = post.downvoteCount || 0;

    // n is the total number of ratings
    const n = upvoteCount + downvoteCount;
    if (n === 0) {
      postScores[post.cid] = 0;
      continue;
    }

    // zα/2 is the (1-α/2) quantile of the standard normal distribution
    const z = 1.281551565545;

    // p is the observed fraction of positive ratings
    const p = upvoteCount / n;

    const left = p + (1 / (2 * n)) * z * z;
    const right = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    const under = 1 + (1 / n) * z * z;
    postScores[post.cid] = (left - right) / under;
  }

  // sort by old first for tiebreaker (like reddit does)
  return feed.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).sort((a, b) => (postScores[b.cid] || 0) - (postScores[a.cid] || 0));
};

export const THREAD_REPLY_SORTS = ['best', 'new', 'old'] as const;
export type ThreadReplySort = (typeof THREAD_REPLY_SORTS)[number];

export const isThreadReplySort = (value: string): value is ThreadReplySort => (THREAD_REPLY_SORTS as readonly string[]).includes(value);

// How long the account's own new replies stay at the top of a best-sorted thread, so a reply just posted stays in view.
const RECENT_ACCOUNT_REPLY_SECONDS = 30 * 60;

/** Orders a thread's replies: pinned replies first, newest first, then the rest by the chosen sort. Deleted replies without children are dropped. */
export const sortThreadReplies = <T extends { author?: { address?: string }; deleted?: boolean; pinned?: boolean; replyCount?: number; timestamp?: number }>(
  replies: T[],
  sortBy: ThreadReplySort,
  accountAuthorAddress: string | undefined,
  now = Math.floor(Date.now() / 1000),
): T[] => {
  const visibleReplies = replies.filter((reply) => !(reply.deleted && reply.replyCount === 0));
  const pinnedReplies = visibleReplies.filter((reply) => reply.pinned).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const unpinnedReplies = visibleReplies.filter((reply) => !reply.pinned);

  if (sortBy === 'best') {
    const isRecentAccountReply = (reply: T) => reply.author?.address === accountAuthorAddress && now - (reply.timestamp || 0) <= RECENT_ACCOUNT_REPLY_SECONDS;
    const recentAccountReplies = unpinnedReplies.filter(isRecentAccountReply).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const otherReplies = sortRepliesByBest(unpinnedReplies.filter((reply) => !isRecentAccountReply(reply)));
    return [...pinnedReplies, ...recentAccountReplies, ...otherReplies];
  }

  const direction = sortBy === 'new' ? -1 : 1;
  return [...pinnedReplies, ...[...unpinnedReplies].sort((a, b) => direction * ((a.timestamp || 0) - (b.timestamp || 0)))];
};

const POST_TITLE_MAX_LENGTH = 300;

/** The path of a post's page; a pending post has no cid yet, so it opens from the account's comment index. */
export const getPostPagePath = (post: { cid?: string; communityAddress?: string; index?: number }): string => {
  const communityAddress = getCommentCommunityAddress(post);
  return post.cid && communityAddress ? getCommunityPostPath(communityAddress, post.cid) : `/profile/${post.index}`;
};

/** The heading text of a post: its title, or for an untitled post the start of its text. */
export const getPostTitleText = (title: string | undefined, contentText: string | undefined): string =>
  (title || getPlainTextPreview(contentText, POST_TITLE_MAX_LENGTH) || '-').slice(0, POST_TITLE_MAX_LENGTH);

const MODERATOR_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'moderator']);

export const isModeratorRole = (role: string | undefined): boolean => Boolean(role && MODERATOR_ROLES.has(role));

/**
 * What a community accepts under a post, as pkc-js validates it: nothing under a removed, deleted, or archived post,
 * and on a locked post replies from moderators but no votes from anyone.
 */
export const getThreadPermissions = (comment: object | undefined, isModerator: boolean): { canVote: boolean; canReply: boolean } => {
  const post = comment as { cid?: string; removed?: boolean; deleted?: boolean; locked?: boolean; archived?: boolean } | undefined;
  const isPublished = Boolean(post?.cid);
  const isClosed = Boolean(post?.removed || post?.deleted || post?.archived);
  return {
    canVote: isPublished && !isClosed && !post?.locked,
    canReply: isPublished && !isClosed && (!post?.locked || isModerator),
  };
};
