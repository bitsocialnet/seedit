// Helper to safely extract the community address from a Comment object.
export const getCommentCommunityAddress = (comment?: unknown): string | undefined => {
  if (!comment || typeof comment !== 'object') {
    return undefined;
  }

  const record = comment as { communityAddress?: unknown };

  if (typeof record.communityAddress === 'string' && record.communityAddress) {
    return record.communityAddress;
  }

  return undefined;
};

/**
 * useComment reports `failed` both for the account's own comment whose publication failed and for any comment whose
 * load failed. Only the account's own comment carries its account `index`, and bitsocial-react-hooks never marks that
 * one `failed` because of a failed load, so `failed` with an index is a failed publication and without one a failed load.
 */
export const isCommentPublicationFailed = (comment?: { state?: string; index?: number }): boolean => comment?.state === 'failed' && typeof comment.index === 'number';

/**
 * Whether a moderator banned the author for this comment. pkc-js 0.0.158+ sets authorBanExpiresAt only on the comment a
 * ban was published on, and keeps it after the ban ends; author.community.banExpiresAt is the author-wide ban and is on
 * every comment of a banned author, so it can't tell which comment the ban was for.
 */
export const isAuthorBannedForComment = (comment?: { authorBanExpiresAt?: unknown }): boolean =>
  typeof comment?.authorBanExpiresAt === 'number' && comment.authorBanExpiresAt > 0;

/** A comment whose load failed, as opposed to the account's own comment whose publication failed. */
export const isCommentLoadFailed = (comment?: { state?: string; index?: number }): boolean => comment?.state === 'failed' && typeof comment.index !== 'number';
