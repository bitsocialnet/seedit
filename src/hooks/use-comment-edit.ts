import { useState } from 'react';
import {
  type ChallengeVerification,
  type Comment,
  type PublishCommentEditOptions,
  useComment,
  useEditedComment,
  usePublishCommentEdit,
} from '@bitsocial/bitsocial-react-hooks';
import { alertChallengeVerificationFailed } from '../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../lib/utils/comment-utils';
import challengesStore from '../stores/use-challenges-store';
import useCommentEditDraftStore from '../stores/use-comment-edit-draft-store';

const { addChallenge } = challengesStore.getState();

/** The user might type "edit: <reason>" as the last line; it becomes the edit reason instead of content. */
const parseEditContent = (content: string, reason: string | undefined) => {
  const lines = content.trim().split('\n');
  const lastLine = lines[lines.length - 1];
  if (lastLine?.toLowerCase().startsWith('edit:')) {
    return { content: lines.slice(0, -1).join('\n').trim(), reason: lastLine.substring(5).trim() };
  }
  return { content, reason };
};

/** An author's edit of their comment's content, reason, spoiler, and NSFW flags; both interfaces' edit forms use it. */
const useCommentEdit = (commentCid: string) => {
  const comment = useComment({ commentCid });
  const { editedComment } = useEditedComment({ comment });
  const post: Comment | undefined = editedComment || comment;
  const { content, reason, spoiler, nsfw } = post || {};

  // Saving hides (unmounts) the form, and a failed or abandoned edit drops off the comment, so the last save the
  // community has not accepted yet is kept per comment and the form starts from it. Only an accepted edit clears it.
  const savedDraft = useCommentEditDraftStore((state) => state.drafts[commentCid]);
  const setDraft = useCommentEditDraftStore((state) => state.setDraft);
  const clearDraft = useCommentEditDraftStore((state) => state.clearDraft);

  const [options, setOptions] = useState<PublishCommentEditOptions>(() => ({
    commentCid,
    content,
    reason,
    spoiler,
    nsfw,
    communityAddress: getCommentCommunityAddress(post),
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onError: (error: Error) => {
      console.warn(error);
      alert(error.message);
    },
    ...savedDraft,
  }));

  // usePublishCommentEdit publishes the options of the render it was called in, so they must already have the edit
  // reason parsed out for the save handler to publish directly. Text equal to the saved draft was parsed when it was
  // saved: parsing it again would turn its last remaining "edit:" line into the reason, so an unchanged retry would
  // publish something else.
  const parsedEditContent = typeof options.content === 'string' && options.content !== savedDraft?.content ? parseEditContent(options.content, options.reason) : {};
  const editOptions: PublishCommentEditOptions = { ...options, ...parsedEditContent };
  const editDraft = { content: editOptions.content, reason: editOptions.reason, spoiler: editOptions.spoiler, nsfw: editOptions.nsfw };
  const { publishCommentEdit } = usePublishCommentEdit({
    ...editOptions,
    onChallengeVerification: async (challengeVerification: ChallengeVerification, commentEdit: unknown) => {
      if (challengeVerification?.challengeSuccess) clearDraft(commentCid, editDraft);
      alertChallengeVerificationFailed(challengeVerification, commentEdit);
    },
  });

  const update = (changes: Partial<PublishCommentEditOptions>) => setOptions((state) => ({ ...state, ...changes }));
  const save = () => {
    update(parsedEditContent);
    setDraft(commentCid, editDraft);
    publishCommentEdit();
  };

  return { options, update, save };
};

export default useCommentEdit;
