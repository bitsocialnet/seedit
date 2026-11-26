import { useState } from 'react';
import { type Comment, type PublishCommentEditOptions, useComment, useEditedComment, usePublishCommentEdit } from '@bitsocial/bitsocial-react-hooks';
import { alertChallengeVerificationFailed } from '../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../lib/utils/comment-utils';
import challengesStore from '../stores/use-challenges-store';

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

  const [options, setOptions] = useState<PublishCommentEditOptions>(() => ({
    commentCid,
    content,
    reason,
    spoiler,
    nsfw,
    communityAddress: getCommentCommunityAddress(post),
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onChallengeVerification: alertChallengeVerificationFailed,
    onError: (error: Error) => {
      console.warn(error);
      alert(error.message);
    },
  }));

  // usePublishCommentEdit publishes the options of the render it was called in, so they must
  // already have the edit reason parsed out for the save handler to publish directly
  const parsedEditContent = typeof options.content === 'string' ? parseEditContent(options.content, options.reason) : {};
  const { publishCommentEdit } = usePublishCommentEdit({ ...options, ...parsedEditContent });

  const update = (changes: Partial<PublishCommentEditOptions>) => setOptions((state) => ({ ...state, ...changes }));
  const save = () => {
    update(parsedEditContent);
    publishCommentEdit();
  };

  return { options, update, save };
};

export default useCommentEdit;
