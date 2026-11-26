import { useState } from 'react';
import { type Comment, type PublishCommentModerationOptions, useComment, useEditedComment, usePublishCommentModeration } from '@bitsocial/bitsocial-react-hooks';
import { alertChallengeVerificationFailed } from '../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../lib/utils/comment-utils';
import challengesStore from '../stores/use-challenges-store';

const { addChallenge } = challengesStore.getState();

export type ModerationFlag = 'removed' | 'purged' | 'locked' | 'spoiler' | 'nsfw' | 'pinned';

const daysToTimestampInSeconds = (days: number) => {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return Math.floor(now.getTime() / 1000);
};

/** A moderator's changes to a comment: flags, a ban of its author, and a reason; both interfaces' moderation menus use it. */
const useCommentModeration = (cid: string) => {
  const comment = useComment({ commentCid: cid });
  const { editedComment } = useEditedComment({ comment });
  const post: Comment | undefined = editedComment || comment;
  const { removed, locked, spoiler, nsfw, pinned, banExpiresAt, purged } = post || {};

  const [options, setOptions] = useState<PublishCommentModerationOptions>(() => ({
    commentCid: cid,
    communityAddress: getCommentCommunityAddress(post),
    commentModeration: {
      removed: removed ?? false,
      purged: purged ?? false,
      locked: locked ?? false,
      spoiler: spoiler ?? false,
      nsfw: nsfw ?? false,
      pinned: pinned ?? false,
      banExpiresAt,
    },
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onChallengeVerification: alertChallengeVerificationFailed,
    onError: (error: Error) => {
      console.warn(error);
      alert(error.message);
    },
  }));
  const { publishCommentModeration } = usePublishCommentModeration(options);
  const [banDays, setBanDaysState] = useState(1);

  const updateModeration = (changes: Partial<PublishCommentModerationOptions['commentModeration']>) =>
    setOptions((state) => ({ ...state, commentModeration: { ...state.commentModeration, ...changes } }));

  const setFlag = (flag: ModerationFlag, value: boolean) => updateModeration({ [flag]: value });
  const setBanned = (banned: boolean) => updateModeration({ banExpiresAt: banned ? daysToTimestampInSeconds(banDays) : undefined });
  const setBanDays = (days: number) => {
    const validDays = days || 1;
    setBanDaysState(validDays);
    updateModeration({ banExpiresAt: daysToTimestampInSeconds(validDays) });
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

  return { post, moderation: options.commentModeration, banDays, setFlag, setBanned, setBanDays, setReason, save };
};

export default useCommentModeration;
