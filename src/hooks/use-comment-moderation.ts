import { useState } from 'react';
import { type Comment, type PublishCommentModerationOptions, useComment, useEditedComment, usePublishCommentModeration } from '@bitsocial/bitsocial-react-hooks';
import { alertChallengeVerificationFailed } from '../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../lib/utils/comment-utils';
import challengesStore from '../stores/use-challenges-store';

const { addChallenge } = challengesStore.getState();

export type ModerationFlag = 'removed' | 'purged' | 'locked' | 'spoiler' | 'nsfw' | 'pinned';

const DAY_SECONDS = 24 * 60 * 60;

const daysToTimestampInSeconds = (days: number) => {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return Math.floor(now.getTime() / 1000);
};

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/**
 * The ban the form starts from: this comment's ban while it is still running at `now`, the moderator's draft of it
 * (undefined when unchecked), when the moderator unchecked it, and its length in days.
 */
const getBanState = (banExpiresAt: unknown, now: number | undefined) => {
  const running = now !== undefined && typeof banExpiresAt === 'number' && banExpiresAt > now ? banExpiresAt : undefined;
  return {
    opened: running,
    draft: running,
    liftedAt: undefined as number | undefined,
    days: running && now ? Math.max(1, Math.floor((running - now) / DAY_SECONDS)) : 1,
  };
};

/**
 * A moderator's changes to a comment: flags, a ban of its author, and a reason; both interfaces' moderation menus use
 * it. A form that opens with its component passes the time it opened; one that mounts long before it opens calls
 * `reset` when it opens, so it starts from the comment's flags and ban as they are then.
 */
const useCommentModeration = (cid: string, openedAt?: number) => {
  const comment = useComment({ commentCid: cid });
  const { editedComment } = useEditedComment({ comment });
  const post: Comment | undefined = editedComment || comment;
  const { removed, locked, spoiler, nsfw, pinned, purged } = post || {};
  // A ban (commentModeration.author.banExpiresAt) marks the comment it is published on with authorBanExpiresAt, so the
  // ban checkbox starts from this comment's own ban (the account's pending moderation, then the published mark), never
  // from the author-wide author.community.banExpiresAt, and only while that ban is still running.
  const thisCommentBanExpiresAt = post?.commentModeration?.author?.banExpiresAt ?? post?.authorBanExpiresAt;

  const getDefaultOptions = (): PublishCommentModerationOptions => ({
    commentCid: cid,
    communityAddress: getCommentCommunityAddress(post),
    commentModeration: {
      removed: removed ?? false,
      purged: purged ?? false,
      locked: locked ?? false,
      spoiler: spoiler ?? false,
      nsfw: nsfw ?? false,
      pinned: pinned ?? false,
    },
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onChallengeVerification: alertChallengeVerificationFailed,
    onError: (error: Error) => {
      console.warn(error);
      alert(error.message);
    },
  });
  const [options, setOptions] = useState(getDefaultOptions);
  const [ban, setBan] = useState(() => getBanState(thisCommentBanExpiresAt, openedAt));

  // A ban is sent only when the moderator sets, changes or lifts it in this form, compared with the ban the form opened
  // with, so removing or locking a banned comment does not republish its ban. Lifting publishes the time the moderator
  // unchecked it, as pkc-js unbans: the ban ends and the comment keeps its label. The author key is otherwise left out,
  // because the hooks read an author key, even undefined, as a change to the ban.
  const banExpiresAtToPublish = ban.draft !== undefined ? (ban.draft !== ban.opened ? ban.draft : undefined) : ban.opened !== undefined ? ban.liftedAt : undefined;
  const { publishCommentModeration } = usePublishCommentModeration({
    ...options,
    commentModeration: {
      ...options.commentModeration,
      ...(banExpiresAtToPublish !== undefined && { author: { banExpiresAt: banExpiresAtToPublish } }),
    },
  });

  const updateModeration = (changes: Partial<PublishCommentModerationOptions['commentModeration']>) =>
    setOptions((state) => ({ ...state, commentModeration: { ...state.commentModeration, ...changes } }));

  const reset = () => {
    setOptions(getDefaultOptions());
    setBan(getBanState(thisCommentBanExpiresAt, nowInSeconds()));
  };
  const setFlag = (flag: ModerationFlag, value: boolean) => updateModeration({ [flag]: value });
  const setBanned = (banned: boolean) =>
    setBan({ ...ban, draft: banned ? daysToTimestampInSeconds(ban.days) : undefined, liftedAt: banned ? undefined : nowInSeconds() });
  const setBanDays = (days: number) => {
    const validDays = days || 1;
    // only a checked ban takes the new length
    setBan({ ...ban, days: validDays, draft: ban.draft === undefined ? undefined : daysToTimestampInSeconds(validDays) });
  };
  const setReason = (reason: string) => updateModeration({ reason: reason || '' });

  /** Publishes the moderation; purging asks for confirmation first and returns false when declined. */
  const save = async (): Promise<boolean> => {
    if (options.commentModeration.purged) {
      const confirmed = window.confirm(
        'You are purging this comment. Are you sure you want to continue?\n\n' +
          "The comment will be completely removed from this community's database. This action is irreversible.",
      );
      if (!confirmed) return false;
    }
    await publishCommentModeration();
    return true;
  };

  return { post, moderation: options.commentModeration, isBanned: ban.draft !== undefined, banDays: ban.days, setFlag, setBanned, setBanDays, setReason, save, reset };
};

export default useCommentModeration;
